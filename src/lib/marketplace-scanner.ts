import { MarketListing, WatchlistItem } from './types'
import { searchEbayVinyl, scanEbayForBargains, EbayApiConfig } from './marketplace-ebay'
import { searchDiscogsMarketplace, scanDiscogsForBargains, DiscogsApiConfig } from './marketplace-discogs'

export interface MarketplaceConfig {
  ebay?: EbayApiConfig
  discogs?: DiscogsApiConfig
  enabledSources: Array<'ebay' | 'discogs'>
}

export interface MarketplaceScanOptions {
  maxPrice?: number
  minPrice?: number
  format?: string
  condition?: string[]
  country?: string
  sortBy?: 'price' | 'date'
  maxResults?: number
}

export async function scanMarketplaces(
  watchlistItems: WatchlistItem[],
  config: MarketplaceConfig,
  options?: MarketplaceScanOptions
): Promise<MarketListing[]> {
  const allListings: MarketListing[] = []
  
  const searchTerms = watchlistItems.map(item => {
    const parts = []
    if (item.artistName) parts.push(item.artistName)
    if (item.releaseTitle) parts.push(item.releaseTitle)
    if (item.pressingDetails) parts.push(item.pressingDetails)
    if (item.searchQuery) parts.push(item.searchQuery)
    return parts.join(' ')
  }).filter(term => term.length > 0)

  if (searchTerms.length === 0) {
    searchTerms.push('vinyl LP')
  }

  if (config.enabledSources.includes('ebay') && config.ebay) {
    try {
      const ebayListings = await scanEbayForBargains(
        searchTerms,
        config.ebay,
        {
          maxPrice: options?.maxPrice,
          includeConditions: options?.condition,
        }
      )
      allListings.push(...ebayListings)
    } catch (error) {
      console.error('eBay scan failed:', error)
    }
  }

  if (config.enabledSources.includes('discogs') && config.discogs) {
    try {
      const discogsListings = await scanDiscogsForBargains(
        searchTerms,
        config.discogs,
        {
          maxPrice: options?.maxPrice,
          format: options?.format,
          country: options?.country,
        }
      )
      allListings.push(...discogsListings)
    } catch (error) {
      console.error('Discogs scan failed:', error)
    }
  }

  if (options?.maxResults) {
    return allListings.slice(0, options.maxResults)
  }

  return allListings
}

export async function searchAllMarketplaces(
  query: string,
  config: MarketplaceConfig,
  options?: MarketplaceScanOptions
): Promise<MarketListing[]> {
  const allListings: MarketListing[] = []

  if (config.enabledSources.includes('ebay') && config.ebay) {
    try {
      const ebayListings = await searchEbayVinyl(
        {
          keywords: query,
          maxPrice: options?.maxPrice,
          minPrice: options?.minPrice,
          condition: options?.condition,
          entriesPerPage: options?.maxResults || 50,
          sortOrder: options?.sortBy === 'price' ? 'PricePlusShippingLowest' : 'BestMatch',
        },
        config.ebay
      )
      allListings.push(...ebayListings)
    } catch (error) {
      console.error('eBay search failed:', error)
    }
  }

  if (config.enabledSources.includes('discogs') && config.discogs) {
    try {
      const discogsListings = await searchDiscogsMarketplace(
        {
          query,
          per_page: options?.maxResults || 50,
          sort: 'price',
          sort_order: 'asc',
          format: options?.format,
          country: options?.country,
        },
        config.discogs
      )

      let filteredListings = discogsListings
      if (options?.maxPrice) {
        filteredListings = discogsListings.filter(l => l.price <= options.maxPrice!)
      }
      if (options?.minPrice) {
        filteredListings = filteredListings.filter(l => l.price >= options.minPrice!)
      }

      allListings.push(...filteredListings)
    } catch (error) {
      console.error('Discogs search failed:', error)
    }
  }

  return allListings
}

export function getDefaultMarketplaceConfig(): MarketplaceConfig {
  return {
    enabledSources: [],
  }
}

export function validateMarketplaceConfig(config: MarketplaceConfig): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (config.enabledSources.length === 0) {
    errors.push('At least one marketplace source must be enabled')
  }

  if (config.enabledSources.includes('ebay') && !config.ebay?.appId) {
    errors.push('eBay App ID is required when eBay is enabled')
  }

  if (config.enabledSources.includes('discogs')) {
    if (!config.discogs?.userToken && (!config.discogs?.consumerKey || !config.discogs?.consumerSecret)) {
      errors.push('Discogs authentication is required (either user token or consumer key/secret)')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
