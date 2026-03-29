/**
 * Tests for the pure utility functions in title-pattern-optimizer.ts.
 *
 * Covers:
 *  - getPatternRecommendation
 *  - analyzeWinningPatterns
 *
 * Note: generateOptimizedTitleFromPatterns() calls spark.llm which is
 * unavailable in the Vitest node environment and is intentionally not tested.
 */

import { describe, it, expect } from 'vitest'
import {
  getPatternRecommendation,
  analyzeWinningPatterns,
} from '../title-pattern-optimizer'
import type { TitlePattern } from '../title-pattern-optimizer'
import type { ABTest, TitleVariant } from '../ab-testing-types'
import type { CollectionItem } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<CollectionItem> = {}): CollectionItem {
  return {
    id: 'item-1',
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

function makePattern(overrides: Partial<TitlePattern> = {}): TitlePattern {
  return {
    id: 'pattern-1',
    pattern: '{artist} {title}',
    style: 'seo_optimized',
    successRate: 80,
    avgConversionRate: 5.0,
    avgClickThroughRate: 3.0,
    usageCount: 10,
    elements: [],
    createdAt: '2023-01-01T00:00:00Z',
    lastUsed: '2023-01-15T00:00:00Z',
    ...overrides,
  }
}

function makeVariant(overrides: Partial<TitleVariant> = {}): TitleVariant {
  return {
    id: 'variant-1',
    text: 'Pink Floyd - Dark Side of Moon LP UK 1973 VG+/NM',
    style: 'seo_optimized',
    createdAt: '2023-01-01T00:00:00Z',
    performance: {
      views: 100,
      clicks: 10,
      watchlists: 5,
      messages: 3,
      sales: 2,
      clickThroughRate: 10.0,
      conversionRate: 5.0,
      averageSalePrice: 25.0,
    },
    ...overrides,
  }
}

function makeCompletedTest(overrides: Partial<ABTest> = {}): ABTest {
  const variant = makeVariant()
  return {
    id: 'test-1',
    itemId: 'item-1',
    variants: [variant],
    status: 'completed',
    winningVariantId: 'variant-1',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-15T00:00:00Z',
    ...overrides,
  }
}

// ─── getPatternRecommendation ─────────────────────────────────────────────────

describe('getPatternRecommendation', () => {
  it('returns null recommendedPattern and guidance when no patterns exist', () => {
    const result = getPatternRecommendation(makeItem(), [])
    expect(result.recommendedPattern).toBeNull()
    expect(result.reason).toContain('No patterns available')
    expect(result.expectedPerformance).toBe('Unknown')
  })

  it('returns the first (top-performing) pattern when patterns exist', () => {
    const pattern = makePattern()
    const result = getPatternRecommendation(makeItem(), [pattern])
    expect(result.recommendedPattern).toBe(pattern)
  })

  it('reason includes usage count', () => {
    const pattern = makePattern({ usageCount: 7 })
    const result = getPatternRecommendation(makeItem(), [pattern])
    expect(result.reason).toContain('7')
  })

  it('reason includes conversion rate', () => {
    const pattern = makePattern({ avgConversionRate: 4.2 })
    const result = getPatternRecommendation(makeItem(), [pattern])
    expect(result.reason).toContain('4.2')
  })

  it('reason includes click-through rate', () => {
    const pattern = makePattern({ avgClickThroughRate: 3.7 })
    const result = getPatternRecommendation(makeItem(), [pattern])
    expect(result.reason).toContain('3.7')
  })

  it('returns "High conversion expected" when conversionRate > 5', () => {
    const pattern = makePattern({ avgConversionRate: 6.5 })
    const result = getPatternRecommendation(makeItem(), [pattern])
    expect(result.expectedPerformance).toBe('High conversion expected')
  })

  it('returns "Moderate conversion expected" when 2 < conversionRate <= 5', () => {
    const pattern = makePattern({ avgConversionRate: 3.0 })
    const result = getPatternRecommendation(makeItem(), [pattern])
    expect(result.expectedPerformance).toBe('Moderate conversion expected')
  })

  it('returns "Baseline performance expected" when conversionRate <= 2', () => {
    const pattern = makePattern({ avgConversionRate: 1.5 })
    const result = getPatternRecommendation(makeItem(), [pattern])
    expect(result.expectedPerformance).toBe('Baseline performance expected')
  })

  it('always recommends the first pattern (index 0) regardless of how many patterns exist', () => {
    const first = makePattern({ id: 'first', avgConversionRate: 9.0 })
    const second = makePattern({ id: 'second', avgConversionRate: 2.0 })
    const result = getPatternRecommendation(makeItem(), [first, second])
    expect(result.recommendedPattern?.id).toBe('first')
  })
})

// ─── analyzeWinningPatterns ───────────────────────────────────────────────────

describe('analyzeWinningPatterns', () => {
  it('returns empty result when no tests have been completed', async () => {
    const result = await analyzeWinningPatterns([])
    expect(result.topPatterns).toEqual([])
    expect(result.recommendedStyle).toBe('seo_optimized')
    expect(result.keyInsights).toHaveLength(1)
    expect(result.keyInsights[0]).toContain('No completed tests yet')
    expect(result.successfulElements).toEqual([])
  })

  it('returns empty result when tests are active (not completed)', async () => {
    const activeTest: ABTest = {
      ...makeCompletedTest(),
      status: 'active',
    }
    const result = await analyzeWinningPatterns([activeTest])
    expect(result.topPatterns).toEqual([])
    expect(result.keyInsights[0]).toContain('No completed tests yet')
  })

  it('returns empty result when completed test has no winningVariantId', async () => {
    const test: ABTest = {
      ...makeCompletedTest(),
      winningVariantId: undefined,
    }
    const result = await analyzeWinningPatterns([test])
    expect(result.topPatterns).toEqual([])
  })

  it('returns empty result when winning variant has no performance data', async () => {
    const variantNoPerf: TitleVariant = {
      ...makeVariant(),
      performance: undefined,
    }
    const test: ABTest = {
      ...makeCompletedTest(),
      variants: [variantNoPerf],
      winningVariantId: variantNoPerf.id,
    }
    const result = await analyzeWinningPatterns([test])
    expect(result.topPatterns).toEqual([])
  })

  it('returns populated result when a completed test with a winner is provided', async () => {
    const result = await analyzeWinningPatterns([makeCompletedTest()])
    expect(result.topPatterns.length).toBeGreaterThan(0)
    expect(typeof result.recommendedStyle).toBe('string')
    expect(Array.isArray(result.keyInsights)).toBe(true)
    expect(result.keyInsights.length).toBeGreaterThan(0)
    expect(Array.isArray(result.successfulElements)).toBe(true)
  })

  it('limits topPatterns to at most 5', async () => {
    const tests: ABTest[] = Array.from({ length: 10 }, (_, i) => {
      const variant = makeVariant({ id: `variant-${i}`, text: `Artist ${i} - Title ${i} LP 202${i % 10} VG+/NM` })
      return {
        id: `test-${i}`,
        itemId: `item-${i}`,
        variants: [variant],
        status: 'completed' as const,
        winningVariantId: `variant-${i}`,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z',
      }
    })
    const result = await analyzeWinningPatterns(tests)
    expect(result.topPatterns.length).toBeLessThanOrEqual(5)
  })

  it('recommendedStyle matches the top-performing style from the winners', async () => {
    const variant = makeVariant({ style: 'collector_focused' })
    const test = makeCompletedTest({ variants: [variant] })
    const result = await analyzeWinningPatterns([test])
    expect(result.recommendedStyle).toBe('collector_focused')
  })

  it('keyInsights includes an optimal title length observation', async () => {
    const result = await analyzeWinningPatterns([makeCompletedTest()])
    const lengthInsight = result.keyInsights.find(i => i.includes('Optimal title length'))
    expect(lengthInsight).toBeDefined()
  })

  it('each topPattern has the expected shape', async () => {
    const result = await analyzeWinningPatterns([makeCompletedTest()])
    result.topPatterns.forEach(pattern => {
      expect(typeof pattern.id).toBe('string')
      expect(typeof pattern.pattern).toBe('string')
      expect(typeof pattern.style).toBe('string')
      expect(typeof pattern.successRate).toBe('number')
      expect(typeof pattern.avgConversionRate).toBe('number')
      expect(typeof pattern.avgClickThroughRate).toBe('number')
      expect(typeof pattern.usageCount).toBe('number')
      expect(Array.isArray(pattern.elements)).toBe(true)
    })
  })
})
