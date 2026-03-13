import { CollectionItem } from './types'
import { TitleVariant, TitleStyle, ABTest, TestResult, VariantPerformance } from './ab-testing-types'
import { v4 as uuidv4 } from 'uuid'

declare const spark: Window['spark']

export async function generateTitleVariants(
  item: CollectionItem,
  channel: 'ebay' | 'discogs' | 'shopify',
  count: number = 5
): Promise<TitleVariant[]> {
  const variants: TitleVariant[] = []

  const baseInfo = {
    artist: item.artistName,
    title: item.releaseTitle,
    year: item.year,
    country: item.country,
    format: item.format,
    catalog: item.catalogNumber || '',
    mediaGrade: item.condition.mediaGrade,
    sleeveGrade: item.condition.sleeveGrade,
  }

  try {
    const prompt = spark.llmPrompt`You are an expert at creating high-converting marketplace listing titles for vinyl records.

Generate ${count} different title variants for this record, each following a different style and strategy for maximum conversion on ${channel}:

Record Details:
- Artist: ${baseInfo.artist}
- Title: ${baseInfo.title}
- Year: ${baseInfo.year}
- Country: ${baseInfo.country}
- Format: ${baseInfo.format}
- Catalog Number: ${baseInfo.catalog}
- Condition: ${baseInfo.mediaGrade}/${baseInfo.sleeveGrade}

Create variants following these distinct styles:
1. SEO Optimized - Maximum keyword density, all key identifiers, optimized for search
2. Concise - Short and punchy, key info only, easy to scan
3. Detailed - Comprehensive with all specs, matrix info if available, pressing details
4. Collector-Focused - Emphasizes rarity, pressing characteristics, appeal to serious collectors
5. Keyword-Rich - Multiple search terms for broad reach, includes genre and era terms

Each title should:
- Be under 80 characters for ${channel} (eBay titles max at 80 chars)
- Include condition grades
- Be accurate and factual
- Follow marketplace best practices
- Appeal to the target buyer persona for that style

Return ONLY a JSON object with a "variants" property containing an array of objects with:
- "text": the title text
- "style": one of "seo_optimized", "concise", "detailed", "collector_focused", "keyword_rich"
- "reasoning": brief explanation of strategy (1 sentence)

Example format:
{
  "variants": [
    {
      "text": "Pink Floyd Dark Side Moon LP UK 1st Press Harvest SHVL 804 1973 VG+/VG",
      "style": "seo_optimized",
      "reasoning": "Includes all key search terms and identifiers for maximum discoverability"
    }
  ]
}`

    const response = await spark.llm(prompt, 'gpt-4o-mini', true)
    const parsed = JSON.parse(response)

    if (parsed.variants && Array.isArray(parsed.variants)) {
      return parsed.variants.map((v: any) => ({
        id: uuidv4(),
        text: v.text,
        style: v.style as TitleStyle,
        createdAt: new Date().toISOString(),
      }))
    }
  } catch (error) {
    console.error('Failed to generate AI title variants:', error)
  }

  return generateFallbackVariants(item)
}

function generateFallbackVariants(item: CollectionItem): TitleVariant[] {
  const condition = `${item.condition.mediaGrade}/${item.condition.sleeveGrade}`
  const catalog = item.catalogNumber ? ` ${item.catalogNumber}` : ''
  
  return [
    {
      id: uuidv4(),
      text: `${item.artistName} - ${item.releaseTitle} ${item.format} ${item.year} ${item.country}${catalog} ${condition}`,
      style: 'seo_optimized',
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      text: `${item.artistName} - ${item.releaseTitle} (${item.year} ${item.country}) ${condition}`,
      style: 'concise',
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      text: `${item.artistName} ${item.releaseTitle} ${item.format} Vinyl ${item.year} ${item.country} Press ${condition}`,
      style: 'keyword_rich',
      createdAt: new Date().toISOString(),
    },
  ]
}

export function calculateVariantPerformance(variant: TitleVariant): VariantPerformance {
  const performance = variant.performance || {
    views: 0,
    clicks: 0,
    watchlists: 0,
    messages: 0,
    sales: 0,
    clickThroughRate: 0,
    conversionRate: 0,
  }

  const clickThroughRate = performance.views > 0 
    ? (performance.clicks / performance.views) * 100 
    : 0

  const conversionRate = performance.clicks > 0
    ? (performance.sales / performance.clicks) * 100
    : 0

  return {
    ...performance,
    clickThroughRate,
    conversionRate,
  }
}

export function determineWinningVariant(test: ABTest): TestResult[] {
  const results: TestResult[] = test.variants.map(variant => {
    const performance = calculateVariantPerformance(variant)
    
    const score = 
      (performance.clickThroughRate * 0.4) +
      (performance.conversionRate * 0.5) +
      (performance.watchlists * 0.1)

    return {
      variantId: variant.id,
      variantText: variant.text,
      performance,
      isWinner: false,
      confidenceScore: score,
    }
  })

  results.sort((a, b) => b.confidenceScore - a.confidenceScore)

  if (results.length > 0) {
    results[0].isWinner = true
    
    if (results.length > 1) {
      const improvement = 
        ((results[0].confidenceScore - results[1].confidenceScore) / results[1].confidenceScore) * 100
      results[0].improvement = improvement
    }
  }

  return results
}

export function createABTest(
  itemId: string,
  variants: TitleVariant[],
  listingDraftId?: string
): ABTest {
  return {
    id: uuidv4(),
    itemId,
    listingDraftId,
    variants,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function startABTest(test: ABTest, activeVariantId: string): ABTest {
  return {
    ...test,
    activeVariantId,
    status: 'active',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function completeABTest(test: ABTest): ABTest {
  const results = determineWinningVariant(test)
  const winner = results.find(r => r.isWinner)

  return {
    ...test,
    status: 'completed',
    completedAt: new Date().toISOString(),
    winningVariantId: winner?.variantId,
    updatedAt: new Date().toISOString(),
  }
}

export function updateVariantPerformance(
  test: ABTest,
  variantId: string,
  updates: Partial<VariantPerformance>
): ABTest {
  return {
    ...test,
    variants: test.variants.map(v => 
      v.id === variantId
        ? {
            ...v,
            performance: {
              ...(v.performance || {
                views: 0,
                clicks: 0,
                watchlists: 0,
                messages: 0,
                sales: 0,
                clickThroughRate: 0,
                conversionRate: 0,
              }),
              ...updates,
            },
          }
        : v
    ),
    updatedAt: new Date().toISOString(),
  }
}

export async function generateOptimizedTitle(
  item: CollectionItem,
  channel: 'ebay' | 'discogs' | 'shopify',
  previousWinners: TitleVariant[]
): Promise<string> {
  if (previousWinners.length === 0) {
    const variants = await generateTitleVariants(item, channel, 1)
    return variants[0]?.text || `${item.artistName} - ${item.releaseTitle}`
  }

  try {
    const winnerExamples = previousWinners
      .slice(0, 3)
      .map(w => `- "${w.text}" (style: ${w.style})`)
      .join('\n')

    const prompt = spark.llmPrompt`Based on these previously successful listing titles:

${winnerExamples}

Generate an optimized title for this new record that follows similar patterns:

Record Details:
- Artist: ${item.artistName}
- Title: ${item.releaseTitle}
- Year: ${item.year}
- Country: ${item.country}
- Format: ${item.format}
- Catalog: ${item.catalogNumber || 'N/A'}
- Condition: ${item.condition.mediaGrade}/${item.condition.sleeveGrade}

Requirements:
- Under 80 characters
- Follow the style patterns that worked in previous tests
- Include condition grades
- Accurate and factual

Return ONLY the title text, nothing else.`

    const response = await spark.llm(prompt, 'gpt-4o-mini')
    return response.trim()
  } catch (error) {
    console.error('Failed to generate optimized title:', error)
    return `${item.artistName} - ${item.releaseTitle} (${item.year})`
  }
}
