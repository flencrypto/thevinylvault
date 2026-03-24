import { CollectionItem } from './types'
import { intelligenceCoordinator, CycleResult } from './intelligence/intelligence-coordinator'

// ── System prompt for the Vinyl Valuation & Pressing Agent ────────────────

const VINYL_AGENT_SYSTEM_PROMPT = `You are VinylVault's expert Vinyl Valuation & Pressing Identification Agent.

When the user asks anything about value, worth, pressing identification, matrix, price, or "what's my copy worth?", base your entire response on the intelligence data provided below.

Your response must be valid JSON that will be parsed. Inside the JSON object, put all explanatory text in the "answer" field. Within that "answer" field, follow this numbered structure:

1. Pressing identification summary (catalog, label, year, country)
2. Matrix comparison and match confidence percentage
3. Tracklist note (from the full release if available; otherwise write "Not available")
4. Direct clickable link to the Discogs release page (if available)
5. Recent eBay sold listings based only on the sold listing data provided (dates, prices, currencies, titles, and links)
6. Discogs current lowest price + want/have ratio (if available)
7. Historical trend (30-day % change, if available)
8. Composite market momentum (if available)
9. Realistic price range and clear buy/sell recommendation (only if it can be supported by the provided data; otherwise explain that there is not enough data)
10. Final one-line summary

If confidence < 80%, explicitly say in the "answer" field: "Confidence is moderate. Please click the Discogs link to double-check the matrix yourself."

If any information required for a bullet point is missing from the intelligence results, either write "Not available" for that detail or briefly skip that part. Never guess, approximate, or fabricate any numbers, track details, conditions, or links.`

// ── Helpers ───────────────────────────────────────────────────────────────

const VALUATION_KEYWORDS =
  /\b(valu|worth|price|priced|pricing|pressing|matrix|runout|deadwax|sell|selling|sold|buy|buying|bought|how much|market|trend|ebay|discogs|estimate|apprais)\b|what.{0,3}s it/i

function isValuationQuestion(question: string): boolean {
  return VALUATION_KEYWORDS.test(question)
}

/** Extract a matrix string the user typed (e.g. "Matrix is SHVL 817 A-1U") */
function extractUserMatrix(question: string): string {
  const match = question.match(
    /(?:matrix|runout|deadwax)\s+(?:is\s+|:?\s*)([A-Z0-9 \-./]+(?:etched|stamped)?)/i
  )
  return match ? match[1].trim() : ''
}

function formatCycleResultsForPrompt(result: CycleResult): string {
  if (result.status === 'error') {
    return `Intelligence cycle encountered an error: ${result.error ?? 'unknown'}`
  }
  if (result.status !== 'complete') {
    return 'Intelligence cycle did not complete.'
  }

  const lines: string[] = ['=== INTELLIGENCE CYCLE RESULTS ===']

  // Pressing
  const p = result.pressing
  if (p) {
    lines.push('\n--- Pressing Identification ---')
    if (p.artistName) lines.push(`Artist: ${p.artistName}`)
    if (p.releaseTitle) lines.push(`Title: ${p.releaseTitle}`)
    if (p.catalogNumber) lines.push(`Catalog: ${p.catalogNumber}`)
    if (p.year) lines.push(`Year: ${p.year}`)
    if (p.country) lines.push(`Country: ${p.country}`)
    lines.push(`Match confidence: ${Math.round((p.matchScore ?? 0) * 100)}%`)
    if (p.variantNotes) lines.push(`Variant notes: ${p.variantNotes}`)
    if (result.ocrMatrix?.length) {
      lines.push(`OCR matrix strings: ${result.ocrMatrix.join(' | ')}`)
    }
    if (p.matrix?.length) {
      lines.push(`Discogs matrix strings: ${p.matrix.join(' | ')}`)
    }
    if (p.matchedVariantId) {
      lines.push(`Discogs release link: https://www.discogs.com/release/${p.matchedVariantId}`)
    }
  }

  // eBay sold listings
  const sold = result.sold
  if (sold) {
    lines.push('\n--- Recent eBay Sold Listings ---')
    const hasListings = !!(sold.listings && sold.listings.length > 0)
    if (hasListings) {
      sold.listings.slice(0, 5).forEach((l) => {
        const title = l.title ? ` — ${l.title}` : ''
        const url = l.url ? ` — ${l.url}` : ''
        const price = l.price != null ? l.price.toFixed(2) : 'N/A'
        lines.push(`  • ${l.soldDate}: ${l.currency} ${price}${title}${url}`)
      })
      lines.push(`Average price: ${sold.currency} ${sold.averagePrice?.toFixed(2) ?? 'N/A'}`)
      lines.push(`Median price:  ${sold.currency} ${sold.medianPrice?.toFixed(2) ?? 'N/A'}`)
      lines.push(`30-day trend:  ${sold.trend30d > 0 ? '+' : ''}${sold.trend30d?.toFixed(1) ?? 0}%`)
      lines.push(`60-day trend:  ${sold.trend60d > 0 ? '+' : ''}${sold.trend60d?.toFixed(1) ?? 0}%`)
    } else {
      lines.push('  No recent sold listings found. eBay sold data was unavailable or empty for this item.')
    }
  }

  // Discogs market
  const dm = result.discogsMarket
  if (dm) {
    lines.push('\n--- Discogs Market Data ---')
    const isDefaultEmptyMarket =
      dm.lowestPrice == null &&
      dm.medianPrice == null &&
      dm.numForSale === 0 &&
      dm.want === 0 &&
      dm.have === 0

    if (isDefaultEmptyMarket) {
      lines.push('Discogs market data unavailable (Discogs token missing or fetch failed).')
    } else {
      lines.push(`Lowest price:  ${dm.currency} ${dm.lowestPrice?.toFixed(2) ?? 'N/A'}`)
      lines.push(`Median price:  ${dm.currency} ${dm.medianPrice?.toFixed(2) ?? 'N/A'}`)
      lines.push(`For sale:      ${dm.numForSale}`)
      lines.push(`Want / Have:   ${dm.want} / ${dm.have}`)
      lines.push(`Demand trend:  ${dm.demandTrend} (score ${dm.demandScore})`)
    }
  }

  // Valuation
  const v = result.valuation
  if (v) {
    lines.push('\n--- Synthesised Valuation ---')
    lines.push(`Price range:   ${v.currency} ${v.estimateLow.toFixed(2)} – ${v.estimateHigh.toFixed(2)} (mid ${v.estimateMid.toFixed(2)})`)
    lines.push(`Confidence:    ${Math.round(v.confidence * 100)}%`)
    lines.push(`Signal:        ${v.momentumSignal}`)
    lines.push(`Rationale:     ${v.rationale}`)
  }

  lines.push('\n=== END INTELLIGENCE RESULTS ===')
  return lines.join('\n')
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  itemContext?: string
  suggestedCorrection?: ChatCorrection
  correctionApplied?: boolean
}

export interface ChatCorrection {
  field: string
  originalValue: string
  suggestedValue: string
  reasoning: string
  confidence: number
}

export interface LearningData {
  id: string
  question: string
  originalAnswer: string
  userCorrection: string
  context: {
    itemId?: string
    artistName?: string
    releaseTitle?: string
  }
  timestamp: string
  applied: boolean
}

export async function askAboutRecord(
  question: string,
  item: CollectionItem,
  allItems: CollectionItem[],
  conversationHistory: ChatMessage[]
): Promise<{ answer: string; suggestedCorrections?: ChatCorrection[] }> {
  // ── Valuation / pressing path: run the full intelligence cycle first ──
  const needsIntelligence = isValuationQuestion(question)
  let cycleContext = ''

  if (needsIntelligence) {
    try {
      const discogsToken =
        localStorage.getItem('discogs_personal_token') ?? null
      await intelligenceCoordinator.init(discogsToken)

      const userMatrix = extractUserMatrix(question)
      const releaseData: Record<string, unknown> = {
        artistName: item.artistName,
        releaseTitle: item.releaseTitle,
        catalogNumber: item.catalogNumber,
        year: item.year,
        country: item.country,
        format: item.format,
        labelName: item.labelName,
        discogsId: item.discogsId,
        discogsReleaseId: item.discogsReleaseId,
        matrixNumbers: item.matrixNumbers,
        barcodes: item.barcodes,
      }

      const cycleResult = await intelligenceCoordinator.runFullCycle({
        releaseData,
        ...(userMatrix ? { matrixOverride: userMatrix } : {}),
      })
      cycleContext = formatCycleResultsForPrompt(cycleResult)
    } catch (err) {
      console.error('Intelligence cycle error:', err)
      cycleContext = '(Intelligence cycle unavailable — answering from record metadata only.)'
    }
  }

  const systemSection = needsIntelligence
    ? `${VINYL_AGENT_SYSTEM_PROMPT}\n\n${cycleContext}\n\n`
    : 'You are a vinyl record expert assistant for VinylVault, a professional record collection management system.\n\n'

  const contextPrompt = spark.llmPrompt`${systemSection}Context about this record:
- Artist: ${item.artistName}
- Title: ${item.releaseTitle}
- Format: ${item.format}
- Year: ${item.year}
- Country: ${item.country}
- Catalog Number: ${item.catalogNumber || 'Not specified'}
- Condition: Media ${item.condition.mediaGrade} / Sleeve ${item.condition.sleeveGrade}
- Purchase Price: ${item.purchasePrice ? `${item.purchaseCurrency} ${item.purchasePrice}` : 'Not recorded'}
- Notes: ${item.notes || 'None'}

User's question: ${question}

Previous conversation context:
${conversationHistory.slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

${needsIntelligence
  ? 'Use the intelligence results above to answer. Follow the structured format specified in the system prompt.'
  : 'Provide a helpful, knowledgeable answer about this record. If you notice any potential data quality issues (incorrect artist name spelling, wrong year, unusual catalog number format, etc.), mention them naturally in your response.'}

Format your response as JSON with:
{
  "answer": "Your detailed answer here",
  "suggestedCorrections": [
    {
      "field": "artistName",
      "originalValue": "current value",
      "suggestedValue": "corrected value",
      "reasoning": "why this correction is suggested",
      "confidence": 0.85
    }
  ]
}

Only include suggestedCorrections if you notice clear errors. Keep the answer conversational and informative.`

  try {
    const response = await spark.llm(contextPrompt, 'gpt-4o', true)
    const parsed = JSON.parse(response)
    
    return {
      answer: parsed.answer || response,
      suggestedCorrections: parsed.suggestedCorrections || []
    }
  } catch (error) {
    console.error('AI chat error:', error)
    return {
      answer: "I'm having trouble processing that question right now. Please try again.",
      suggestedCorrections: []
    }
  }
}

export async function askGeneralQuestion(
  question: string,
  allItems: CollectionItem[],
  conversationHistory: ChatMessage[]
): Promise<string> {
  const stats = {
    totalRecords: allItems.length,
    formats: allItems.reduce((acc, item) => {
      acc[item.format] = (acc[item.format] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    topArtists: Object.entries(
      allItems.reduce((acc, item) => {
        acc[item.artistName] = (acc[item.artistName] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([artist, count]) => `${artist} (${count})`),
  }

  const contextPrompt = spark.llmPrompt`You are a vinyl record expert assistant for VinylVault.

User's collection overview:
- Total records: ${stats.totalRecords}
- Formats: ${Object.entries(stats.formats).map(([f, c]) => `${f}: ${c}`).join(', ')}
- Top artists: ${stats.topArtists.join(', ')}

Previous conversation:
${conversationHistory.slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

User's question: ${question}

Provide a helpful, knowledgeable answer about vinyl records, collecting, grading, or their collection. Be conversational and informative.`

  try {
    const response = await spark.llm(contextPrompt, 'gpt-4o', false)
    return response
  } catch (error) {
    console.error('AI chat error:', error)
    return "I'm having trouble processing that question right now. Please try again."
  }
}

export async function generateRecordInsights(
  item: CollectionItem,
  learningData: LearningData[]
): Promise<string> {
  const relevantLearning = learningData.filter(
    ld => ld.context.artistName === item.artistName || ld.context.releaseTitle === item.releaseTitle
  )

  const contextPrompt = spark.llmPrompt`You are analyzing a vinyl record in VinylVault.

Record details:
- Artist: ${item.artistName}
- Title: ${item.releaseTitle}
- Format: ${item.format}
- Year: ${item.year}
- Country: ${item.country}
- Catalog Number: ${item.catalogNumber || 'Not specified'}
- Condition: Media ${item.condition.mediaGrade} / Sleeve ${item.condition.sleeveGrade}
- Purchase Price: ${item.purchasePrice ? `${item.purchaseCurrency} ${item.purchasePrice}` : 'Not recorded'}

${relevantLearning.length > 0 ? `
Previous learning from user feedback about this artist/release:
${relevantLearning.map(ld => `- Q: ${ld.question}\n  Original: ${ld.originalAnswer}\n  Correction: ${ld.userCorrection}`).join('\n')}
` : ''}

Provide 3-5 interesting insights about this record, such as:
- Historical significance
- Pressing variations to watch for
- Market trends
- Collecting tips
- Notable tracks

Keep it concise and relevant to collectors.`

  try {
    const response = await spark.llm(contextPrompt, 'gpt-4o-mini', false)
    return response
  } catch (error) {
    console.error('Insights generation error:', error)
    return 'Unable to generate insights at this time.'
  }
}
