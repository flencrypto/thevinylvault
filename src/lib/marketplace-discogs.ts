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

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      if (error instanceof Error && error.message.includes('429')) {
        const delay = initialDelay * Math.pow(2, attempt)
        console.warn(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      if (error instanceof Error && (
        error.message.includes('401') || 
        error.message.includes('404') ||
        error.message.includes('Authentication')
      )) {
        throw error
      }
      
      if (attempt === maxRetries - 1) {
        throw error
      }
      
      const delay = initialDelay * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError || new Error('All retry attempts failed')
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
    'User-Agent': 'VinylVault/1.0 +https://github.com/vinylvault',
  }

  if (config.userToken) {
    headers['Authorization'] = `Discogs token=${config.userToken.trim()}`
  } else if (config.consumerKey && config.consumerSecret) {
    headers['Authorization'] = `Discogs key=${config.consumerKey}, secret=${config.consumerSecret}`
  }

  return retryWithBackoff(async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(`${baseUrl}?${searchParams.toString()}`, {
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorText = ''
        let errorData: any = null
        
        try {
          errorData = await response.json()
          errorText = errorData.message || JSON.stringify(errorData)
        } catch {
          try {
            errorText = await response.text()
          } catch {
            errorText = 'Unable to read error response'
          }
        }

        if (response.status === 401) {
          throw new Error(`Discogs authentication failed (401). Please check that your Personal Access Token is correct. Go to Settings and verify your token.`)
        } else if (response.status === 404) {
          throw new Error(`Discogs API endpoint not found (404). This usually means your token is invalid or the API endpoint has changed. Please regenerate your Personal Access Token in Discogs Developer Settings.`)
        } else if (response.status === 429) {
          throw new Error(`Discogs rate limit exceeded (429). Too many requests.`)
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
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Discogs search timed out after 30 seconds. Please try again with more specific search criteria.')
      }
      
      throw error
    }
  })
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
  if (!config.userToken) {
    return {
      success: false,
      message: 'No Personal Access Token provided. Please add your Discogs token in Settings.',
    }
  }

  const trimmedToken = config.userToken.trim()

  if (trimmedToken.length < 20) {
    return {
      success: false,
      message: 'Token appears too short. Please check you copied the complete Personal Access Token from Discogs Developer Settings.',
    }
  }

  try {
    const headers: HeadersInit = {
      'User-Agent': 'VinylVault/1.0 +https://github.com/vinylvault',
      'Authorization': `Discogs token=${trimmedToken}`,
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch('https://api.discogs.com/database/search?q=vinyl&type=release&per_page=1', {
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId))

    if (!response.ok) {
      let errorText = ''
      let errorData: any = null
      
      try {
        errorData = await response.json()
        errorText = errorData.message || JSON.stringify(errorData)
      } catch {
        try {
          errorText = await response.text()
        } catch {
          errorText = 'Unable to read error details'
        }
      }

      if (response.status === 401) {
        return {
          success: false,
          message: `Authentication failed (401). Your Personal Access Token is invalid or expired. Go to discogs.com/settings/developers → Personal Access Tokens → Generate new token, then paste it here.`,
        }
      } else if (response.status === 404) {
        return {
          success: false,
          message: `Resource not found (404). This usually means the token format is incorrect. Please ensure you're using a Personal Access Token (not OAuth credentials). Token should be a long alphanumeric string. Details: ${errorText}`,
        }
      } else if (response.status === 429) {
        return {
          success: false,
          message: `Rate limit exceeded (429). Discogs allows 60 requests/minute. Please wait a moment and try again.`,
        }
      } else if (response.status >= 500) {
        return {
          success: false,
          message: `Discogs server error (${response.status}). The API may be temporarily unavailable. Please try again in a few minutes.`,
        }
      } else {
        return {
          success: false,
          message: `Discogs API error: ${response.status} - ${errorText}`,
        }
      }
    }

    const data = await response.json()
    const resultCount = data.results?.length || 0
    const totalResults = data.pagination?.items || 0
    
    return {
      success: true,
      message: `✓ Connected successfully! Your Discogs API is working properly. Database has ${totalResults.toLocaleString()} total vinyl releases.`,
      count: resultCount,
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'Connection timed out after 15 seconds. Please check your internet connection and try again.',
        }
      }
      
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        return {
          success: false,
          message: 'Network error: Unable to reach Discogs API. Please check your internet connection.',
        }
      }

      return {
        success: false,
        message: `Connection error: ${error.message}`,
      }
    }

    return {
      success: false,
      message: 'Unknown error connecting to Discogs API. Please try again.',
    }
  }
}
