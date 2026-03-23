/**
 * Tests for text-import-service pure utility functions.
 *
 * Covers:
 *  - sanitizeFormat
 *  - sanitizeGrade
 *  - parseWithRegex
 *
 * Note: parseTextToImportItems() depends on spark.llm which is unavailable
 * in the Vitest node environment, so it is tested only via its regex path.
 */

import { describe, it, expect } from 'vitest'
import { sanitizeFormat, sanitizeGrade, parseWithRegex } from '../text-import-service'

// ─── sanitizeFormat ───────────────────────────────────────────────────────────

describe('sanitizeFormat', () => {
  it('accepts valid format LP', () => {
    expect(sanitizeFormat('LP')).toBe('LP')
  })

  it('accepts valid format 7in', () => {
    expect(sanitizeFormat('7in')).toBe('7in')
  })

  it('accepts valid format 12in', () => {
    expect(sanitizeFormat('12in')).toBe('12in')
  })

  it('accepts valid format EP', () => {
    expect(sanitizeFormat('EP')).toBe('EP')
  })

  it('accepts valid format Boxset', () => {
    expect(sanitizeFormat('Boxset')).toBe('Boxset')
  })

  it('defaults unknown string to LP', () => {
    expect(sanitizeFormat('Cassette')).toBe('LP')
  })

  it('defaults null to LP', () => {
    expect(sanitizeFormat(null)).toBe('LP')
  })

  it('defaults undefined to LP', () => {
    expect(sanitizeFormat(undefined)).toBe('LP')
  })

  it('defaults number to LP', () => {
    expect(sanitizeFormat(42)).toBe('LP')
  })
})

// ─── sanitizeGrade ────────────────────────────────────────────────────────────

describe('sanitizeGrade', () => {
  it('accepts M', () => expect(sanitizeGrade('M')).toBe('M'))
  it('accepts NM', () => expect(sanitizeGrade('NM')).toBe('NM'))
  it('accepts EX', () => expect(sanitizeGrade('EX')).toBe('EX'))
  it('accepts VG+', () => expect(sanitizeGrade('VG+')).toBe('VG+'))
  it('accepts VG', () => expect(sanitizeGrade('VG')).toBe('VG'))
  it('accepts G', () => expect(sanitizeGrade('G')).toBe('G'))
  it('accepts F', () => expect(sanitizeGrade('F')).toBe('F'))
  it('accepts P', () => expect(sanitizeGrade('P')).toBe('P'))

  it('defaults unknown string to VG+', () => {
    expect(sanitizeGrade('Fair')).toBe('VG+')
  })

  it('defaults null to VG+', () => {
    expect(sanitizeGrade(null)).toBe('VG+')
  })

  it('defaults undefined to VG+', () => {
    expect(sanitizeGrade(undefined)).toBe('VG+')
  })
})

// ─── parseWithRegex ───────────────────────────────────────────────────────────

describe('parseWithRegex', () => {
  it('parses a simple "Artist - Title" line', () => {
    const results = parseWithRegex('The Beatles - Abbey Road')
    expect(results).toHaveLength(1)
    expect(results[0].artistName).toBe('The Beatles')
    expect(results[0].releaseTitle).toBe('Abbey Road')
    expect(results[0].year).toBe(1970) // default when no year
    expect(results[0].confirmed).toBe(false)
  })

  it('parses a line with year "Artist - Title (1969)"', () => {
    const results = parseWithRegex('The Beatles - Abbey Road (1969)')
    expect(results[0].year).toBe(1969)
  })

  it('parses a known country from trailing text', () => {
    const results = parseWithRegex('Pink Floyd - The Wall (1979) UK')
    expect(results[0].country).toBe('UK')
  })

  it('ignores unknown trailing text as country (sets Unknown)', () => {
    // "NM/VG+" is a grade, not a country – should not be stored as country
    const results = parseWithRegex('Pink Floyd - The Wall (1979) NM/VG+')
    expect(results[0].country).toBe('Unknown')
  })

  it('falls back to title-only for unmatched lines', () => {
    const results = parseWithRegex('Just a random note with no dash')
    expect(results).toHaveLength(1)
    expect(results[0].artistName).toBe('Unknown Artist')
    expect(results[0].releaseTitle).toBe('Just a random note with no dash')
    expect(results[0].confidence).toBe(0.2)
  })

  it('skips blank lines', () => {
    const results = parseWithRegex('  \n\nThe Beatles - Abbey Road\n\n')
    expect(results).toHaveLength(1)
  })

  it('parses multiple lines', () => {
    const text = 'Led Zeppelin - Physical Graffiti (1975)\nDavid Bowie - Ziggy Stardust (1972) UK'
    const results = parseWithRegex(text)
    expect(results).toHaveLength(2)
    expect(results[0].artistName).toBe('Led Zeppelin')
    expect(results[1].artistName).toBe('David Bowie')
    expect(results[1].country).toBe('UK')
  })

  it('uses default format LP', () => {
    const results = parseWithRegex('Radiohead - OK Computer')
    expect(results[0].format).toBe('LP')
  })

  it('uses default grades VG+', () => {
    const results = parseWithRegex('Radiohead - OK Computer')
    expect(results[0].mediaGrade).toBe('VG+')
    expect(results[0].sleeveGrade).toBe('VG+')
  })

  it('sets confidence 0.4 for matched lines', () => {
    const results = parseWithRegex('Nirvana - Nevermind (1991)')
    expect(results[0].confidence).toBe(0.4)
  })

  it('returns empty array for empty input', () => {
    expect(parseWithRegex('')).toHaveLength(0)
    expect(parseWithRegex('   \n\n  ')).toHaveLength(0)
  })

  it('stores the original line as rawText', () => {
    const line = 'Miles Davis - Kind of Blue (1959) US'
    const results = parseWithRegex(line)
    expect(results[0].rawText).toBe(line)
  })
})
