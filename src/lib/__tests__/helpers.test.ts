/**
 * Tests for the pure utility functions in helpers.ts.
 *
 * Covers:
 *  - formatCurrency
 *  - formatDate
 *  - getGradeColor
 *  - getStatusColor
 *  - generatePriceEstimate
 *  - calculateCollectionValue
 *
 * Note: internal helpers (calculateBaseValue, getConditionMultiplier, etc.)
 * are not directly exported and are covered indirectly through the public API.
 */

import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatDate,
  getGradeColor,
  getStatusColor,
  generatePriceEstimate,
  calculateCollectionValue,
} from '../helpers'
import type { CollectionItem } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal CollectionItem suitable for testing. */
function makeItem(overrides: Partial<CollectionItem> = {}): CollectionItem {
  return {
    id: 'test-id',
    collectionId: 'col-1',
    artistName: 'Pink Floyd',
    releaseTitle: 'The Dark Side of the Moon',
    format: 'LP',
    year: 1973,
    country: 'UK',
    quantity: 1,
    purchaseCurrency: 'GBP',
    sourceType: 'shop',
    status: 'owned',
    condition: {
      mediaGrade: 'VG+',
      sleeveGrade: 'VG+',
      gradingStandard: 'Goldmine',
      gradedAt: '2023-01-01',
    },
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    ...overrides,
  }
}

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats GBP amounts with £ symbol', () => {
    expect(formatCurrency(10.0, 'GBP')).toBe('£10.00')
  })

  it('formats USD amounts with $ symbol', () => {
    expect(formatCurrency(10.0, 'USD')).toBe('$10.00')
  })

  it('formats EUR amounts with € symbol', () => {
    expect(formatCurrency(10.0, 'EUR')).toBe('€10.00')
  })

  it('defaults to GBP (£) when no currency is provided', () => {
    expect(formatCurrency(10.0)).toBe('£10.00')
  })

  it('uses € symbol for unrecognised currency codes', () => {
    expect(formatCurrency(10.0, 'SEK')).toBe('€10.00')
  })

  it('formats large amounts with thousands separator', () => {
    expect(formatCurrency(1234.5, 'GBP')).toBe('£1,234.50')
  })

  it('formats zero correctly', () => {
    expect(formatCurrency(0, 'GBP')).toBe('£0.00')
  })

  it('rounds to two decimal places', () => {
    // 9.999 rounds to 10.00 in standard rounding
    expect(formatCurrency(9.999, 'USD')).toBe('$10.00')
  })
})

// ─── formatDate ──────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats an ISO date string to day-month-year', () => {
    const result = formatDate('2023-01-15')
    expect(result).toBe('15 Jan 2023')
  })

  it('formats a different month correctly', () => {
    const result = formatDate('1999-12-31')
    expect(result).toBe('31 Dec 1999')
  })

  it('returns a non-empty string for any date', () => {
    expect(formatDate('2000-06-01').length).toBeGreaterThan(0)
  })
})

// ─── getGradeColor ────────────────────────────────────────────────────────────

describe('getGradeColor', () => {
  it('returns text-accent for Mint grade', () => {
    expect(getGradeColor('M')).toBe('text-accent')
  })

  it('returns text-green-400 for Near Mint grade', () => {
    expect(getGradeColor('NM')).toBe('text-green-400')
  })

  it('returns text-blue-400 for EX grade', () => {
    expect(getGradeColor('EX')).toBe('text-blue-400')
  })

  it('returns text-cyan-400 for VG+ grade', () => {
    expect(getGradeColor('VG+')).toBe('text-cyan-400')
  })

  it('returns text-yellow-400 for VG grade', () => {
    expect(getGradeColor('VG')).toBe('text-yellow-400')
  })

  it('returns text-orange-400 for G grade', () => {
    expect(getGradeColor('G')).toBe('text-orange-400')
  })

  it('returns text-red-400 for Fair grade', () => {
    expect(getGradeColor('F')).toBe('text-red-400')
  })

  it('returns text-red-600 for Poor grade', () => {
    expect(getGradeColor('P')).toBe('text-red-600')
  })

  it('returns text-muted-foreground for an unknown grade', () => {
    expect(getGradeColor('unknown')).toBe('text-muted-foreground')
  })

  it('returns text-muted-foreground for an empty string', () => {
    expect(getGradeColor('')).toBe('text-muted-foreground')
  })
})

// ─── getStatusColor ───────────────────────────────────────────────────────────

describe('getStatusColor', () => {
  it('returns secondary for owned status', () => {
    expect(getStatusColor('owned')).toBe('secondary')
  })

  it('returns default for for_sale status', () => {
    expect(getStatusColor('for_sale')).toBe('default')
  })

  it('returns outline for sold status', () => {
    expect(getStatusColor('sold')).toBe('outline')
  })

  it('returns outline for traded status', () => {
    expect(getStatusColor('traded')).toBe('outline')
  })

  it('returns outline for archived status', () => {
    expect(getStatusColor('archived')).toBe('outline')
  })

  it('returns default for an unknown status', () => {
    expect(getStatusColor('unknown')).toBe('default')
  })

  it('returns default for an empty string', () => {
    expect(getStatusColor('')).toBe('default')
  })
})

// ─── generatePriceEstimate ────────────────────────────────────────────────────

describe('generatePriceEstimate', () => {
  it('returns an object with all required PriceEstimate fields', () => {
    const result = generatePriceEstimate(makeItem())
    expect(result).toHaveProperty('estimateLow')
    expect(result).toHaveProperty('estimateMid')
    expect(result).toHaveProperty('estimateHigh')
    expect(result).toHaveProperty('currency')
    expect(result).toHaveProperty('confidenceScore')
    expect(result).toHaveProperty('drivers')
    expect(result).toHaveProperty('comparableSales')
  })

  it('currency matches the item purchaseCurrency', () => {
    expect(generatePriceEstimate(makeItem({ purchaseCurrency: 'GBP' })).currency).toBe('GBP')
    expect(generatePriceEstimate(makeItem({ purchaseCurrency: 'USD' })).currency).toBe('USD')
  })

  it('estimateLow is less than estimateMid', () => {
    const result = generatePriceEstimate(makeItem())
    expect(result.estimateLow).toBeLessThan(result.estimateMid)
  })

  it('estimateMid is less than estimateHigh', () => {
    const result = generatePriceEstimate(makeItem())
    expect(result.estimateMid).toBeLessThan(result.estimateHigh)
  })

  it('all price estimates are positive numbers', () => {
    const result = generatePriceEstimate(makeItem())
    expect(result.estimateLow).toBeGreaterThan(0)
    expect(result.estimateMid).toBeGreaterThan(0)
    expect(result.estimateHigh).toBeGreaterThan(0)
  })

  it('prices are rounded to at most 2 decimal places', () => {
    const result = generatePriceEstimate(makeItem())
    const twoDecimals = (n: number) => parseFloat(n.toFixed(2)) === n
    expect(twoDecimals(result.estimateLow)).toBe(true)
    expect(twoDecimals(result.estimateMid)).toBe(true)
    expect(twoDecimals(result.estimateHigh)).toBe(true)
  })

  it('confidenceScore is within [0, 1] bounds', () => {
    const result = generatePriceEstimate(makeItem())
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0)
    expect(result.confidenceScore).toBeLessThanOrEqual(1)
  })

  it('base confidence is 0.5 when no optional identifiers are provided', () => {
    const item = makeItem() // no catalogNumber, pressingId, gradingNotes, images
    expect(generatePriceEstimate(item).confidenceScore).toBe(0.5)
  })

  it('confidence increases when catalogNumber is present', () => {
    const without = makeItem()
    const with_ = makeItem({ catalogNumber: 'SHVL 804' })
    expect(generatePriceEstimate(with_).confidenceScore).toBeGreaterThan(
      generatePriceEstimate(without).confidenceScore
    )
  })

  it('confidence increases when pressingId is present', () => {
    const without = makeItem()
    const with_ = makeItem({ pressingId: 'pressing-001' })
    expect(generatePriceEstimate(with_).confidenceScore).toBeGreaterThan(
      generatePriceEstimate(without).confidenceScore
    )
  })

  it('confidence is capped at 0.95 even when all optional fields are present', () => {
    const item = makeItem({
      catalogNumber: 'SHVL 804',
      pressingId: 'pressing-001',
      images: ['img1.jpg', 'img2.jpg'],
      condition: {
        mediaGrade: 'NM',
        sleeveGrade: 'NM',
        gradingStandard: 'Goldmine',
        gradingNotes: 'Looks excellent',
        gradedAt: '2023-01-01',
      },
    })
    expect(generatePriceEstimate(item).confidenceScore).toBe(0.95)
  })

  it('pre-1970 items have higher base value than post-1990 items (same artist/title)', () => {
    const old = makeItem({ year: 1965 })
    const modern = makeItem({ year: 1995 })
    expect(generatePriceEstimate(old).estimateMid).toBeGreaterThan(
      generatePriceEstimate(modern).estimateMid
    )
  })

  it('Boxset format items have higher value than LP items (same artist/title/year)', () => {
    const lp = makeItem({ format: 'LP' })
    const box = makeItem({ format: 'Boxset' })
    expect(generatePriceEstimate(box).estimateMid).toBeGreaterThan(
      generatePriceEstimate(lp).estimateMid
    )
  })

  it('higher media grade yields higher mid price than lower grade', () => {
    const mint = makeItem({ condition: { mediaGrade: 'M', sleeveGrade: 'NM', gradingStandard: 'Goldmine', gradedAt: '2023-01-01' } })
    const poor = makeItem({ condition: { mediaGrade: 'P', sleeveGrade: 'NM', gradingStandard: 'Goldmine', gradedAt: '2023-01-01' } })
    expect(generatePriceEstimate(mint).estimateMid).toBeGreaterThan(
      generatePriceEstimate(poor).estimateMid
    )
  })

  it('UK pressing has higher rarity multiplier than non-UK (same everything else)', () => {
    const uk = makeItem({ country: 'UK' })
    const us = makeItem({ country: 'US' })
    expect(generatePriceEstimate(uk).estimateMid).toBeGreaterThan(
      generatePriceEstimate(us).estimateMid
    )
  })

  it('returns three drivers describing the value components', () => {
    const result = generatePriceEstimate(makeItem())
    expect(Array.isArray(result.drivers)).toBe(true)
    expect(result.drivers).toHaveLength(3)
    result.drivers!.forEach(d => {
      expect(typeof d.name).toBe('string')
      expect(typeof d.impact).toBe('number')
    })
  })

  it('comparableSales is a positive integer', () => {
    const result = generatePriceEstimate(makeItem())
    expect(Number.isInteger(result.comparableSales)).toBe(true)
    expect(result.comparableSales).toBeGreaterThanOrEqual(5)
    expect(result.comparableSales).toBeLessThanOrEqual(34)
  })

  it('is deterministic for price values (same input → same output)', () => {
    const item = makeItem()
    const first = generatePriceEstimate(item)
    const second = generatePriceEstimate(item)
    expect(first.estimateLow).toBe(second.estimateLow)
    expect(first.estimateMid).toBe(second.estimateMid)
    expect(first.estimateHigh).toBe(second.estimateHigh)
  })
})

// ─── calculateCollectionValue ─────────────────────────────────────────────────

describe('calculateCollectionValue', () => {
  it('returns 0 for an empty collection', () => {
    expect(calculateCollectionValue([])).toBe(0)
  })

  it('returns estimateMid for a single item with quantity 1', () => {
    const item = makeItem()
    const expected = generatePriceEstimate(item).estimateMid
    expect(calculateCollectionValue([item])).toBe(expected)
  })

  it('multiplies estimateMid by item quantity', () => {
    const item = makeItem({ quantity: 3 })
    const expected = generatePriceEstimate(item).estimateMid * 3
    expect(calculateCollectionValue([item])).toBeCloseTo(expected, 2)
  })

  it('sums across multiple items', () => {
    const itemA = makeItem({ artistName: 'Led Zeppelin', releaseTitle: 'IV' })
    const itemB = makeItem({ artistName: 'The Beatles', releaseTitle: 'Abbey Road' })
    const expectedSum =
      generatePriceEstimate(itemA).estimateMid +
      generatePriceEstimate(itemB).estimateMid
    expect(calculateCollectionValue([itemA, itemB])).toBeCloseTo(expectedSum, 2)
  })

  it('returns a positive number for a non-empty collection', () => {
    expect(calculateCollectionValue([makeItem()])).toBeGreaterThan(0)
  })
})
