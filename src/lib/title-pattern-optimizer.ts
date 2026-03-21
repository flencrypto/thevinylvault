import { CollectionItem } from './types'
import { TitleVariant, ABTest, TitleStyle } from './ab-testing-types'
import { v4 as uuidv4 } from 'uuid'

declare const spark: Window['spark']

export interface TitlePattern {
  id: string
  pattern: string
  style: TitleStyle
  successRate: number
  avgConversionRate: number
  avgClickThroughRate: number
  usageCount: number
  elements: TitleElement[]
  createdAt: string
  lastUsed: string
}

export interface TitleElement {
  type: 'artist' | 'title' | 'year' | 'country' | 'format' | 'catalog' | 'condition' | 'keyword' | 'separator'
  position: number
  required: boolean
  format?: string
}

export interface PatternAnalysis {
  topPatterns: TitlePattern[]
  recommendedStyle: TitleStyle
  keyInsights: string[]
  successfulElements: string[]
}

export async function analyzeWinningPatterns(completedTests: ABTest[]): Promise<PatternAnalysis> {
  const winners = completedTests
    .filter(test => test.winningVariantId && test.status === 'completed')
    .map(test => {
      const winner = test.variants.find(v => v.id === test.winningVariantId)
      return winner
    })
    .filter((w): w is TitleVariant => w !== undefined && w.performance !== undefined)

  if (winners.length === 0) {
    return {
      topPatterns: [],
      recommendedStyle: 'seo_optimized',
      keyInsights: ['No completed tests yet. Start running A/B tests to build your pattern library.'],
      successfulElements: [],
    }
  }

  const stylePerformance = calculateStylePerformance(winners)
  const recommendedStyle = stylePerformance[0]?.style || 'seo_optimized'
  
  const patterns = await extractPatterns(winners)
  const topPatterns = patterns.slice(0, 5)

  const keyInsights = generateInsights(winners, stylePerformance)
  const successfulElements = identifySuccessfulElements(winners)

  return {
    topPatterns,
    recommendedStyle,
    keyInsights,
    successfulElements,
  }
}

function calculateStylePerformance(winners: TitleVariant[]): Array<{
  style: TitleStyle
  avgConversion: number
  avgCTR: number
  count: number
}> {
  const styleMap = new Map<TitleStyle, { totalConversion: number; totalCTR: number; count: number }>()

  winners.forEach(winner => {
    const existing = styleMap.get(winner.style) || { totalConversion: 0, totalCTR: 0, count: 0 }
    styleMap.set(winner.style, {
      totalConversion: existing.totalConversion + (winner.performance?.conversionRate || 0),
      totalCTR: existing.totalCTR + (winner.performance?.clickThroughRate || 0),
      count: existing.count + 1,
    })
  })

  return Array.from(styleMap.entries())
    .map(([style, data]) => ({
      style,
      avgConversion: data.totalConversion / data.count,
      avgCTR: data.totalCTR / data.count,
      count: data.count,
    }))
    .sort((a, b) => (b.avgConversion + b.avgCTR) - (a.avgConversion + a.avgCTR))
}

async function extractPatterns(winners: TitleVariant[]): Promise<TitlePattern[]> {
  const patterns: TitlePattern[] = []

  for (const winner of winners) {
    const elements = parseTitle(winner.text)
    
    const pattern: TitlePattern = {
      id: uuidv4(),
      pattern: generatePatternTemplate(elements),
      style: winner.style,
      successRate: 100,
      avgConversionRate: winner.performance?.conversionRate || 0,
      avgClickThroughRate: winner.performance?.clickThroughRate || 0,
      usageCount: 1,
      elements,
      createdAt: winner.createdAt,
      lastUsed: winner.createdAt,
    }

    patterns.push(pattern)
  }

  return consolidatePatterns(patterns)
}

function parseTitle(title: string): TitleElement[] {
  const elements: TitleElement[] = []
  const position = 0

  const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/)
  if (yearMatch) {
    elements.push({
      type: 'year',
      position: title.indexOf(yearMatch[0]),
      required: true,
    })
  }

  const conditionMatch = title.match(/\b([MN]M?|EX\+?|VG\+?|G\+?|F|P)\/([MN]M?|EX\+?|VG\+?|G\+?|F|P)\b/)
  if (conditionMatch) {
    elements.push({
      type: 'condition',
      position: title.indexOf(conditionMatch[0]),
      required: true,
      format: 'media/sleeve',
    })
  }

  const formatMatch = title.match(/\b(LP|12"|7"|EP|Single|Album)\b/i)
  if (formatMatch) {
    elements.push({
      type: 'format',
      position: title.indexOf(formatMatch[0]),
      required: true,
    })
  }

  const countryMatch = title.match(/\b(UK|US|USA|Germany|Japan|France|Canada|EU)\b/i)
  if (countryMatch) {
    elements.push({
      type: 'country',
      position: title.indexOf(countryMatch[0]),
      required: false,
    })
  }

  elements.push({
    type: 'artist',
    position: 0,
    required: true,
  })

  elements.push({
    type: 'title',
    position: 1,
    required: true,
  })

  return elements.sort((a, b) => a.position - b.position)
}

function generatePatternTemplate(elements: TitleElement[]): string {
  return elements.map(el => `{${el.type}}`).join(' ')
}

function consolidatePatterns(patterns: TitlePattern[]): TitlePattern[] {
  const patternMap = new Map<string, TitlePattern>()

  patterns.forEach(pattern => {
    const existing = patternMap.get(pattern.pattern)
    if (existing) {
      existing.usageCount++
      existing.avgConversionRate = 
        (existing.avgConversionRate * (existing.usageCount - 1) + pattern.avgConversionRate) / existing.usageCount
      existing.avgClickThroughRate = 
        (existing.avgClickThroughRate * (existing.usageCount - 1) + pattern.avgClickThroughRate) / existing.usageCount
      existing.successRate = (existing.successRate * (existing.usageCount - 1) + 100) / existing.usageCount
      existing.lastUsed = pattern.lastUsed
    } else {
      patternMap.set(pattern.pattern, pattern)
    }
  })

  return Array.from(patternMap.values())
    .sort((a, b) => {
      const scoreA = (a.avgConversionRate * 0.5) + (a.avgClickThroughRate * 0.3) + (a.usageCount * 0.2)
      const scoreB = (b.avgConversionRate * 0.5) + (b.avgClickThroughRate * 0.3) + (b.usageCount * 0.2)
      return scoreB - scoreA
    })
}

function generateInsights(winners: TitleVariant[], stylePerformance: Array<{ style: TitleStyle; avgConversion: number; avgCTR: number; count: number }>): string[] {
  const insights: string[] = []

  if (stylePerformance.length > 0) {
    const top = stylePerformance[0]
    insights.push(`${top.style.replace('_', ' ')} titles perform best with ${top.avgConversion.toFixed(1)}% conversion rate`)
  }

  const avgLength = winners.reduce((sum, w) => sum + w.text.length, 0) / winners.length
  insights.push(`Optimal title length is around ${Math.round(avgLength)} characters`)

  const withCondition = winners.filter(w => /\b[MN]M|EX|VG|G|F|P\b/.test(w.text))
  if (withCondition.length / winners.length > 0.8) {
    insights.push('Including condition grades increases conversion by showing transparency')
  }

  const withYear = winners.filter(w => /\b19\d{2}|20\d{2}\b/.test(w.text))
  if (withYear.length / winners.length > 0.7) {
    insights.push('Year inclusion helps buyers find specific pressings they want')
  }

  const withCatalog = winners.filter(w => /\b[A-Z]{2,}\s?\d{3,}\b/.test(w.text))
  if (withCatalog.length / winners.length > 0.5) {
    insights.push('Catalog numbers attract serious collectors searching for specific pressings')
  }

  return insights
}

function identifySuccessfulElements(winners: TitleVariant[]): string[] {
  const elements: string[] = []

  const withCondition = winners.filter(w => /\b[MN]M|EX|VG|G|F|P\b/.test(w.text)).length
  if (withCondition / winners.length > 0.6) {
    elements.push('Condition grades (VG+/EX etc.)')
  }

  const withYear = winners.filter(w => /\b19\d{2}|20\d{2}\b/.test(w.text)).length
  if (withYear / winners.length > 0.6) {
    elements.push('Release year')
  }

  const withCountry = winners.filter(w => /\b(UK|US|USA|Germany|Japan)\b/i.test(w.text)).length
  if (withCountry / winners.length > 0.5) {
    elements.push('Country of pressing')
  }

  const withFormat = winners.filter(w => /\b(LP|12"|7"|EP)\b/i.test(w.text)).length
  if (withFormat / winners.length > 0.7) {
    elements.push('Format specification')
  }

  const withCatalog = winners.filter(w => /\b[A-Z]{2,}\s?\d{3,}\b/.test(w.text)).length
  if (withCatalog / winners.length > 0.4) {
    elements.push('Catalog number')
  }

  const withPress = winners.filter(w => /(1st|first|original|press|pressing)/i.test(w.text)).length
  if (withPress / winners.length > 0.3) {
    elements.push('Pressing details (1st press, original, etc.)')
  }

  return elements
}

export async function generateOptimizedTitleFromPatterns(
  item: CollectionItem,
  channel: 'ebay' | 'discogs' | 'shopify',
  patterns: TitlePattern[]
): Promise<string> {
  if (patterns.length === 0) {
    return `${item.artistName} - ${item.releaseTitle} (${item.year}) ${item.condition.mediaGrade}/${item.condition.sleeveGrade}`
  }

  const topPattern = patterns[0]

  try {
    const prompt = spark.llmPrompt`You are an expert at creating high-converting vinyl record listing titles.

Based on this proven successful title pattern that has achieved ${topPattern.avgConversionRate.toFixed(1)}% conversion rate:

Pattern: "${topPattern.pattern}"
Style: ${topPattern.style}
Example successful elements: ${topPattern.elements.map(e => e.type).join(', ')}

Generate an optimized title for this record following the same pattern and style:

Record Details:
- Artist: ${item.artistName}
- Title: ${item.releaseTitle}
- Year: ${item.year}
- Country: ${item.country}
- Format: ${item.format}
- Catalog Number: ${item.catalogNumber || 'N/A'}
- Condition: ${item.condition.mediaGrade}/${item.condition.sleeveGrade}

Requirements:
- Follow the successful pattern structure
- Include all key elements that made the pattern successful
- Keep under 80 characters for ${channel}
- Be accurate and factual
- Match the proven style: ${topPattern.style}

Return ONLY the optimized title text, nothing else.`

    const response = await spark.llm(prompt, 'gpt-4o-mini')
    return response.trim()
  } catch (error) {
    console.error('Failed to generate optimized title from pattern:', error)
    return applyPatternManually(item, topPattern)
  }
}

function applyPatternManually(item: CollectionItem, pattern: TitlePattern): string {
  const parts: string[] = []

  pattern.elements.forEach(element => {
    switch (element.type) {
      case 'artist':
        parts.push(item.artistName)
        break
      case 'title':
        parts.push(item.releaseTitle)
        break
      case 'year':
        parts.push(item.year.toString())
        break
      case 'country':
        parts.push(item.country)
        break
      case 'format':
        parts.push(item.format)
        break
      case 'catalog':
        if (item.catalogNumber) parts.push(item.catalogNumber)
        break
      case 'condition':
        parts.push(`${item.condition.mediaGrade}/${item.condition.sleeveGrade}`)
        break
    }
  })

  let title = parts.join(' ')
  
  if (title.length > 80) {
    title = title.substring(0, 77) + '...'
  }

  return title
}

export function getPatternRecommendation(
  item: CollectionItem,
  patterns: TitlePattern[]
): {
  recommendedPattern: TitlePattern | null
  reason: string
  expectedPerformance: string
} {
  if (patterns.length === 0) {
    return {
      recommendedPattern: null,
      reason: 'No patterns available yet. Run A/B tests to build your pattern library.',
      expectedPerformance: 'Unknown',
    }
  }

  const topPattern = patterns[0]

  const reason = `This pattern has been used ${topPattern.usageCount} time(s) with ${topPattern.avgConversionRate.toFixed(1)}% conversion rate and ${topPattern.avgClickThroughRate.toFixed(1)}% click-through rate.`

  const expectedPerformance = topPattern.avgConversionRate > 5
    ? 'High conversion expected'
    : topPattern.avgConversionRate > 2
    ? 'Moderate conversion expected'
    : 'Baseline performance expected'

  return {
    recommendedPattern: topPattern,
    reason,
    expectedPerformance,
  }
}
