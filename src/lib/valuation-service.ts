import { CollectionItem, PriceEstimate, MediaGrade, SleeveGrade } from './types'

export interface ComparableSale {
  id: string
  source: 'ebay' | 'discogs' | 'internal'
  externalId: string
  title: string
  soldPrice: number
  currency: string
  conditionMedia: MediaGrade | string
  conditionSleeve: SleeveGrade | string
  soldAt: string
  sellerCountry: string
  url?: string
  pressing?: string
  catalogNumber?: string
}

export interface ValuationExplanation {
  driver: string
  impact: number
  description: string
}

export interface DetailedPriceEstimate {
  estimateLow: number
  estimateMid: number
  estimateHigh: number
  currency: string
  confidenceScore: number
  drivers?: Array<{ name: string; impact: number }>
  comparableSalesCount: number
  explanations: ValuationExplanation[]
  comparableSalesData: ComparableSale[]
  conditionAdjustment: number
  sellerRecommendedPrice?: number
  marketTrend?: 'rising' | 'stable' | 'falling'
  priceHistory?: Array<{ date: string; price: number }>
}

export async function fetchComparableSales(
  item: CollectionItem,
  options?: {
    maxResults?: number
    recencyDays?: number
    includeInternal?: boolean
  }
): Promise<ComparableSale[]> {
  const maxResults = options?.maxResults || 20
  const recencyDays = options?.recencyDays || 90
  const includeInternal = options?.includeInternal !== false

  const fetches: Promise<ComparableSale[]>[] = [
    fetchEbayComparableSales(item, maxResults / 2, recencyDays),
    fetchDiscogsComparableSales(item, maxResults / 2, recencyDays),
    ...(includeInternal ? [fetchInternalComparableSales(item)] : []),
  ]

  const results = await Promise.allSettled(fetches)

  const comps: ComparableSale[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      comps.push(...result.value)
    } else {
      console.warn('Failed to fetch comparable sales:', result.reason)
    }
  }

  return comps
    .sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime())
    .slice(0, maxResults)
}

async function fetchEbayComparableSales(
  item: CollectionItem,
  maxResults: number,
  recencyDays: number
): Promise<ComparableSale[]> {
  const configStr = await spark.kv.get<string>('marketplace-config')
  if (!configStr) return []

  const config = JSON.parse(configStr)
  if (!config.ebay?.enabled || !config.ebay?.appId) return []

  const searchQuery = `${item.artistName} ${item.releaseTitle} ${item.format} vinyl`
  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - recencyDays)

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': config.ebay.appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': '',
    'keywords': searchQuery,
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'itemFilter(1).name': 'EndTimeTo',
    'itemFilter(1).value': toDate.toISOString(),
    'itemFilter(2).name': 'EndTimeFrom',
    'itemFilter(2).value': fromDate.toISOString(),
    'paginationInput.entriesPerPage': maxResults.toString(),
    'sortOrder': 'EndTimeSoonest',
  })

  const url = `https://svcs.ebay.com/services/search/FindingService/v1?${params.toString()}`

  const response = await fetch(url)
  const data = await response.json()

  const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || []

  return items.map((ebayItem: any) => {
    const itemId = ebayItem.itemId?.[0] || ''
    const title = ebayItem.title?.[0] || ''
    const price = parseFloat(ebayItem.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0')
    const currency = ebayItem.sellingStatus?.[0]?.currentPrice?.[0]?.['@currencyId'] || 'USD'
    const endTime = ebayItem.listingInfo?.[0]?.endTime?.[0] || new Date().toISOString()
    const country = ebayItem.country?.[0] || 'Unknown'
    const viewUrl = ebayItem.viewItemURL?.[0] || ''

    return {
      id: `ebay-${itemId}`,
      source: 'ebay' as const,
      externalId: itemId,
      title,
      soldPrice: price,
      currency,
      conditionMedia: 'Unknown',
      conditionSleeve: 'Unknown',
      soldAt: endTime,
      sellerCountry: country,
      url: viewUrl,
    }
  })
}

async function fetchDiscogsComparableSales(
  item: CollectionItem,
  maxResults: number,
  recencyDays: number
): Promise<ComparableSale[]> {
  const configStr = await spark.kv.get<string>('marketplace-config')
  if (!configStr) return []

  const config = JSON.parse(configStr)
  if (!config.discogs?.enabled || !config.discogs?.personalAccessToken) return []

  return []
}

async function fetchInternalComparableSales(item: CollectionItem): Promise<ComparableSale[]> {
  const allItemsStr = await spark.kv.get<string>('collection-items')
  if (!allItemsStr) return []

  const allItems: CollectionItem[] = JSON.parse(allItemsStr)

  return allItems
    .filter(i => 
      i.status === 'sold' &&
      i.artistName === item.artistName &&
      i.releaseTitle === item.releaseTitle &&
      i.purchasePrice
    )
    .map(i => ({
      id: `internal-${i.id}`,
      source: 'internal' as const,
      externalId: i.id,
      title: `${i.artistName} - ${i.releaseTitle}`,
      soldPrice: i.purchasePrice!,
      currency: i.purchaseCurrency,
      conditionMedia: i.condition.mediaGrade,
      conditionSleeve: i.condition.sleeveGrade,
      soldAt: i.updatedAt,
      sellerCountry: i.country,
      pressing: i.catalogNumber,
      catalogNumber: i.catalogNumber,
    }))
}

export async function generateDetailedValuation(
  item: CollectionItem,
  comps?: ComparableSale[]
): Promise<DetailedPriceEstimate> {
  const comparableSales = comps || await fetchComparableSales(item, { maxResults: 20, recencyDays: 90 })

  const conditionAdjustment = calculateConditionAdjustment(
    item.condition.mediaGrade,
    item.condition.sleeveGrade
  )

  let baseValue = 0
  let confidenceScore = 0.3
  const explanations: ValuationExplanation[] = []

  if (comparableSales.length > 0) {
    const recentComps = comparableSales.filter(comp => {
      const daysSinceSale = (Date.now() - new Date(comp.soldAt).getTime()) / (1000 * 60 * 60 * 24)
      return daysSinceSale <= 30
    })

    const allCompPrices = comparableSales.map(c => normalizeToGBP(c.soldPrice, c.currency))
    const recentCompPrices = recentComps.map(c => normalizeToGBP(c.soldPrice, c.currency))

    const medianAllTime = median(allCompPrices)
    const medianRecent = recentCompPrices.length > 0 ? median(recentCompPrices) : medianAllTime

    baseValue = medianRecent

    if (recentCompPrices.length >= 3) {
      confidenceScore = 0.85
      explanations.push({
        driver: 'Recent sold comparables',
        impact: 0.45,
        description: `${recentCompPrices.length} recent sales found (last 30 days), median £${medianRecent.toFixed(2)}`
      })
    } else if (allCompPrices.length >= 3) {
      confidenceScore = 0.65
      explanations.push({
        driver: 'Historical comparables',
        impact: 0.35,
        description: `${allCompPrices.length} sales found (last 90 days), median £${medianAllTime.toFixed(2)}`
      })
    } else {
      confidenceScore = 0.40
      explanations.push({
        driver: 'Limited comparables',
        impact: 0.20,
        description: `Only ${allCompPrices.length} sales found - estimate based on limited data`
      })
    }
  } else {
    baseValue = calculateHeuristicBaseValue(item)
    confidenceScore = 0.30
    explanations.push({
      driver: 'Heuristic estimation',
      impact: 0.20,
      description: 'No comparable sales found - estimate based on format, year, and pressing signals'
    })
  }

  const rarityMultiplier = calculateRarityMultiplier(item)
  explanations.push({
    driver: 'Pressing rarity',
    impact: rarityMultiplier > 1.0 ? 0.25 : 0.10,
    description: rarityMultiplier > 1.0 
      ? `Original/rare pressing detected (${((rarityMultiplier - 1) * 100).toFixed(0)}% premium)`
      : 'Standard pressing'
  })

  const adjustedValue = baseValue * conditionAdjustment * rarityMultiplier

  const estimateMid = adjustedValue
  const estimateLow = adjustedValue * 0.75
  const estimateHigh = adjustedValue * 1.35

  explanations.push({
    driver: 'Condition adjustment',
    impact: 0.30,
    description: `${item.condition.mediaGrade}/${item.condition.sleeveGrade} grading applies ${((conditionAdjustment - 1) * 100).toFixed(0)}% adjustment`
  })

  const sellerRecommendedPrice = calculateSellerRecommendedPrice(estimateMid, confidenceScore)

  const marketTrend = calculateMarketTrend(comparableSales)

  const priceHistory = generatePriceHistory(comparableSales)

  return {
    estimateLow: Math.round(estimateLow * 100) / 100,
    estimateMid: Math.round(estimateMid * 100) / 100,
    estimateHigh: Math.round(estimateHigh * 100) / 100,
    currency: item.purchaseCurrency || 'GBP',
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    drivers: explanations.map(e => ({ name: e.driver, impact: e.impact })),
    comparableSalesCount: comparableSales.length,
    explanations,
    comparableSalesData: comparableSales,
    conditionAdjustment,
    sellerRecommendedPrice,
    marketTrend,
    priceHistory,
  }
}

function calculateConditionAdjustment(mediaGrade: MediaGrade, sleeveGrade: SleeveGrade): number {
  const gradeValues: Record<string, number> = {
    M: 1.50,
    NM: 1.30,
    EX: 1.10,
    'VG+': 1.00,
    VG: 0.75,
    G: 0.45,
    F: 0.25,
    P: 0.15,
  }

  const mediaValue = gradeValues[mediaGrade] || 1.0
  const sleeveValue = gradeValues[sleeveGrade] || 1.0

  return (mediaValue * 0.65 + sleeveValue * 0.35)
}

function calculateRarityMultiplier(item: CollectionItem): number {
  let multiplier = 1.0

  const isOriginalPressing = item.catalogNumber?.toLowerCase().includes('1st') || 
                            item.notes?.toLowerCase().includes('original press') ||
                            item.notes?.toLowerCase().includes('first press')
  
  if (isOriginalPressing) multiplier *= 1.4

  if (item.country === 'UK' && item.year < 1970) multiplier *= 1.3
  if (item.country === 'US' && item.year < 1965) multiplier *= 1.25

  if (item.format === 'Boxset') multiplier *= 1.3

  const isPromo = item.notes?.toLowerCase().includes('promo') ||
                  item.notes?.toLowerCase().includes('promotional')
  if (isPromo) multiplier *= 1.5

  const isTestPressing = item.notes?.toLowerCase().includes('test press')
  if (isTestPressing) multiplier *= 2.0

  return multiplier
}

function calculateHeuristicBaseValue(item: CollectionItem): number {
  const yearFactor = item.year < 1960 ? 2.0 : 
                     item.year < 1970 ? 1.6 : 
                     item.year < 1980 ? 1.3 : 
                     item.year < 1990 ? 1.1 : 1.0

  const formatFactor = item.format === 'LP' ? 1.2 : 
                       item.format === 'Boxset' ? 2.5 : 
                       item.format === '7in' ? 0.6 : 1.0

  const hashValue = hashString(item.artistName + item.releaseTitle)
  const basePrice = 18 + (hashValue % 82)

  return basePrice * yearFactor * formatFactor
}

function calculateSellerRecommendedPrice(estimateMid: number, confidence: number): number {
  if (confidence >= 0.8) {
    return Math.round(estimateMid * 1.15 * 100) / 100
  } else if (confidence >= 0.6) {
    return Math.round(estimateMid * 1.10 * 100) / 100
  } else {
    return Math.round(estimateMid * 1.05 * 100) / 100
  }
}

function calculateMarketTrend(comps: ComparableSale[]): 'rising' | 'stable' | 'falling' {
  if (comps.length < 4) return 'stable'

  const sorted = [...comps].sort((a, b) => 
    new Date(a.soldAt).getTime() - new Date(b.soldAt).getTime()
  )

  const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2))
  const secondHalf = sorted.slice(Math.floor(sorted.length / 2))

  const avgFirst = average(firstHalf.map(c => normalizeToGBP(c.soldPrice, c.currency)))
  const avgSecond = average(secondHalf.map(c => normalizeToGBP(c.soldPrice, c.currency)))

  const change = (avgSecond - avgFirst) / avgFirst

  if (change > 0.15) return 'rising'
  if (change < -0.15) return 'falling'
  return 'stable'
}

function generatePriceHistory(comps: ComparableSale[]): Array<{ date: string; price: number }> {
  return comps
    .map(comp => ({
      date: comp.soldAt,
      price: normalizeToGBP(comp.soldPrice, comp.currency),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

function normalizeToGBP(amount: number, currency: string): number {
  const rates: Record<string, number> = {
    GBP: 1.0,
    USD: 0.79,
    EUR: 0.85,
  }
  return amount * (rates[currency] || 1.0)
}

function median(numbers: number[]): number {
  if (numbers.length === 0) return 0
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash)
}
