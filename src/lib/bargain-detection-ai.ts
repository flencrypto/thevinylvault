import { BargainCard, BargainSignal, MarketListing, WatchlistItem } from './types'
import { searchDiscogsMarketplace, DiscogsApiConfig, getDiscogsReleaseInfo } from './marketplace-discogs'
import type { AgentConfig } from '@/components/AgentConfigDialog'

export interface BargainAnalysisInput {
  listing: MarketListing
  watchlistItems?: WatchlistItem[]
  discogsConfig?: DiscogsApiConfig
  useDiscogsPricing?: boolean
  agentConfig?: AgentConfig
}

export interface BargainAnalysisResult {
  bargainScore: number
  estimatedValue?: number
  estimatedUpside?: number
  signals: BargainSignal[]
  matchedRelease?: {
    artistName: string
    releaseTitle: string
    year: number
    catalogNumber?: string
  }
  discogsPriceData?: {
    lowestPrice?: number
    medianPrice?: number
    highestPrice?: number
    sampleSize: number
  }
}

export async function analyzeBargainPotential(
  input: BargainAnalysisInput
): Promise<BargainAnalysisResult> {
  const { listing, discogsConfig, useDiscogsPricing = false, agentConfig } = input
  
  if (agentConfig && !agentConfig.enabled) {
    return {
      bargainScore: 0,
      signals: [],
      matchedRelease: undefined,
    }
  }

  let discogsPriceData: BargainAnalysisResult['discogsPriceData'] | undefined
  let discogsContext = ''

  if (useDiscogsPricing && discogsConfig && discogsConfig.userToken) {
    try {
      const titleParts = listing.title.split(/[-–—]/)
      const searchQuery = titleParts.slice(0, 2).join(' ').trim()
      
      const discogsListings = await searchDiscogsMarketplace(
        {
          query: searchQuery,
          per_page: 50,
          sort: 'price',
          sort_order: 'asc',
        },
        discogsConfig
      )

      if (discogsListings.length > 0) {
        const prices = discogsListings.map(l => l.price).sort((a, b) => a - b)
        const lowestPrice = prices[0]
        const highestPrice = prices[prices.length - 1]
        const medianPrice = prices[Math.floor(prices.length / 2)]

        discogsPriceData = {
          lowestPrice,
          medianPrice,
          highestPrice,
          sampleSize: prices.length,
        }

        discogsContext = `

Discogs Market Data (${prices.length} comparable listings found):
- Lowest Price: ${listing.currency} ${lowestPrice.toFixed(2)}
- Median Price: ${listing.currency} ${medianPrice.toFixed(2)}
- Highest Price: ${listing.currency} ${highestPrice.toFixed(2)}
- Current Listing Price: ${listing.currency} ${listing.price}
- Price vs Median: ${listing.price < medianPrice ? `${((1 - listing.price / medianPrice) * 100).toFixed(0)}% BELOW median` : `${((listing.price / medianPrice - 1) * 100).toFixed(0)}% above median`}`
      }
    } catch (error) {
      console.error('Failed to fetch Discogs pricing data:', error)
    }
  }

  const enabledSignals = agentConfig?.bargainDetection.enabled !== false
    ? (agentConfig?.bargainDetection.signals || {
        titleMismatch: true,
        lowPrice: true,
        wrongCategory: true,
        jobLot: true,
        promoKeywords: true,
        poorMetadata: true,
      })
    : {};

  const activeSignals = Object.entries(enabledSignals)
    .filter(([_, enabled]) => enabled)
    .map(([key]) => {
      const signalMap: Record<string, { name: string; description: string }> = {
        titleMismatch: {
          name: 'title_mismatch',
          description: "Title doesn't match known release format (misspellings, missing info, poor metadata)"
        },
        lowPrice: {
          name: 'low_price',
          description: `Price appears unusually low compared to typical vinyl prices${discogsPriceData ? ' (IMPORTANT: Use the Discogs market data above to determine this!)' : ''}`
        },
        wrongCategory: {
          name: 'wrong_category',
          description: 'May be miscategorized or listed as something else'
        },
        jobLot: {
          name: 'job_lot',
          description: 'Appears to be a bundle/lot with potentially high-value items visible'
        },
        promoKeywords: {
          name: 'promo_keywords',
          description: 'Contains promo, test pressing, white label, acetate, or rare variant keywords'
        },
        poorMetadata: {
          name: 'poor_metadata',
          description: "Seller clearly doesn't know what they have (generic descriptions, no catalog numbers)"
        },
      };
      return signalMap[key];
    })
    .filter(Boolean);

  const signalsList = activeSignals.map((signal, idx) => 
    `${idx + 1}. **${signal.name}**: ${signal.description}`
  ).join('\n');

  const customInstructions = agentConfig?.bargainDetection.customPromptAdditions 
    ? `\n\nAdditional Instructions:\n${agentConfig.bargainDetection.customPromptAdditions}`
    : '';

  const analysisPrompt = spark.llmPrompt`You are a vinyl record bargain detection expert. Analyze this marketplace listing and identify signals that it might be undervalued or misdescribed.

Listing Details:
- Title: ${listing.title}
- Description: ${listing.description || 'No description provided'}
- Price: ${listing.currency} ${listing.price}
- Condition: ${listing.condition || 'Not specified'}
- Source: ${listing.source}${discogsContext}

Analyze for these bargain signals:
${signalsList}

For each signal detected:
- Assign a score from 0-100 (higher = stronger signal)
- Provide a brief description of what you detected
- Include evidence from the listing${customInstructions}

Also estimate:
- Likely actual market value if identifiable${discogsPriceData ? ' (Use Discogs median price as strong guidance)' : ''}
- Potential upside (estimated value - listing price)
- Matched release details if you can identify the record

${discogsPriceData ? `CRITICAL: If the listing price is significantly below the Discogs median price, this is a STRONG bargain signal. Increase the bargain score accordingly.` : ''}

Return ONLY valid JSON with this structure:
{
  "bargainScore": (overall 0-100 score),
  "estimatedValue": (number or null),
  "estimatedUpside": (number or null),
  "signals": [
    {
      "type": "title_mismatch" | "low_price" | "wrong_category" | "job_lot" | "promo_keywords" | "poor_metadata",
      "score": (0-100),
      "description": "brief description",
      "evidence": "specific evidence from listing"
    }
  ],
  "matchedRelease": {
    "artistName": "artist name",
    "releaseTitle": "release title",
    "year": year,
    "catalogNumber": "catalog number"
  } or null
}`

  const modelName = agentConfig?.aiPlatform === 'openai' || agentConfig?.aiPlatform === 'custom'
    ? 'gpt-4o'
    : 'gpt-4o';

  const result = await spark.llm(analysisPrompt, modelName, true)
  const analysis = JSON.parse(result)
  
  const minScore = agentConfig?.bargainDetection.minScore ?? 0
  if (analysis.bargainScore < minScore) {
    return {
      bargainScore: analysis.bargainScore || 0,
      estimatedValue: analysis.estimatedValue || discogsPriceData?.medianPrice || undefined,
      estimatedUpside: analysis.estimatedUpside || (discogsPriceData?.medianPrice ? Math.max(0, discogsPriceData.medianPrice - listing.price) : undefined),
      signals: analysis.signals || [],
      matchedRelease: analysis.matchedRelease || undefined,
      discogsPriceData,
    }
  }

  return {
    bargainScore: analysis.bargainScore || 0,
    estimatedValue: analysis.estimatedValue || discogsPriceData?.medianPrice || undefined,
    estimatedUpside: analysis.estimatedUpside || (discogsPriceData?.medianPrice ? Math.max(0, discogsPriceData.medianPrice - listing.price) : undefined),
    signals: analysis.signals || [],
    matchedRelease: analysis.matchedRelease || undefined,
    discogsPriceData,
  }
}

export async function generateMockMarketListings(count: number = 10): Promise<MarketListing[]> {
  const prompt = spark.llmPrompt`Generate ${count} realistic marketplace listings for vinyl records that have varying bargain potential. 

Include a mix of:
- Obvious bargains (misspelled titles, low prices, poor descriptions)
- Potential gems (promo copies, test pressings, rare variants poorly described)
- Job lots with hidden value
- Fairly priced items
- Overpriced items

Make the listings feel authentic with real artist names, realistic prices in GBP, typical seller descriptions.

Return ONLY valid JSON with this structure:
{
  "listings": [
    {
      "id": "unique-id",
      "source": "ebay" | "discogs" | "reverb",
      "externalId": "external-listing-id",
      "title": "listing title as seller wrote it",
      "description": "seller description (can be brief or detailed)",
      "price": (number, realistic GBP price),
      "currency": "GBP",
      "condition": "VG" | "VG+" | "EX" | "NM" | "Used" | "Good" | null,
      "seller": "seller username",
      "location": "UK location",
      "url": "https://example.com/listing",
      "listedAt": "ISO date string"
    }
  ]
}`

  const result = await spark.llm(prompt, 'gpt-4o', true)
  const data = JSON.parse(result)
  
  return data.listings || []
}

export async function matchWatchlistToListing(
  listing: MarketListing,
  watchlistItem: WatchlistItem
): Promise<{ matches: boolean; score: number; reason: string }> {
  const prompt = spark.llmPrompt`Analyze if this marketplace listing matches the user's watchlist criteria.

Watchlist Item:
- Type: ${watchlistItem.type}
- Artist: ${watchlistItem.artistName || 'Any'}
- Release: ${watchlistItem.releaseTitle || 'Any'}
- Pressing Details: ${watchlistItem.pressingDetails || 'Any'}
- Search Query: ${watchlistItem.searchQuery || 'None'}
- Target Price: ${watchlistItem.targetPrice ? `${watchlistItem.targetCurrency} ${watchlistItem.targetPrice}` : 'Any price'}

Marketplace Listing:
- Title: ${listing.title}
- Description: ${listing.description || 'No description'}
- Price: ${listing.currency} ${listing.price}
- Condition: ${listing.condition || 'Not specified'}

Determine:
1. Does this listing match the watchlist criteria?
2. Match confidence score (0-100)
3. Brief reason for match or no match

Return ONLY valid JSON:
{
  "matches": true or false,
  "score": (0-100),
  "reason": "explanation of match or why no match"
}`

  const result = await spark.llm(prompt, 'gpt-4o', true)
  const analysis = JSON.parse(result)
  
  return {
    matches: analysis.matches || false,
    score: analysis.score || 0,
    reason: analysis.reason || 'No analysis available',
  }
}

export const analyzeBargain = analyzeBargainPotential
