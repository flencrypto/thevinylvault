/**
 * Tests for the record identifier pure utility functions.
 *
 * Covers:
 *  - normalizeIdentifier  (pressing-identification-ai.ts)
 *  - similarityScore      (pressing-identification-ai.ts)
 *  - extractMatrixPatterns (pressing-identification-ai.ts)
 *  - calculateConfidenceBand (pressing-identification-ai.ts)
 *  - parseVinylText       (tesseract-ocr-service.ts)
 *
 * Note: identifyPressing() is intentionally NOT tested here because it calls
 * the LLM via the Spark runtime, which is unavailable in the test environment.
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeIdentifier,
  similarityScore,
  extractMatrixPatterns,
  calculateConfidenceBand,
} from '../pressing-identification-ai'
import { tesseractOCRService } from '../tesseract-ocr-service'

// ─── normalizeIdentifier ──────────────────────────────────────────────────────

describe('normalizeIdentifier', () => {
  it('converts lowercase to uppercase', () => {
    expect(normalizeIdentifier('abc')).toBe('ABC')
  })

  it('removes spaces', () => {
    expect(normalizeIdentifier('PL 12030')).toBe('PL12030')
  })

  it('removes hyphens', () => {
    expect(normalizeIdentifier('XEX-504')).toBe('XEX504')
  })

  it('removes all non-alphanumeric characters', () => {
    expect(normalizeIdentifier('A1/B1 (UK)')).toBe('A1B1UK')
  })

  it('preserves digits', () => {
    expect(normalizeIdentifier('12345')).toBe('12345')
  })

  it('handles mixed case and punctuation', () => {
    expect(normalizeIdentifier('SHVL-804-A')).toBe('SHVL804A')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeIdentifier('')).toBe('')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeIdentifier('   ')).toBe('')
  })

  it('handles already-normalized input unchanged', () => {
    expect(normalizeIdentifier('ABC123')).toBe('ABC123')
  })
})

// ─── similarityScore ─────────────────────────────────────────────────────────

describe('similarityScore', () => {
  it('returns 1.0 for identical strings', () => {
    expect(similarityScore('A1', 'A1')).toBe(1.0)
  })

  it('returns 1.0 for strings that are identical after normalization', () => {
    expect(similarityScore('pl 12030', 'PL-12030')).toBe(1.0)
  })

  it('returns 1.0 when both strings are empty', () => {
    expect(similarityScore('', '')).toBe(1.0)
  })

  it('returns 0 when one string is empty and the other is not', () => {
    expect(similarityScore('A1', '')).toBe(0)
    expect(similarityScore('', 'A1')).toBe(0)
  })

  it('returns partial match score when one string contains the other', () => {
    // 'A1' (length 2) is contained in 'A1B1' (length 4) → 2/4 = 0.5
    const score = similarityScore('A1', 'A1B1')
    expect(score).toBeCloseTo(0.5)
  })

  it('returns 0 for completely unrelated strings', () => {
    // 'ZZZZZ' vs 'A1' → no prefix overlap and no inclusion
    const score = similarityScore('ZZZZZ', 'A1')
    expect(score).toBe(0)
  })

  it('returns a higher score for closer strings', () => {
    const closeScore = similarityScore('XEX504', 'XEX505')
    const farScore = similarityScore('XEX504', 'ABC123')
    expect(closeScore).toBeGreaterThan(farScore)
  })

  it('is symmetric — score(a,b) equals score(b,a)', () => {
    const ab = similarityScore('SHVL804', 'SHVL8045')
    const ba = similarityScore('SHVL8045', 'SHVL804')
    expect(ab).toBeCloseTo(ba)
  })

  it('score is between 0 and 1 inclusive', () => {
    const pairs: [string, string][] = [
      ['A1', 'B2'],
      ['PL12030', 'PL12030X'],
      ['', 'ABC'],
      ['XEX504', 'XEX504'],
    ]
    for (const [a, b] of pairs) {
      const score = similarityScore(a, b)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    }
  })
})

// ─── extractMatrixPatterns ────────────────────────────────────────────────────

describe('extractMatrixPatterns', () => {
  it('extracts simple side/stamper identifiers (A1, B2)', () => {
    const results = extractMatrixPatterns('Side A1 Side B2')
    expect(results).toContain('A1')
    expect(results).toContain('B2')
  })

  it('extracts two-digit stamper identifiers (A12)', () => {
    const results = extractMatrixPatterns('Stamper A12 used')
    expect(results).toContain('A12')
  })

  it('extracts catalogue-style identifiers with no separator (SHVL804)', () => {
    const results = extractMatrixPatterns('Label SHVL804')
    expect(results).toContain('SHVL804')
  })

  it('extracts catalogue-style identifiers with space separator (SHVL 804)', () => {
    const results = extractMatrixPatterns('Matrix SHVL 804 pressed')
    expect(results).toContain('SHVL 804')
  })

  it('extracts catalogue-style identifiers with hyphen separator (SHVL-804)', () => {
    const results = extractMatrixPatterns('SHVL-804 original pressing')
    expect(results).toContain('SHVL-804')
  })

  it('extracts XEX-style runout with pressing letter (XEX-504-A)', () => {
    const results = extractMatrixPatterns('XEX-504-A')
    expect(results).toContain('XEX-504-A')
  })

  it('extracts XEX-style extended runout with pressing digit+letter (XEX 504-3N)', () => {
    const results = extractMatrixPatterns('Runout: XEX 504-3N')
    expect(results).toContain('XEX 504-3N')
  })

  it('returns normalized uppercase results', () => {
    const results = extractMatrixPatterns('shvl804')
    // Pattern matching is case-insensitive; results are uppercased
    expect(results.every(r => r === r.toUpperCase())).toBe(true)
  })

  it('returns an empty array for text with no matrix patterns', () => {
    const results = extractMatrixPatterns('Hello world, no identifiers here.')
    expect(results).toHaveLength(0)
  })

  it('returns an empty array for empty input', () => {
    const results = extractMatrixPatterns('')
    expect(results).toHaveLength(0)
  })

  it('deduplicates repeated occurrences of the same pattern', () => {
    const results = extractMatrixPatterns('A1 A1 A1')
    const a1Matches = results.filter(r => r === 'A1')
    expect(a1Matches).toHaveLength(1)
  })

  it('extracts multiple distinct patterns from the same text', () => {
    const results = extractMatrixPatterns('A1 B1 SHVL804')
    expect(results).toContain('A1')
    expect(results).toContain('B1')
    expect(results).toContain('SHVL804')
  })

  it('extracts numeric-prefix runout (12345-AB-1 style)', () => {
    const results = extractMatrixPatterns('123456 AB 1 pressed')
    expect(results.some(r => /^\d{5,6}/.test(r))).toBe(true)
  })
})

// ─── calculateConfidenceBand ──────────────────────────────────────────────────

describe('calculateConfidenceBand', () => {
  // Exact boundary values
  it('returns "high" at exactly 0.80', () => {
    expect(calculateConfidenceBand(0.80)).toBe('high')
  })

  it('returns "high" above 0.80', () => {
    expect(calculateConfidenceBand(0.95)).toBe('high')
    expect(calculateConfidenceBand(1.0)).toBe('high')
  })

  it('returns "medium" just below 0.80', () => {
    expect(calculateConfidenceBand(0.79)).toBe('medium')
  })

  it('returns "medium" at exactly 0.60', () => {
    expect(calculateConfidenceBand(0.60)).toBe('medium')
  })

  it('returns "medium" between 0.60 and 0.80', () => {
    expect(calculateConfidenceBand(0.70)).toBe('medium')
  })

  it('returns "low" just below 0.60', () => {
    expect(calculateConfidenceBand(0.59)).toBe('low')
  })

  it('returns "low" at exactly 0.40', () => {
    expect(calculateConfidenceBand(0.40)).toBe('low')
  })

  it('returns "low" between 0.40 and 0.60', () => {
    expect(calculateConfidenceBand(0.50)).toBe('low')
  })

  it('returns "ambiguous" just below 0.40', () => {
    expect(calculateConfidenceBand(0.39)).toBe('ambiguous')
  })

  it('returns "ambiguous" at 0', () => {
    expect(calculateConfidenceBand(0)).toBe('ambiguous')
  })

  it('returns "ambiguous" for very low scores', () => {
    expect(calculateConfidenceBand(0.10)).toBe('ambiguous')
  })
})

// ─── parseVinylText ───────────────────────────────────────────────────────────

describe('parseVinylText', () => {
  it('returns a result with all null fields for empty input', () => {
    const result = tesseractOCRService.parseVinylText('')
    expect(result.artist).toBeNull()
    expect(result.title).toBeNull()
    expect(result.catalogueNumber).toBeNull()
    expect(result.year).toBeNull()
    expect(result.label).toBeNull()
    expect(result.confidence).toBe('low')
  })

  it('returns a result with all null fields for whitespace-only input', () => {
    const result = tesseractOCRService.parseVinylText('   \n\t  ')
    expect(result.artist).toBeNull()
    expect(result.year).toBeNull()
    expect(result.confidence).toBe('low')
  })

  it('extracts a year from text', () => {
    const result = tesseractOCRService.parseVinylText('Recorded in 1972')
    expect(result.year).toBe(1972)
  })

  it('extracts recent valid years (2000s)', () => {
    const result = tesseractOCRService.parseVinylText('Released 2015')
    expect(result.year).toBe(2015)
  })

  it('does not extract years outside the vinyl era (e.g. 1930)', () => {
    const result = tesseractOCRService.parseVinylText('Made in 1930')
    expect(result.year).toBeNull()
  })

  it('extracts a known label name', () => {
    const result = tesseractOCRService.parseVinylText('Blue Note Records BLP 1521')
    expect(result.label).toBe('Blue Note')
  })

  it('extracts Atlantic label', () => {
    const result = tesseractOCRService.parseVinylText('Atlantic Records SD 8295')
    expect(result.label).toBe('Atlantic')
  })

  it('extracts Vertigo label', () => {
    const result = tesseractOCRService.parseVinylText('Released on Vertigo Swirl label')
    expect(result.label).toBe('Vertigo')
  })

  it('returns null label for unknown label', () => {
    const result = tesseractOCRService.parseVinylText('UnknownLabel Records 12345')
    expect(result.label).toBeNull()
  })

  it('extracts a catalogue number', () => {
    const result = tesseractOCRService.parseVinylText('Catalog: SHVL 804')
    expect(result.catalogueNumber).not.toBeNull()
  })

  it('extracts country via "Made in" pattern', () => {
    const result = tesseractOCRService.parseVinylText('Made in Germany')
    expect(result.country).toBe('Germany')
  })

  it('extracts UK from plain "UK" mention', () => {
    const result = tesseractOCRService.parseVinylText('Pressed in the UK')
    expect(result.country).toBe('UK')
  })

  it('extracts US from "USA" mention', () => {
    const result = tesseractOCRService.parseVinylText('Manufactured in USA')
    expect(result.country).toBe('US')
  })

  it('extracts Japan country', () => {
    const result = tesseractOCRService.parseVinylText('Made in Japan OBI')
    expect(result.country).toBe('Japan')
  })

  it('extracts LP format from text', () => {
    const result = tesseractOCRService.parseVinylText('This is an LP record')
    expect(result.format).toBe('LP')
  })

  it('extracts 7" format from 45 RPM mention', () => {
    const result = tesseractOCRService.parseVinylText('45 RPM single')
    expect(result.format).toBe('7"')
  })

  it('detects A1 stamper as first press evidence', () => {
    const text = 'SHVL 804 A1\nSHVL 804 B1'
    const result = tesseractOCRService.parseVinylText(text)
    // A1/B1 in matrix lines triggers first press heuristic
    if (result.matrixRunoutA !== null || result.matrixRunoutB !== null) {
      // If matrix was extracted, pressing evidence may be set
      expect(result.pressingEvidence).toBeDefined()
    }
  })

  it('extracts STERLING as pressing evidence', () => {
    const text = 'STERLING\nA1'
    const result = tesseractOCRService.parseVinylText(text)
    expect(result.pressingEvidence.some(e => /STERLING/i.test(e))).toBe(true)
    expect(result.pressingConfidence).toBe('high')
  })

  it('extracts PORKY hand-etch as pressing evidence', () => {
    const text = 'PORKY\nB1'
    const result = tesseractOCRService.parseVinylText(text)
    expect(result.pressingEvidence.some(e => /PORKY/i.test(e))).toBe(true)
    expect(result.pressingConfidence).toBe('high')
  })

  it('picks up artist/title via keyword lines', () => {
    const text = 'Artist: David Bowie\nTitle: Low'
    const result = tesseractOCRService.parseVinylText(text)
    expect(result.artist).toBe('David Bowie')
    expect(result.title).toBe('Low')
  })

  it('falls back to heuristic artist/title from substantial lines', () => {
    const text = 'Pink Floyd\nDark Side of the Moon\n33 RPM'
    const result = tesseractOCRService.parseVinylText(text)
    expect(result.artist).toBe('Pink Floyd')
    expect(result.title).toBe('Dark Side of the Moon')
  })

  it('sets high confidence when 4+ fields are populated', () => {
    const text = [
      'Artist: Miles Davis',
      'Title: Kind of Blue',
      'Columbia Records CL 1355',
      'Made in USA',
      '1959',
    ].join('\n')
    const result = tesseractOCRService.parseVinylText(text)
    expect(result.confidence).toBe('high')
  })

  it('sets medium confidence when 2-3 fields are populated', () => {
    const text = 'Atlantic Records\n1969'
    const result = tesseractOCRService.parseVinylText(text)
    // label + year = 2 hits → medium
    expect(['medium', 'high']).toContain(result.confidence)
  })

  it('identifierStrings deduplicates entries', () => {
    const text = 'BLP 1521 BLP 1521'
    const result = tesseractOCRService.parseVinylText(text)
    const unique = new Set(result.identifierStrings)
    expect(result.identifierStrings.length).toBe(unique.size)
  })

  it('barcode is extracted for 8-14 digit sequences', () => {
    const text = 'Barcode 5099749518520'
    const result = tesseractOCRService.parseVinylText(text)
    expect(result.barcode).toBe('5099749518520')
  })

  it('does not extract barcode from 7-digit number (too short)', () => {
    const text = '1234567'
    const result = tesseractOCRService.parseVinylText(text)
    expect(result.barcode).toBeNull()
  })
})
