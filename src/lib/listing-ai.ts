import { CollectionItem, MediaGrade, PriceEstimate } from './types'

declare const spark: Window['spark']

export async function generateSEOKeywords(
  item: CollectionItem,
  channel: 'ebay' | 'discogs' | 'shopify'
): Promise<string[]> {
  const keywords: string[] = []

  keywords.push(item.artistName)
  keywords.push(item.releaseTitle)
  keywords.push(item.format)
  keywords.push(`${item.year}`)
  keywords.push(item.country)

  if (item.catalogNumber) {
    keywords.push(item.catalogNumber)
  }

  keywords.push('vinyl')
  keywords.push('record')
  keywords.push('LP')

  if (item.condition.mediaGrade === 'M' || item.condition.mediaGrade === 'NM') {
    keywords.push('mint')
    keywords.push('near mint')
  }

  if (item.year < 1970) {
    keywords.push('vintage')
    keywords.push('original pressing')
  }

  const genreKeywords = inferGenreKeywords(item.artistName)
  keywords.push(...genreKeywords)

  if (channel === 'ebay') {
    keywords.push('collector')
    keywords.push('rare')
  }

  return keywords
}

function inferGenreKeywords(artistName: string): string[] {
  const lowerArtist = artistName.toLowerCase()
  
  const genreMap: Record<string, string[]> = {
    'beatles': ['rock', 'pop', 'british invasion', '60s'],
    'pink floyd': ['progressive rock', 'psychedelic', 'classic rock'],
    'david bowie': ['glam rock', 'art rock', 'classic rock'],
    'led zeppelin': ['hard rock', 'heavy metal', 'classic rock'],
    'miles davis': ['jazz', 'bebop', 'fusion'],
    'kraftwerk': ['electronic', 'krautrock', 'synth'],
    'joy division': ['post-punk', 'new wave', 'alternative'],
    'black sabbath': ['heavy metal', 'doom metal', 'hard rock'],
  }

  for (const [artist, genres] of Object.entries(genreMap)) {
    if (lowerArtist.includes(artist)) {
      return genres
    }
  }

  return ['rock', 'pop']
}

export async function generateListingCopy(
  item: CollectionItem,
  channel: 'ebay' | 'discogs' | 'shopify',
  keywords: string[]
): Promise<{ title: string; subtitle?: string; description: string }> {
  const prompt = spark.llmPrompt`You are an expert vinyl record dealer creating optimized marketplace listings.

Item Details:
- Artist: ${item.artistName}
- Title: ${item.releaseTitle}
- Format: ${item.format}
- Year: ${item.year}
- Country: ${item.country}
- Catalog Number: ${item.catalogNumber || 'N/A'}
- Media Grade: ${item.condition.mediaGrade}
- Sleeve Grade: ${item.condition.sleeveGrade}
- Grading Standard: ${item.condition.gradingStandard}
- Notes: ${item.condition.gradingNotes || 'No additional notes'}

Channel: ${channel}
SEO Keywords: ${keywords.join(', ')}

Create a professional listing with:
1. A compelling, SEO-optimized title (max 80 chars for eBay, can be longer for others)
2. An optional subtitle with key details (only for eBay)
3. A detailed description that includes:
   - Opening hook about the album/artist
   - Pressing details (year, country, catalog number)
   - Condition description (media and sleeve, be specific)
   - Notable features or selling points
   - Grading standard used
   - Any defects or issues mentioned in notes
   - Professional closing

Make it engaging but accurate. Use keywords naturally. Be honest about condition.

Return as JSON with keys: title, subtitle (can be null), description`

  try {
    const response = await spark.llm(prompt, 'gpt-4o', true)
    const parsed = JSON.parse(response)
    
    return {
      title: parsed.title || generateFallbackTitle(item),
      subtitle: parsed.subtitle,
      description: parsed.description || generateFallbackDescription(item),
    }
  } catch (error) {
    console.error('LLM generation failed, using fallback:', error)
    return {
      title: generateFallbackTitle(item),
      subtitle: channel === 'ebay' ? `${item.condition.mediaGrade}/${item.condition.sleeveGrade} ${item.format} ${item.year}` : undefined,
      description: generateFallbackDescription(item),
    }
  }
}

function generateFallbackTitle(item: CollectionItem): string {
  const parts = [
    item.artistName,
    '-',
    item.releaseTitle,
    item.format,
  ]

  if (item.catalogNumber) {
    parts.push(item.catalogNumber)
  }

  parts.push(`${item.year}`)
  parts.push(`${item.condition.mediaGrade}/${item.condition.sleeveGrade}`)

  return parts.join(' ').substring(0, 80)
}

function generateFallbackDescription(item: CollectionItem): string {
  return `${item.artistName} - ${item.releaseTitle}

Format: ${item.format}
Year: ${item.year}
Country: ${item.country}
${item.catalogNumber ? `Catalog Number: ${item.catalogNumber}` : ''}

Condition:
Media: ${item.condition.mediaGrade} (${item.condition.gradingStandard} Standard)
Sleeve: ${item.condition.sleeveGrade} (${item.condition.gradingStandard} Standard)

${item.condition.gradingNotes ? `Notes: ${item.condition.gradingNotes}` : ''}

This record has been carefully graded using the ${item.condition.gradingStandard} grading standard. Please review the condition details before purchasing.

${item.notes ? `Additional Information:\n${item.notes}` : ''}

Shipping: We package all records with care using proper mailers and protection.

Thank you for your interest!`
}

export function suggestListingPrice(estimate: PriceEstimate, condition: MediaGrade): number {
  const conditionPremiums: Record<string, number> = {
    'M': 1.2,
    'NM': 1.1,
    'EX': 1.0,
    'VG+': 0.95,
    'VG': 0.85,
    'G': 0.7,
    'F': 0.5,
    'P': 0.3,
  }

  const premium = conditionPremiums[condition] || 1.0
  const basePrice = estimate.estimateMid * premium

  const marketingAdjustment = 1.15

  const suggestedPrice = basePrice * marketingAdjustment

  return Math.round(suggestedPrice * 100) / 100
}

export async function generateBulkListings(
  items: CollectionItem[],
  channel: 'ebay' | 'discogs' | 'shopify'
): Promise<Array<{ itemId: string; title: string; description: string; price: number }>> {
  const listings = []

  for (const item of items) {
    const keywords = await generateSEOKeywords(item, channel)
    const copy = await generateListingCopy(item, channel, keywords)
    const estimate = { estimateMid: 50, currency: item.purchaseCurrency } as PriceEstimate
    const price = suggestListingPrice(estimate, item.condition.mediaGrade)

    listings.push({
      itemId: item.id,
      title: copy.title,
      description: copy.description,
      price,
    })
  }

  return listings
}
