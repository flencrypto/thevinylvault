import { MarketListing } from './types'

export interface EbaySearchParams {
  keywords?: string
  categoryId?: string
  sortOrder?: 'BestMatch' | 'CurrentPriceHighest' | 'EndTimeSoonest' | 'PricePlusShippingLowest'
  maxPrice?: number
  minPrice?: number
  condition?: string[]
  entriesPerPage?: number
}

export interface EbayApiConfig {
  appId: string
  marketplaceId?: string
}

interface EbaySearchResponse {
  findItemsAdvancedResponse: [{
    searchResult: [{
      item?: Array<{
        itemId: [string]
        title: [string]
        galleryURL?: [string]
        viewItemURL: [string]
        location?: [string]
        country?: [string]
        sellingStatus: [{
          currentPrice: [{
            __value__: string
            '@currencyId': string
          }]
        }]
        listingInfo: [{
          listingType?: [string]
          startTime?: [string]
          endTime?: [string]
        }]
        condition?: [{
          conditionDisplayName?: [string]
        }]
        sellerInfo?: [{
          sellerUserName?: [string]
        }]
      }>
    }]
  }]
}

export async function searchEbayVinyl(
  params: EbaySearchParams,
  config: EbayApiConfig
): Promise<MarketListing[]> {
  const baseUrl = 'https://svcs.ebay.com/services/search/FindingService/v1'
  
  const searchParams = new URLSearchParams({
    'OPERATION-NAME': 'findItemsAdvanced',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': config.appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': '',
    'paginationInput.entriesPerPage': (params.entriesPerPage || 50).toString(),
    'sortOrder': params.sortOrder || 'BestMatch',
  })

  if (params.keywords) {
    searchParams.append('keywords', params.keywords)
  }

  if (params.categoryId) {
    searchParams.append('categoryId', params.categoryId)
  } else {
    searchParams.append('categoryId', '176985')
  }

  let filterIndex = 0
  
  if (params.minPrice !== undefined) {
    searchParams.append(`itemFilter(${filterIndex}).name`, 'MinPrice')
    searchParams.append(`itemFilter(${filterIndex}).value`, params.minPrice.toString())
    filterIndex++
  }

  if (params.maxPrice !== undefined) {
    searchParams.append(`itemFilter(${filterIndex}).name`, 'MaxPrice')
    searchParams.append(`itemFilter(${filterIndex}).value`, params.maxPrice.toString())
    filterIndex++
  }

  if (params.condition && params.condition.length > 0) {
    searchParams.append(`itemFilter(${filterIndex}).name`, 'Condition')
    params.condition.forEach((cond, idx) => {
      searchParams.append(`itemFilter(${filterIndex}).value(${idx})`, cond)
    })
    filterIndex++
  }

  searchParams.append(`itemFilter(${filterIndex}).name`, 'ListingType')
  searchParams.append(`itemFilter(${filterIndex}).value(0)`, 'FixedPrice')
  searchParams.append(`itemFilter(${filterIndex}).value(1)`, 'Auction')

  try {
    const response = await fetch(`${baseUrl}?${searchParams.toString()}`)
    
    if (!response.ok) {
      throw new Error(`eBay API error: ${response.status} ${response.statusText}`)
    }

    const data: EbaySearchResponse = await response.json()
    
    const searchResult = data.findItemsAdvancedResponse?.[0]?.searchResult?.[0]
    const items = searchResult?.item || []

    return items.map(item => {
      const price = parseFloat(item.sellingStatus[0].currentPrice[0].__value__)
      const currency = item.sellingStatus[0].currentPrice[0]['@currencyId']
      
      return {
        id: `ebay-${item.itemId[0]}`,
        source: 'ebay' as const,
        externalId: item.itemId[0],
        title: item.title[0],
        price,
        currency,
        condition: item.condition?.[0]?.conditionDisplayName?.[0],
        seller: item.sellerInfo?.[0]?.sellerUserName?.[0] || 'Unknown',
        location: item.location?.[0],
        imageUrls: item.galleryURL ? [item.galleryURL[0]] : [],
        listedAt: item.listingInfo[0].startTime?.[0] || new Date().toISOString(),
        url: item.viewItemURL[0],
      }
    })
  } catch (error) {
    console.error('eBay search error:', error)
    throw error
  }
}

export async function scanEbayForBargains(
  searchTerms: string[],
  config: EbayApiConfig,
  options?: {
    maxPrice?: number
    includeConditions?: string[]
  }
): Promise<MarketListing[]> {
  const allListings: MarketListing[] = []

  for (const term of searchTerms) {
    try {
      const listings = await searchEbayVinyl(
        {
          keywords: term,
          maxPrice: options?.maxPrice,
          condition: options?.includeConditions,
          entriesPerPage: 100,
          sortOrder: 'PricePlusShippingLowest',
        },
        config
      )
      
      allListings.push(...listings)
    } catch (error) {
      console.error(`Failed to search eBay for "${term}":`, error)
    }
  }

  return allListings
}
