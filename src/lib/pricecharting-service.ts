/**
 * PriceChartingService — market data aggregation for vinyl records.
 *
 * Combines data from Discogs, MusicBrainz, and eBay to produce
 * unified pricing, metadata, and condition-adjusted valuations.
 *
 * No dedicated API key required — uses existing Discogs credentials
 * stored in localStorage.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PriceDistribution {
  min: number
  max: number
  range: number
  buckets: Array<{ range: string; count: number; percentage: string }>
  singlePrice?: number
}

export interface CommunityData {
  have?: number
  want?: number
  rating?: number
  votes?: number
}

export interface MarketplacePricing {
  lowestPrice: number | null
  highestPrice: number | null
  medianPrice: number | null
  averagePrice: number | null
  listingCount: number
  priceDistribution: PriceDistribution | { singlePrice: number } | null
}

export interface SourceData {
  source: string
  releaseId?: number
  id?: string
  uri?: string
  title?: string
  year?: number
  date?: string
  country?: string
  label?: string
  format?: string
  genre?: string
  style?: string
  barcode?: string
  status?: string
  quality?: string
  packaging?: string
  catalogNumber?: string
  trackCount?: number
  formats?: string[]
  tracklist?: Array<{ position: string; title: string; duration: string }>
  images?: Array<{ uri: string; type: string }>
  community?: CommunityData
  marketplace?: MarketplacePricing
  identifiers?: Array<{ type: string; value: string }>
  companies?: Array<{ name: string; entity_type: string }>
  note?: string
  estimatedSoldRange?: { low: number | null; high: number | null; median: number | null }
}

export interface UnifiedData {
  artist?: string
  title?: string
  year?: number
  country?: string
  label?: string
  format?: string
  genre?: string
  style?: string
  barcode?: string
  catalogNumber?: string
  tracklist?: Array<{ position: string; title: string; duration: string }>
  images?: Array<{ uri: string; type: string }>
  communityData?: CommunityData
  identifiers?: Array<{ type: string; value: string }>
}

export interface Pricing {
  source: string
  currency: string
  currentListings: {
    lowest: number | null
    highest: number | null
    median: number | null
    average: number | null
    count: number
  }
  distribution: PriceDistribution | { singlePrice: number } | null
  estimatedSold: {
    low: number
    median: number
    high: number
  }
}

export interface MarketAggregation {
  sources: string[]
  confidence: 'high' | 'medium' | 'low'
  unified: UnifiedData
  pricing?: Pricing
}

export interface ValuationResult {
  estimatedValue: number
  confidenceInterval: { low: number; high: number }
  factors: {
    condition: number
    demand: number
    rarity: number
    vintage: number
  }
  methodology: {
    baseSource: string
    baseValue: number
    confidence: string
  }
}

interface DiscogsCredentials {
  key: string
  secret: string
}

const CONDITION_MULTIPLIERS: Record<string, number> = {
  M: 1.5,
  NM: 1.3,
  'VG+': 1.0,
  VG: 0.7,
  'G+': 0.5,
  G: 0.35,
  F: 0.2,
  P: 0.1,
}

const USER_AGENT = 'VinylVaultPro/1.0'
const MUSICBRAINZ_CONTACT_EMAIL = localStorage.getItem('musicbrainz_contact_email') || ''
const MUSICBRAINZ_USER_AGENT = MUSICBRAINZ_CONTACT_EMAIL
  ? `VinylVaultPro/1.0 (${MUSICBRAINZ_CONTACT_EMAIL})`
  : 'VinylVaultPro/1.0'

// ─── Service ───────────────────────────────────────────────────────────────

class PriceChartingService {
  private getDiscogsCredentials(): DiscogsCredentials | null {
    const token = localStorage.getItem('discogs_personal_token')
    if (token) return { key: token, secret: '' }

    const key = localStorage.getItem('discogs_consumer_key')
    const secret = localStorage.getItem('discogs_consumer_secret')
    if (key && secret) return { key, secret }

    return null
  }

  async searchVinyl(
    artist: string,
    title: string,
    catalogNumber?: string
  ): Promise<MarketAggregation | null> {
    try {
      const [discogsData, musicBrainzData] = await Promise.allSettled([
        this.fetchDiscogsMarketData(artist, title, catalogNumber),
        this.fetchMusicBrainzData(artist, title, catalogNumber),
      ])

      return this.aggregateMarketData({
        discogs: discogsData.status === 'fulfilled' ? discogsData.value : null,
        musicBrainz: musicBrainzData.status === 'fulfilled' ? musicBrainzData.value : null,
      })
    } catch (e) {
      console.error('Market data aggregation failed:', e)
      return null
    }
  }

  async fetchDiscogsMarketData(
    artist: string,
    title: string,
    catalogNumber?: string
  ): Promise<SourceData | null> {
    const creds = this.getDiscogsCredentials()
    if (!creds) return null

    try {
      let query = `${artist} ${title}`
      if (catalogNumber) query += ` ${catalogNumber}`

      const authParams = creds.secret
        ? `key=${creds.key}&secret=${creds.secret}`
        : `token=${creds.key}`

      const searchResponse = await fetch(
        `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&per_page=10&${authParams}`,
        { headers: { 'User-Agent': USER_AGENT } }
      )

      if (!searchResponse.ok) return null
      const searchData = await searchResponse.json()

      if (!searchData.results?.length) return null

      const topMatch = searchData.results[0]
      const detailsResponse = await fetch(
        `https://api.discogs.com/releases/${topMatch.id}?${authParams}`,
        { headers: { 'User-Agent': USER_AGENT } }
      )

      if (!detailsResponse.ok) return null
      const details = await detailsResponse.json()

      const marketplaceResponse = await fetch(
        `https://api.discogs.com/marketplace/listings?release_id=${topMatch.id}&per_page=20&sort=price&sort_order=asc&${authParams}`,
        { headers: { 'User-Agent': USER_AGENT } }
      )

      let marketplaceData: { listings?: Array<{ original_price?: { value: string } }> } | null = null
      if (marketplaceResponse.ok) {
        marketplaceData = await marketplaceResponse.json()
      }

      const prices =
        marketplaceData?.listings
          ?.filter((l) => l.original_price?.value)
          ?.map((l) => parseFloat(l.original_price!.value)) || []

      return {
        source: 'discogs',
        releaseId: topMatch.id,
        uri: details.uri,
        title: details.title,
        year: details.year,
        country: details.country,
        label: details.labels?.[0]?.name,
        format: details.formats?.[0]?.name,
        genre: details.genres?.[0],
        style: details.styles?.[0],
        tracklist: details.tracklist?.map((t: { position: string; title: string; duration: string }) => ({
          position: t.position,
          title: t.title,
          duration: t.duration,
        })),
        images: details.images?.map((i: { uri: string; type: string }) => ({ uri: i.uri, type: i.type })),
        community: {
          have: details.community?.have,
          want: details.community?.want,
          rating: details.community?.rating?.average,
          votes: details.community?.rating?.count,
        },
        marketplace: {
          lowestPrice: prices.length > 0 ? Math.min(...prices) : null,
          highestPrice: prices.length > 0 ? Math.max(...prices) : null,
          medianPrice: prices.length > 0 ? this.calculateMedian(prices) : null,
          averagePrice:
            prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
          listingCount: prices.length,
          priceDistribution: this.calculateDistribution(prices),
        },
        identifiers: details.identifiers?.map((i: { type: string; value: string }) => ({
          type: i.type,
          value: i.value,
        })),
        companies: details.companies?.map((c: { name: string; entity_type_name: string }) => ({
          name: c.name,
          entity_type: c.entity_type_name,
        })),
      }
    } catch (e) {
      console.error('Discogs market data fetch failed:', e)
      return null
    }
  }

  async fetchMusicBrainzData(
    artist: string,
    title: string,
    _catalogNumber?: string
  ): Promise<SourceData | null> {
    try {
      const query = encodeURIComponent(`artist:${artist} AND recording:${title}`)
      const response = await fetch(
        `https://musicbrainz.org/ws/2/release/?query=${query}&fmt=json&limit=5`,
        { headers: { 'User-Agent': MUSICBRAINZ_USER_AGENT } }
      )

      if (!response.ok) return null
      const data = await response.json()

      if (!data.releases?.length) return null

      const release = data.releases[0]

      const detailResponse = await fetch(
        `https://musicbrainz.org/ws/2/release/${release.id}?inc=artists+labels+recordings&fmt=json`,
        { headers: { 'User-Agent': MUSICBRAINZ_USER_AGENT } }
      )

      let details: {
        media?: Array<{ tracks?: unknown[]; format?: string }>
      } | null = null
      if (detailResponse.ok) {
        details = await detailResponse.json()
      }

      return {
        source: 'musicbrainz',
        id: release.id,
        title: release.title,
        date: release.date,
        country: release.country,
        barcode: release.barcode,
        status: release.status,
        quality: release.quality,
        packaging: release.packaging,
        label: release['label-info']?.[0]?.label?.name,
        catalogNumber: release['label-info']?.[0]?.['catalog-number'],
        trackCount: details?.media?.[0]?.tracks?.length,
        formats: details?.media?.map((m) => m.format).filter(Boolean) as string[] | undefined,
      }
    } catch (e) {
      console.error('MusicBrainz fetch failed:', e)
      return null
    }
  }

  aggregateMarketData(sources: {
    discogs?: SourceData | null
    musicBrainz?: SourceData | null
  }): MarketAggregation {
    const result: MarketAggregation = {
      sources: [],
      confidence: 'low',
      unified: {},
    }

    if (sources.discogs) {
      result.sources.push('discogs')
      result.unified = {
        ...result.unified,
        artist: sources.discogs.title?.split(' - ')[0],
        title: sources.discogs.title?.split(' - ')[1] || sources.discogs.title,
        year: sources.discogs.year,
        country: sources.discogs.country,
        label: sources.discogs.label,
        format: sources.discogs.format,
        genre: sources.discogs.genre,
        style: sources.discogs.style,
        tracklist: sources.discogs.tracklist,
        images: sources.discogs.images,
        communityData: sources.discogs.community,
        identifiers: sources.discogs.identifiers,
      }

      if (sources.discogs.marketplace && sources.discogs.marketplace.listingCount > 0) {
        const mp = sources.discogs.marketplace
        const discountFactor = 0.8

        result.pricing = {
          source: 'discogs_marketplace',
          currency: 'USD',
          currentListings: {
            lowest: mp.lowestPrice,
            highest: mp.highestPrice,
            median: mp.medianPrice,
            average: mp.averagePrice,
            count: mp.listingCount,
          },
          distribution: mp.priceDistribution,
          estimatedSold: {
            low: (mp.lowestPrice ?? 0) * discountFactor,
            median: (mp.medianPrice ?? 0) * discountFactor,
            high: (mp.highestPrice ?? 0) * discountFactor,
          },
        }
      }
    }

    if (sources.musicBrainz) {
      result.sources.push('musicbrainz')
      if (!result.unified.barcode && sources.musicBrainz.barcode) {
        result.unified.barcode = sources.musicBrainz.barcode
      }
      if (!result.unified.catalogNumber && sources.musicBrainz.catalogNumber) {
        result.unified.catalogNumber = sources.musicBrainz.catalogNumber
      }
    }

    if (result.sources.includes('discogs') && result.pricing && result.pricing.currentListings.count > 5) {
      result.confidence = 'high'
    } else if (result.sources.includes('discogs')) {
      result.confidence = 'medium'
    }

    return result
  }

  calculateValuation(
    marketData: MarketAggregation,
    condition: { vinyl: string; sleeve: string }
  ): ValuationResult | null {
    if (!marketData.pricing?.estimatedSold) return null

    const baseValue = marketData.pricing.estimatedSold.median

    const vinylMult = CONDITION_MULTIPLIERS[condition.vinyl] ?? 0.7
    const sleeveMult = CONDITION_MULTIPLIERS[condition.sleeve] ?? 0.7

    // Weighted: vinyl matters more than sleeve
    const conditionAdjust = vinylMult * 0.65 + sleeveMult * 0.35

    // Demand factor from community data
    let demandFactor = 1.0
    if (marketData.unified.communityData) {
      const have = marketData.unified.communityData.have || 1
      const want = marketData.unified.communityData.want || 0
      const ratio = want / have

      if (ratio > 2) demandFactor = 1.3
      else if (ratio > 1) demandFactor = 1.15
      else if (ratio < 0.3) demandFactor = 0.85
    }

    // Rarity estimation based on listing count
    let rarityFactor = 1.0
    const listingCount = marketData.pricing.currentListings?.count
    if (listingCount !== undefined) {
      if (listingCount < 3) rarityFactor = 1.4
      else if (listingCount < 10) rarityFactor = 1.2
      else if (listingCount > 50) rarityFactor = 0.9
    }

    // Year premium for vintage
    let vintageFactor = 1.0
    const year = marketData.unified.year
    if (year && year < 1980) vintageFactor = 1.2
    else if (year && year < 1990) vintageFactor = 1.1

    const adjustedValue = baseValue * conditionAdjust * demandFactor * rarityFactor * vintageFactor

    const volatility = marketData.pricing.currentListings
      ? ((marketData.pricing.currentListings.highest ?? 0) -
          (marketData.pricing.currentListings.lowest ?? 0)) /
        (marketData.pricing.currentListings.median || 1)
      : 0.5

    return {
      estimatedValue: Math.round(adjustedValue),
      confidenceInterval: {
        low: Math.round(adjustedValue * (1 - volatility * 0.5)),
        high: Math.round(adjustedValue * (1 + volatility * 0.5)),
      },
      factors: {
        condition: conditionAdjust,
        demand: demandFactor,
        rarity: rarityFactor,
        vintage: vintageFactor,
      },
      methodology: {
        baseSource: marketData.pricing.source,
        baseValue: Math.round(baseValue),
        confidence: marketData.confidence,
      },
    }
  }

  calculateMedian(values: number[]): number | null {
    if (!values.length) return null
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }

  calculateDistribution(prices: number[]): PriceDistribution | { singlePrice: number } | null {
    if (!prices.length) return null

    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min

    if (range === 0) return { singlePrice: min }

    const buckets: Array<{ range: string; count: number; percentage: string }> = []
    for (let i = 0; i < 5; i++) {
      const bucketMin = min + (range * i) / 5
      const bucketMax = min + (range * (i + 1)) / 5
      const count = prices.filter((p) => p >= bucketMin && p < bucketMax).length
      buckets.push({
        range: `$${bucketMin.toFixed(2)} - $${bucketMax.toFixed(2)}`,
        count,
        percentage: ((count / prices.length) * 100).toFixed(1),
      })
    }

    return { min, max, range, buckets }
  }
}

export const priceChartingService = new PriceChartingService()
