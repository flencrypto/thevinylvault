declare const spark: Window['spark']

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchOptions {
  /** eBay category ID. Defaults to 176985 (Vinyl Records). */
  categoryId?: string
  /** Max results to return (1–200). Default 20. */
  limit?: number
  /** eBay filter string, e.g. "buyingOptions:{FIXED_PRICE},conditions:{USED}" */
  filter?: string
  /** Sort field: "price" | "-price" | "newlyListed" | "endingSoonest" */
  sort?: string
  /** eBay marketplace ID. Defaults to EBAY_US. */
  marketplaceId?: string
}

export interface BrowseSearchResult {
  items: BrowseItem[]
  total: number
  offset: number
  limit: number
}

export interface BrowseItem {
  itemId: string
  title: string
  itemWebUrl: string
  price: { currency: string; value: string }
  buyingOptions: string[]
  condition?: { conditionId: string; conditionDisplayName: string }
  seller?: { username: string; feedbackScore: number; feedbackPercentage: string }
  image?: { imageUrl: string }
  itemLocation?: string
  shippingOptions?: Array<{
    shippingCost: { currency: string; value: string }
    shippingCostType: string
    minEstimatedDeliveryDate?: string
    maxEstimatedDeliveryDate?: string
  }>
}

export interface ListingPreviewInput {
  artist: string
  title: string
  catalogNumber?: string
  condition?: string
  description?: string
  price?: number
  currency?: string
  imageUrls?: string[]
}

export interface ListingPreview {
  title: string
  description: string
  categoryId: string
  price: { currency: string; value: string }
  condition: string
  images: string[]
  marketplaceId: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BROWSE_BASE = 'https://api.ebay.com/buy/browse/v1'
const GRAPHQL_ENDPOINT = 'https://api.ebay.com/marketplace/graphql'
const OAUTH_ENDPOINT = 'https://api.ebay.com/identity/v1/oauth2/token'
const VINYL_CATEGORY_ID = '176985'
const API_KEYS_STORAGE_KEY = 'vinyl-vault-api-keys'

// Token cache TTL: refresh 5 minutes before actual expiry
const TOKEN_BUFFER_MS = 5 * 60 * 1000

/** Maps human-readable vinyl condition labels to eBay condition IDs. */
const CONDITION_ID_MAP: Record<string, string> = {
  'Mint': '1000',
  'Near Mint': '1500',
  'Very Good Plus': '2500',
  'Very Good': '3000',
  'Good Plus': '4000',
  'Good': '5000',
  'Fair': '6000',
  'Poor': '7000',
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class EbayBrowseService {
  private cachedToken: string | null = null
  private tokenExpiresAt = 0

  private async getCredentials(): Promise<{ clientId: string; clientSecret: string }> {
    const apiKeys = await spark.kv.get<{
      ebayClientId?: string
      ebayClientSecret?: string
    }>(API_KEYS_STORAGE_KEY)

    const clientId = apiKeys?.ebayClientId || ''
    const clientSecret = apiKeys?.ebayClientSecret || ''

    if (!clientId || !clientSecret) {
      throw new Error(
        'eBay API credentials not configured. Set Client ID and Client Secret in Settings.'
      )
    }

    return { clientId, clientSecret }
  }

  /**
   * Obtain an eBay App Token via the Client Credentials OAuth flow.
   * Caches the token until close to expiry.
   */
  async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken
    }

    const { clientId, clientSecret } = await this.getCredentials()
    const credentials = btoa(`${clientId}:${clientSecret}`)

    const response = await fetch(OAUTH_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`eBay OAuth ${response.status}: ${text}`)
    }

    const data = (await response.json()) as {
      access_token: string
      expires_in: number
    }

    this.cachedToken = data.access_token
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000 - TOKEN_BUFFER_MS

    return this.cachedToken
  }

  /**
   * Search eBay listings via the Browse API.
   */
  async searchVinylRecords(
    query: string,
    options: SearchOptions = {}
  ): Promise<BrowseSearchResult> {
    const token = await this.getAccessToken()

    const {
      categoryId = VINYL_CATEGORY_ID,
      limit = 20,
      filter = '',
      sort = 'price',
      marketplaceId = 'EBAY_US',
    } = options

    const params = new URLSearchParams({
      q: query,
      category_ids: categoryId,
      limit: String(limit),
      fieldgroups: 'EXTENDED',
    })

    if (filter) params.set('filter', filter)
    if (sort) params.set('sort', sort)

    const response = await fetch(
      `${BROWSE_BASE}/item_summary/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`eBay Browse API ${response.status}: ${text}`)
    }

    const data = (await response.json()) as {
      itemSummaries?: BrowseItem[]
      total?: number
      offset?: number
      limit?: number
    }

    return {
      items: data.itemSummaries ?? [],
      total: data.total ?? 0,
      offset: data.offset ?? 0,
      limit: data.limit ?? limit,
    }
  }

  /**
   * Get full item details for a single eBay listing.
   */
  async getItem(itemId: string): Promise<BrowseItem> {
    const token = await this.getAccessToken()

    const response = await fetch(
      `${BROWSE_BASE}/item/${encodeURIComponent(itemId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
      }
    )

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`eBay Browse API ${response.status}: ${text}`)
    }

    return (await response.json()) as BrowseItem
  }

  /**
   * Execute an arbitrary GraphQL query against the eBay GraphQL API.
   */
  async executeGraphQL(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<unknown> {
    const token = await this.getAccessToken()

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
      body: JSON.stringify({ query, variables: variables ?? {} }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(
        `eBay GraphQL HTTP ${response.status} ${response.statusText}: ${text}`
      )
    }

    const json = (await response.json()) as {
      data?: unknown
      errors?: Array<{ message: string }>
    }

    if (json.errors && json.errors.length > 0) {
      throw new Error(
        `eBay GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`
      )
    }

    if (json.data === undefined) {
      throw new Error('eBay GraphQL response contained no data')
    }

    return json.data
  }

  /**
   * Generate a listing preview for a vinyl record on eBay.
   */
  async createListingPreview(record: ListingPreviewInput): Promise<ListingPreview> {
    const query = [record.artist, record.title].filter(Boolean).join(' ').trim()

    // Pull comparable listings to inform pricing
    let suggestedPrice = record.price ?? 0
    if (!record.price) {
      try {
        const results = await this.searchVinylRecords(query, { limit: 5, sort: 'price' })
        if (results.items.length > 0) {
          const prices = results.items.map((i) => parseFloat(i.price.value)).filter((p) => p > 0)
          suggestedPrice = prices.length > 0
            ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
            : 0
        }
      } catch {
        // Pricing lookup is best-effort
      }
    }

    const currency = record.currency ?? 'USD'
    const conditionId = CONDITION_ID_MAP[record.condition ?? ''] ?? '3000'

    const description = record.description
      ?? `${record.artist} - ${record.title}${record.catalogNumber ? ` (${record.catalogNumber})` : ''}. Vinyl record in ${record.condition ?? 'Very Good'} condition.`

    return {
      title: `${record.artist} - ${record.title} Vinyl LP`.slice(0, 80),
      description,
      categoryId: VINYL_CATEGORY_ID,
      price: { currency, value: String(suggestedPrice) },
      condition: conditionId,
      images: record.imageUrls ?? [],
      marketplaceId: 'EBAY_US',
    }
  }
}

export const ebayBrowseService = new EbayBrowseService()
