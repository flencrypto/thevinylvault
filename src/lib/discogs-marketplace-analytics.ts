import { DiscogsApiConfig, searchDiscogsMarketplace } from './marketplace-discogs'
import { MarketListing } from './types'
import { discogsCache } from './discogs-cache-service'

export interface DiscogsPriceStats {
  releaseId: number
  releaseName: string
  lowestPrice: number
  highestPrice: number
  medianPrice: number
  averagePrice: number
  currency: string
  totalListings: number
  byCondition: Record<string, { count: number; avgPrice: number; minPrice: number; maxPrice: number }>
  byCountry: Record<string, { count: number; avgPrice: number }>
  priceDistribution: Array<{ range: string; count: number }>
  timestamp: string
}

export interface DiscogsHistoricalPrice {
  releaseId: number
  date: string
  lowestPrice: number
  averagePrice: number
  medianPrice: number
  listingCount: number
  currency: string
}

export interface DiscogsPriceAlert {
  id: string
  releaseId: number
  releaseName: string
  targetPrice: number
  currentLowestPrice: number
  currency: string
  triggered: boolean
  createdAt: string
  triggeredAt?: string
}

export interface DiscogsSellerStats {
  username: string
  totalListings: number
  averagePrice: number
  rating: string
  location: string
  conditions: string[]
  priceRange: { min: number; max: number }
}

export interface DiscogsMarketTrend {
  releaseId: number
  releaseName: string
  trend: 'rising' | 'falling' | 'stable' | 'volatile'
  priceChange30d: number
  priceChangePercent30d: number
  priceChange90d?: number
  priceChangePercent90d?: number
  currentMedianPrice: number
  previousMedianPrice30d: number
  previousMedianPrice90d?: number
  velocity: 'fast' | 'moderate' | 'slow'
  listingTurnover: number
  currency: string
  analysis: string
}

export interface DiscogsMarketInsights {
  releaseId: number
  releaseName: string
  marketDepth: 'deep' | 'moderate' | 'shallow' | 'rare'
  liquidityScore: number
  priceStability: 'stable' | 'volatile' | 'unpredictable'
  bestBuyConditions: string[]
  overvaluedListings: number
  undervaluedListings: number
  fairValuePrice: number
  recommendedBuyPrice: number
  recommendedSellPrice: number
  currency: string
  insights: string[]
}

export async function fetchDiscogsPriceStats(
  releaseId: number,
  config: DiscogsApiConfig
): Promise<DiscogsPriceStats | null> {
  const cacheKey = { type: 'price-stats', releaseId }
  const cached = await discogsCache.get<DiscogsPriceStats>(cacheKey)
  
  if (cached) {
    console.log('Cache hit for Discogs price stats')
    return cached
  }

  try {
    const listings = await searchDiscogsMarketplace(
      { query: `discogs-release-id:${releaseId}`, per_page: 100, sort: 'price', sort_order: 'asc' },
      config
    )

    if (listings.length === 0) {
      return null
    }

    const prices = listings.map(l => l.price).filter(p => p > 0)

    const sortedPrices = [...prices].sort((a, b) => a - b)
    const lowestPrice = sortedPrices[0]
    const highestPrice = sortedPrices[sortedPrices.length - 1]
    const medianPrice = calculateMedian(sortedPrices)
    const averagePrice = calculateAverage(sortedPrices)

    const byCondition: Record<string, { count: number; avgPrice: number; minPrice: number; maxPrice: number }> = {}
    listings.forEach(listing => {
      const cond = listing.condition || 'Unknown'
      if (!byCondition[cond]) {
        byCondition[cond] = { count: 0, avgPrice: 0, minPrice: Infinity, maxPrice: 0 }
      }
      byCondition[cond]!.count++
      byCondition[cond]!.avgPrice += listing.price
      byCondition[cond]!.minPrice = Math.min(byCondition[cond]!.minPrice, listing.price)
      byCondition[cond]!.maxPrice = Math.max(byCondition[cond]!.maxPrice, listing.price)
    })

    Object.keys(byCondition).forEach(cond => {
      byCondition[cond]!.avgPrice /= byCondition[cond]!.count
      byCondition[cond]!.avgPrice = Math.round(byCondition[cond]!.avgPrice * 100) / 100
      byCondition[cond]!.minPrice = Math.round(byCondition[cond]!.minPrice * 100) / 100
      byCondition[cond]!.maxPrice = Math.round(byCondition[cond]!.maxPrice * 100) / 100
    })

    const byCountry: Record<string, { count: number; avgPrice: number }> = {}
    listings.forEach(listing => {
      const country = listing.location || 'Unknown'
      if (!byCountry[country]) {
        byCountry[country] = { count: 0, avgPrice: 0 }
      }
      byCountry[country]!.count++
      byCountry[country]!.avgPrice += listing.price
    })

    Object.keys(byCountry).forEach(country => {
      byCountry[country]!.avgPrice /= byCountry[country]!.count
      byCountry[country]!.avgPrice = Math.round(byCountry[country]!.avgPrice * 100) / 100
    })

    const priceDistribution = calculatePriceDistribution(prices)

    const stats: DiscogsPriceStats = {
      releaseId,
      releaseName: listings[0]?.title || 'Unknown Release',
      lowestPrice: Math.round(lowestPrice * 100) / 100,
      highestPrice: Math.round(highestPrice * 100) / 100,
      medianPrice: Math.round(medianPrice * 100) / 100,
      averagePrice: Math.round(averagePrice * 100) / 100,
      currency: listings[0]?.currency || 'USD',
      totalListings: listings.length,
      byCondition,
      byCountry,
      priceDistribution,
      timestamp: new Date().toISOString(),
    }

    await discogsCache.set(cacheKey, stats, 4 * 60 * 60 * 1000)
    console.log('Cached Discogs price stats')

    return stats
  } catch (error) {
    console.error('Failed to fetch Discogs price stats:', error)
    return null
  }
}

export async function trackHistoricalPrices(
  releaseId: number,
  config: DiscogsApiConfig
): Promise<DiscogsHistoricalPrice[]> {
  const historyKey = `discogs-price-history-${releaseId}`
  const existingHistory = await spark.kv.get<DiscogsHistoricalPrice[]>(historyKey) || []

  const stats = await fetchDiscogsPriceStats(releaseId, config)
  if (!stats) {
    return existingHistory
  }

  const today = new Date().toISOString().split('T')[0]
  const existingEntryIndex = existingHistory.findIndex(h => h.date === today)

  const newEntry: DiscogsHistoricalPrice = {
    releaseId,
    date: today,
    lowestPrice: stats.lowestPrice,
    averagePrice: stats.averagePrice,
    medianPrice: stats.medianPrice,
    listingCount: stats.totalListings,
    currency: stats.currency,
  }

  if (existingEntryIndex >= 0) {
    existingHistory[existingEntryIndex] = newEntry
  } else {
    existingHistory.push(newEntry)
  }

  existingHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const maxHistoryDays = 365
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - maxHistoryDays)
  const filteredHistory = existingHistory.filter(h => new Date(h.date) >= cutoffDate)

  await spark.kv.set(historyKey, filteredHistory)

  return filteredHistory
}

export async function analyzeMarketTrend(
  releaseId: number,
  config: DiscogsApiConfig
): Promise<DiscogsMarketTrend | null> {
  const history = await trackHistoricalPrices(releaseId, config)

  if (history.length < 2) {
    return null
  }

  const currentEntry = history[history.length - 1]
  const currentMedianPrice = currentEntry.medianPrice

  const entry30dAgo = history.find(h => {
    const daysDiff = (new Date(currentEntry.date).getTime() - new Date(h.date).getTime()) / (1000 * 60 * 60 * 24)
    return daysDiff >= 28 && daysDiff <= 32
  })

  const entry90dAgo = history.find(h => {
    const daysDiff = (new Date(currentEntry.date).getTime() - new Date(h.date).getTime()) / (1000 * 60 * 60 * 24)
    return daysDiff >= 88 && daysDiff <= 92
  })

  if (!entry30dAgo) {
    return null
  }

  const priceChange30d = currentMedianPrice - entry30dAgo.medianPrice
  const priceChangePercent30d = (priceChange30d / entry30dAgo.medianPrice) * 100

  let priceChange90d: number | undefined
  let priceChangePercent90d: number | undefined
  if (entry90dAgo) {
    priceChange90d = currentMedianPrice - entry90dAgo.medianPrice
    priceChangePercent90d = (priceChange90d / entry90dAgo.medianPrice) * 100
  }

  let trend: 'rising' | 'falling' | 'stable' | 'volatile'
  if (Math.abs(priceChangePercent30d) > 30) {
    trend = 'volatile'
  } else if (priceChangePercent30d > 10) {
    trend = 'rising'
  } else if (priceChangePercent30d < -10) {
    trend = 'falling'
  } else {
    trend = 'stable'
  }

  const recentHistory = history.slice(-7)
  const priceVariance = calculateVariance(recentHistory.map(h => h.medianPrice))
  const volatility = Math.sqrt(priceVariance)

  const listingChanges = recentHistory.map((h, i) => 
    i === 0 ? 0 : h.listingCount - recentHistory[i - 1].listingCount
  )
  const avgListingChange = calculateAverage(listingChanges)

  let velocity: 'fast' | 'moderate' | 'slow'
  if (Math.abs(avgListingChange) > 10) {
    velocity = 'fast'
  } else if (Math.abs(avgListingChange) > 3) {
    velocity = 'moderate'
  } else {
    velocity = 'slow'
  }

  let analysis: string;
  if (trend === 'rising') {
    analysis = `Prices have increased by ${priceChangePercent30d.toFixed(1)}% over the last 30 days. `
    if (velocity === 'fast') {
      analysis += 'High listing turnover suggests strong demand.'
    } else {
      analysis += 'Limited supply is driving prices up.'
    }
  } else if (trend === 'falling') {
    analysis = `Prices have decreased by ${Math.abs(priceChangePercent30d).toFixed(1)}% over the last 30 days. `
    if (velocity === 'fast') {
      analysis += 'Increased supply is putting downward pressure on prices.'
    } else {
      analysis += 'Weak demand is causing price softening.'
    }
  } else if (trend === 'volatile') {
    analysis = `Prices are highly volatile with ${Math.abs(priceChangePercent30d).toFixed(1)}% movement. Market is unstable, wait for stabilization before trading.`
  } else {
    analysis = 'Prices have remained stable over the last 30 days. Good market for both buying and selling.'
  }

  return {
    releaseId,
    releaseName: currentEntry.date,
    trend,
    priceChange30d: Math.round(priceChange30d * 100) / 100,
    priceChangePercent30d: Math.round(priceChangePercent30d * 100) / 100,
    priceChange90d: priceChange90d !== undefined ? Math.round(priceChange90d * 100) / 100 : undefined,
    priceChangePercent90d: priceChangePercent90d !== undefined ? Math.round(priceChangePercent90d * 100) / 100 : undefined,
    currentMedianPrice,
    previousMedianPrice30d: entry30dAgo.medianPrice,
    previousMedianPrice90d: entry90dAgo?.medianPrice,
    velocity,
    listingTurnover: Math.round(avgListingChange * 10) / 10,
    currency: currentEntry.currency,
    analysis,
  }
}

export async function generateMarketInsights(
  releaseId: number,
  config: DiscogsApiConfig
): Promise<DiscogsMarketInsights | null> {
  const stats = await fetchDiscogsPriceStats(releaseId, config)
  const trend = await analyzeMarketTrend(releaseId, config)

  if (!stats) {
    return null
  }

  let marketDepth: 'deep' | 'moderate' | 'shallow' | 'rare'
  if (stats.totalListings > 100) {
    marketDepth = 'deep'
  } else if (stats.totalListings > 30) {
    marketDepth = 'moderate'
  } else if (stats.totalListings > 5) {
    marketDepth = 'shallow'
  } else {
    marketDepth = 'rare'
  }

  const priceRange = stats.highestPrice - stats.lowestPrice
  const priceSpread = priceRange / stats.medianPrice
  
  let priceStability: 'stable' | 'volatile' | 'unpredictable'
  if (priceSpread < 0.5) {
    priceStability = 'stable'
  } else if (priceSpread < 1.5) {
    priceStability = 'volatile'
  } else {
    priceStability = 'unpredictable'
  }

  const liquidityScore = Math.min(100, (stats.totalListings / 50) * 100)

  const conditionPrices = Object.entries(stats.byCondition).map(([cond, data]) => ({
    condition: cond,
    avgPrice: data.avgPrice,
    count: data.count,
  }))

  const bestBuyConditions = conditionPrices
    .filter(cp => cp.count >= 2)
    .sort((a, b) => (a.avgPrice / a.count) - (b.avgPrice / b.count))
    .slice(0, 3)
    .map(cp => cp.condition)

  const fairValuePrice = stats.medianPrice

  const undervaluedThreshold = fairValuePrice * 0.85
  const overvaluedThreshold = fairValuePrice * 1.25

  const undervaluedListings = Object.values(stats.byCondition)
    .reduce((sum, data) => sum + (data.minPrice < undervaluedThreshold ? 1 : 0), 0)

  const overvaluedListings = Object.values(stats.byCondition)
    .reduce((sum, data) => sum + (data.maxPrice > overvaluedThreshold ? 1 : 0), 0)

  const recommendedBuyPrice = Math.round(stats.medianPrice * 0.92 * 100) / 100
  const recommendedSellPrice = Math.round(stats.medianPrice * 1.08 * 100) / 100

  const insights: string[] = []

  if (marketDepth === 'rare') {
    insights.push('Very limited supply - expect difficulty finding this release')
  } else if (marketDepth === 'shallow') {
    insights.push('Limited market liquidity - prices may vary significantly')
  } else if (marketDepth === 'deep') {
    insights.push('Highly liquid market - easy to buy or sell at fair prices')
  }

  if (priceStability === 'volatile') {
    insights.push('Price volatility detected - consider waiting for better opportunities')
  } else if (priceStability === 'stable') {
    insights.push('Stable pricing environment - good time to transact')
  }

  if (trend?.trend === 'rising') {
    insights.push(`Prices trending upward (+${trend.priceChangePercent30d.toFixed(1)}%) - buy soon if interested`)
  } else if (trend?.trend === 'falling') {
    insights.push(`Prices trending downward (${trend.priceChangePercent30d.toFixed(1)}%) - wait for better deals`)
  }

  if (undervaluedListings > 0) {
    insights.push(`${undervaluedListings} potentially undervalued listing(s) detected`)
  }

  if (bestBuyConditions.length > 0) {
    insights.push(`Best value in ${bestBuyConditions.join(', ')} condition`)
  }

  return {
    releaseId,
    releaseName: stats.releaseName,
    marketDepth,
    liquidityScore: Math.round(liquidityScore),
    priceStability,
    bestBuyConditions,
    overvaluedListings,
    undervaluedListings,
    fairValuePrice,
    recommendedBuyPrice,
    recommendedSellPrice,
    currency: stats.currency,
    insights,
  }
}

export async function analyzeSellerPatterns(
  releaseId: number,
  config: DiscogsApiConfig
): Promise<DiscogsSellerStats[]> {
  const listings = await searchDiscogsMarketplace(
    { query: `discogs-release-id:${releaseId}`, per_page: 100 },
    config
  )

  const sellerMap: Record<string, DiscogsSellerStats> = {}

  listings.forEach(listing => {
    const seller = listing.seller || 'Unknown'
    const condition = listing.condition || 'Unknown'
    const location = listing.location || 'Unknown'
    
    if (!sellerMap[seller]) {
      sellerMap[seller] = {
        username: seller,
        totalListings: 0,
        averagePrice: 0,
        rating: 'N/A',
        location: location,
        conditions: [],
        priceRange: { min: Infinity, max: 0 },
      }
    }

    sellerMap[seller]!.totalListings++
    sellerMap[seller]!.averagePrice += listing.price
    sellerMap[seller]!.priceRange.min = Math.min(sellerMap[seller]!.priceRange.min, listing.price)
    sellerMap[seller]!.priceRange.max = Math.max(sellerMap[seller]!.priceRange.max, listing.price)
    
    if (!sellerMap[seller]!.conditions.includes(condition)) {
      sellerMap[seller]!.conditions.push(condition)
    }
  })

  const sellers = Object.values(sellerMap)
  sellers.forEach(seller => {
    seller.averagePrice = Math.round((seller.averagePrice / seller.totalListings) * 100) / 100
    seller.priceRange.min = Math.round(seller.priceRange.min * 100) / 100
    seller.priceRange.max = Math.round(seller.priceRange.max * 100) / 100
  })

  return sellers.sort((a, b) => a.averagePrice - b.averagePrice)
}

export async function createPriceAlert(
  releaseId: number,
  releaseName: string,
  targetPrice: number,
  currency: string
): Promise<DiscogsPriceAlert> {
  const alert: DiscogsPriceAlert = {
    id: `alert-${releaseId}-${Date.now()}`,
    releaseId,
    releaseName,
    targetPrice,
    currentLowestPrice: 0,
    currency,
    triggered: false,
    createdAt: new Date().toISOString(),
  }

  const alertsKey = 'discogs-price-alerts'
  const existingAlerts = await spark.kv.get<DiscogsPriceAlert[]>(alertsKey) || []
  existingAlerts.push(alert)
  await spark.kv.set(alertsKey, existingAlerts)

  return alert
}

export async function checkPriceAlerts(config: DiscogsApiConfig): Promise<DiscogsPriceAlert[]> {
  const alertsKey = 'discogs-price-alerts'
  const alerts = await spark.kv.get<DiscogsPriceAlert[]>(alertsKey) || []

  const triggeredAlerts: DiscogsPriceAlert[] = []

  for (const alert of alerts) {
    if (alert.triggered) continue

    const stats = await fetchDiscogsPriceStats(alert.releaseId, config)
    if (!stats) continue

    alert.currentLowestPrice = stats.lowestPrice

    if (stats.lowestPrice <= alert.targetPrice) {
      alert.triggered = true
      alert.triggeredAt = new Date().toISOString()
      triggeredAlerts.push(alert)
    }
  }

  await spark.kv.set(alertsKey, alerts)

  return triggeredAlerts
}

function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length
}

function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0
  const avg = calculateAverage(numbers)
  const squaredDiffs = numbers.map(n => Math.pow(n - avg, 2))
  return calculateAverage(squaredDiffs)
}

function calculatePriceDistribution(prices: number[]): Array<{ range: string; count: number }> {
  if (prices.length === 0) return []

  const sorted = [...prices].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  
  const bucketCount = Math.min(10, Math.ceil(sorted.length / 5))
  const bucketSize = (max - min) / bucketCount
  
  const buckets: Array<{ range: string; count: number }> = []
  
  for (let i = 0; i < bucketCount; i++) {
    const rangeStart = min + (i * bucketSize)
    const rangeEnd = min + ((i + 1) * bucketSize)
    const count = sorted.filter(p => p >= rangeStart && (i === bucketCount - 1 ? p <= rangeEnd : p < rangeEnd)).length
    
    buckets.push({
      range: `${rangeStart.toFixed(0)}-${rangeEnd.toFixed(0)}`,
      count,
    })
  }
  
  return buckets
}
