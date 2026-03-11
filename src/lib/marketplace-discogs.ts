import { MarketListing } from './types'

export interface DiscogsSearchParams {
  query?: string
  artist?: string
  release_title?: string
  label?: string
  catalog_number?: string
  format?: string
  country?: string
  year?: string
  genre?: string
  style?: string
  per_page?: number
  page?: number
  sort?: 'listed' | 'price'
  sort_order?: 'asc' | 'desc'
}

export interface DiscogsApiConfig {
  userToken?: string
  consumerKey?: string
  consumerSecret?: string
}

interface DiscogsMarketplaceResponse {
  pagination: {
    items: number
    page: number
    pages: number
    per_page: number
  }
  listings: Array<{
    id: number
    status: string
    ships_from: string
    uri: string
    comments?: string
    seller: {
      username: string
      rating: string
    }
    release: {
      id: number
      description: string
      year?: number
      catalog_number?: string
      format?: string
      images?: Array<{
        uri: string
        type: string
      }>
    }
    price: {
      value: number
      currency: string
    }
    condition: string
    sleeve_condition?: string
    original_price?: {
      value: number
      currency: string
    }
    posted: string
  }>
}

interface DiscogsSearchResponse {
  results: Array<{
    id: number
    type: string
    title: string
    year?: string
    country?: string
    format?: string[]
    label?: string[]
    catno?: string
    thumb?: string
    cover_image?: string
  }>
}

export async function searchDiscogsMarketplace(
  params: DiscogsSearchParams,
  config: DiscogsApiConfig
): Promise<MarketListing[]> {
  const baseUrl = 'https://api.discogs.com/marketplace/search'
  
  const searchParams = new URLSearchParams()
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, value.toString())
    }
  })

  if (!searchParams.has('per_page')) {
    searchParams.append('per_page', '100')
  }

  const headers: HeadersInit = {
    'User-Agent': 'VinylVault/1.0',
  }

  if (config.userToken) {
    headers['Authorization'] = `Discogs token=${config.userToken}`
  } else if (config.consumerKey && config.consumerSecret) {
    headers['Authorization'] = `Discogs key=${config.consumerKey}, secret=${config.consumerSecret}`
  }

  try {
    const response = await fetch(`${baseUrl}?${searchParams.toString()}`, {
      headers,
    })

    if (!response.ok) {
      let errorText = ''
      try {
        errorText = await response.text()
      } catch {
        errorText = 'Unable to read error response'
      }

      if (response.status === 401) {
        throw new Error(`Discogs authentication failed (401). Please check that your Personal Access Token is correct. Go to Settings and verify your token.`)
      } else if (response.status === 404) {
        throw new Error(`Discogs API endpoint not found (404). This usually means your token is invalid or the API endpoint has changed. Please regenerate your Personal Access Token in Discogs Developer Settings.`)
      } else {
        throw new Error(`Discogs API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`)
      }
    }

    const data: DiscogsMarketplaceResponse = await response.json()

    return data.listings.map(listing => {
      const conditionStr = listing.sleeve_condition 
        ? `${listing.condition} / ${listing.sleeve_condition}`
        : listing.condition

      return {
        id: `discogs-${listing.id}`,
        source: 'discogs' as const,
        externalId: listing.id.toString(),
        title: listing.release.description,
        description: listing.comments,
        price: listing.price.value,
        currency: listing.price.currency,
        condition: conditionStr,
        seller: listing.seller.username,
        location: listing.ships_from,
        imageUrls: listing.release.images?.map(img => img.uri) || [],
        listedAt: listing.posted,
        url: `https://www.discogs.com${listing.uri}`,
      }
    })
  } catch (error) {
    console.error('Discogs search error:', error)
    throw error
  }
}

export async function scanDiscogsForBargains(
  searchTerms: string[],
  config: DiscogsApiConfig,
  options?: {
    maxPrice?: number
    format?: string
    country?: string
  }
): Promise<MarketListing[]> {
  const allListings: MarketListing[] = []

  for (const term of searchTerms) {
    try {
      const searchParams: DiscogsSearchParams = {
        query: term,
        per_page: 100,
        sort: 'price',
        sort_order: 'asc',
      }

      if (options?.format) {
        searchParams.format = options.format
      }

      if (options?.country) {
        searchParams.country = options.country
      }

      const listings = await searchDiscogsMarketplace(searchParams, config)
      
      let filteredListings = listings
      if (options?.maxPrice) {
        filteredListings = listings.filter(listing => listing.price <= options.maxPrice!)
      }

      allListings.push(...filteredListings)
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`Failed to search Discogs for "${term}":`, error)
    }
  }

  return allListings
}

export async function getDiscogsReleaseInfo(releaseId: number, config: DiscogsApiConfig) {
  const headers: HeadersInit = {
    'User-Agent': 'VinylVault/1.0',
  }

  if (config.userToken) {
    headers['Authorization'] = `Discogs token=${config.userToken}`
  }

  const response = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
    headers,
  })

  if (!response.ok) {
    throw new Error(`Discogs API error: ${response.status}`)
  }

  return await response.json()
}

export async function testDiscogsConnection(config: DiscogsApiConfig): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    const listings = await searchDiscogsMarketplace(
      {
        query: 'vinyl',
        per_page: 1,
      },
      config
    )
    
    return {
      success: true,
      message: `Discogs API connected successfully. Found ${listings.length} test listing(s).`,
      count: listings.length,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error connecting to Discogs API',
    }
  }
}
