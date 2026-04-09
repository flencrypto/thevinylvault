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
  // Merge marketplace-specific credentials with global settings so that
  // credentials entered in the Settings view are used automatically.
  config = resolveMarketplaceConfig(config)

  const allListings: MarketListing[] = []
  
  const searchTerms: string[] = watchlistItems.map(item => {
    const parts: string[] = []
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
  // Merge marketplace-specific credentials with global settings so that
  // credentials entered in the Settings view are used automatically.
  config = resolveMarketplaceConfig(config)

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

/** Safe localStorage read that returns '' in environments without localStorage. */
function safeLS(key: string): string {
  try {
    return (typeof localStorage !== 'undefined' && localStorage.getItem(key)) || ''
  } catch {
    return ''
  }
}

function resolveDiscogsConfig(config?: DiscogsApiConfig): DiscogsApiConfig | undefined {
  if (!config) {
    const globalDiscogsToken = safeLS('discogs_personal_token')
    if (globalDiscogsToken) {
      return {
        userToken: globalDiscogsToken,
        consumerKey: undefined,
        consumerSecret: undefined,
      }
    }

    const globalDiscogsKey = safeLS('discogs_consumer_key')
    const globalDiscogsSecret = safeLS('discogs_consumer_secret')
    if (globalDiscogsKey && globalDiscogsSecret) {
      return {
        userToken: undefined,
        consumerKey: globalDiscogsKey,
        consumerSecret: globalDiscogsSecret,
      }
    }

    return undefined
  }

  const {
    userToken,
    consumerKey,
    consumerSecret,
    ...rest
  } = config

  if (userToken) {
    return {
      ...rest,
      userToken,
      consumerKey: undefined,
      consumerSecret: undefined,
    }
  }

  if (consumerKey && consumerSecret) {
    return {
      ...rest,
      userToken: undefined,
      consumerKey,
      consumerSecret,
    }
  }

  const globalDiscogsToken = safeLS('discogs_personal_token')
  if (globalDiscogsToken) {
    return {
      ...rest,
      userToken: globalDiscogsToken,
      consumerKey: undefined,
      consumerSecret: undefined,
    }
  }

  const globalDiscogsKey = safeLS('discogs_consumer_key')
  const globalDiscogsSecret = safeLS('discogs_consumer_secret')
  if (globalDiscogsKey && globalDiscogsSecret) {
    return {
      ...rest,
      userToken: undefined,
      consumerKey: globalDiscogsKey,
      consumerSecret: globalDiscogsSecret,
    }
  }

  return config
}

/**
 * Reads Discogs and eBay credentials from localStorage (set by the global
 * Settings view) and merges them into the given marketplace config as
 * fallbacks for any fields that are not already explicitly set.
 *
 * This allows the marketplace scanner to work automatically once credentials
 * are entered in the app's Settings section, without requiring the user to
 * re-enter them in the marketplace configuration dialog.
 */
export function resolveMarketplaceConfig(config: MarketplaceConfig): MarketplaceConfig {
  let resolved = { ...config }

  const resolvedDiscogs = resolveDiscogsConfig(resolved.discogs)
  if (resolvedDiscogs) {
    resolved = {
      ...resolved,
      discogs: resolvedDiscogs,
    }
  }

  // Resolve eBay credentials from global settings
  const globalEbayAppId = safeLS('ebay_client_id') || safeLS('ebay_app_id')

  if (globalEbayAppId) {
    resolved = {
      ...resolved,
      ebay: {
        appId: resolved.ebay?.appId || globalEbayAppId,
        marketplaceId: resolved.ebay?.marketplaceId,
      },
    }
  }

  return resolved
}

/**
 * Returns true when Discogs credentials are available either from the
 * marketplace config itself or from the global settings (localStorage).
 */
export function isDiscogsConfigured(config?: MarketplaceConfig['discogs']): boolean {
  if (config?.userToken) return true
  if (config?.consumerKey && config?.consumerSecret) return true
  const token = safeLS('discogs_personal_token')
  if (token) return true
  const key = safeLS('discogs_consumer_key')
  const secret = safeLS('discogs_consumer_secret')
  return !!(key && secret)
}

/**
 * Returns true when eBay credentials are available either from the
 * marketplace config itself or from the global settings (localStorage).
 */
export function isEbayConfigured(config?: MarketplaceConfig['ebay']): boolean {
  if (config?.appId) return true
  return !!(safeLS('ebay_client_id') || safeLS('ebay_app_id'))
}

export function validateMarketplaceConfig(config: MarketplaceConfig): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (config.enabledSources.length === 0) {
    errors.push('At least one marketplace source must be enabled')
  }

  if (config.enabledSources.includes('ebay') && !isEbayConfigured(config.ebay)) {
    errors.push('eBay App ID is required when eBay is enabled')
  }

  if (config.enabledSources.includes('discogs') && !isDiscogsConfigured(config.discogs)) {
    errors.push('Discogs authentication is required (either user token or consumer key/secret)')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
