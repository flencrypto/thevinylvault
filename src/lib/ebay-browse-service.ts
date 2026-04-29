import {
  EBAY_DEFAULT_SCOPE,
  EBAY_GRANTED_SCOPES,
  validateScopes,
  type ScopeValidationResult,
} from './ebay-oauth-scopes'

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

/**
 * Safely resolve `localStorage` without throwing. Property access on
 * `window.localStorage` (or `globalThis.localStorage`) can raise a
 * `SecurityError` in sandboxed/blocked-storage contexts (some privacy
 * modes, third-party iframes, etc.) — even before any method is called.
 * Returns `undefined` when storage is unreachable for any reason.
 */
function resolveLocalStorage(): Storage | undefined {
  try {
    if (typeof window !== 'undefined') {
      const ls = window.localStorage
      if (ls) return ls
    }
  } catch {
    // window.localStorage threw — fall through to globalThis.
  }
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage
    if (ls) return ls
  } catch {
    // globalThis.localStorage threw — give up.
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class EbayBrowseService {
  /** Cache of access tokens keyed by sorted-scope-string. */
  private tokenCache = new Map<string, { token: string; expiresAt: number }>()

  /**
   * The set of scopes Vinylasis is permitted to request via the Client
   * Credentials grant. Returns a defensive copy.
   */
  getGrantedScopes(): string[] {
    return [...EBAY_GRANTED_SCOPES]
  }

  /**
   * Validate that a requested scope (or scope list) is a subset of the
   * granted scopes. Pure helper — does not perform any I/O.
   */
  validateScopes(scopes: string | readonly string[] | undefined): ScopeValidationResult {
    return validateScopes(scopes)
  }

  private async getCredentials(): Promise<{ clientId: string; clientSecret: string }> {
    let clientId = ''
    let clientSecret = ''

    // Preferred source: Spark KV under the same key SettingsView writes to.
    try {
      const sparkKv = (globalThis as { spark?: { kv?: { get: <T>(k: string) => Promise<T | undefined> } } }).spark?.kv
      if (sparkKv && typeof sparkKv.get === 'function') {
        const apiKeys = await sparkKv.get<{
          ebayClientId?: string
          ebayClientSecret?: string
        }>(API_KEYS_STORAGE_KEY)
        clientId = apiKeys?.ebayClientId || ''
        clientSecret = apiKeys?.ebayClientSecret || ''
      }
    } catch {
      // KV unavailable — fall through to localStorage.
    }

    // Fallback: legacy localStorage keys mirrored by SettingsView.
    if (!clientId || !clientSecret) {
      const ls = resolveLocalStorage()
      if (ls) {
        try {
          clientId = clientId || ls.getItem('ebay_client_id') || ls.getItem('ebay_app_id') || ''
          clientSecret = clientSecret || ls.getItem('ebay_client_secret') || ''
        } catch {
          // localStorage may be blocked — leave empty so the explicit error fires.
        }
      }
    }

    if (!clientId || !clientSecret) {
      throw new Error(
        'eBay API credentials not configured. Set Client ID and Client Secret in Settings.'
      )
    }

    return { clientId, clientSecret }
  }

  /**
   * True iff Client ID + Client Secret are present somewhere we can read them.
   * Useful for callers that want to decide whether to even attempt OAuth.
   */
  async hasCredentials(): Promise<boolean> {
    try {
      await this.getCredentials()
      return true
    } catch {
      return false
    }
  }

  /**
   * Obtain an eBay App Token via the Client Credentials OAuth flow.
   * Caches the token (per scope-set) until close to expiry.
   *
   * @param scopes Optional list/space-separated string of scopes. Must be
   *   a subset of `EBAY_GRANTED_SCOPES`. Defaults to the public Browse
   *   API scope when omitted.
   */
  async getAccessToken(
    scopes?: string | readonly string[],
  ): Promise<string> {
    const { token } = await this.getAccessTokenInfo(scopes)
    return token
  }

  /**
   * Like `getAccessToken` but also returns the absolute expiry timestamp
   * (ms since epoch) and the scope list that was minted.
   */
  async getAccessTokenInfo(
    scopes?: string | readonly string[],
  ): Promise<{ token: string; expiresAt: number; scopes: string[] }> {
    const validation = validateScopes(scopes ?? EBAY_DEFAULT_SCOPE)
    if (!validation.valid) {
      throw new Error(
        `Refusing to request unsupported eBay OAuth scope(s): ${validation.invalid.join(', ')}`,
      )
    }

    const requested = validation.normalised
    const cacheKey = [...requested].sort().join(' ')
    const cached = this.tokenCache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) {
      return { token: cached.token, expiresAt: cached.expiresAt, scopes: requested }
    }

    const { clientId, clientSecret } = await this.getCredentials()
    const credentials = btoa(`${clientId}:${clientSecret}`)

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: requested.join(' '),
    })

    const response = await fetch(OAUTH_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`eBay OAuth ${response.status}: ${text}`)
    }

    const data = (await response.json()) as {
      access_token: string
      expires_in: number
    }

    const expiresAt = Date.now() + data.expires_in * 1000 - TOKEN_BUFFER_MS
    this.tokenCache.set(cacheKey, { token: data.access_token, expiresAt })

    return { token: data.access_token, expiresAt, scopes: requested }
  }

  /**
   * Probe the OAuth endpoint with the user's configured credentials and
   * report success/failure plus token metadata.
   *
   * Never throws — wraps any error in the result object.
   */
  async testConnection(
    scopes?: string | readonly string[],
  ): Promise<
    | { ok: true; expiresAt: number; scopes: string[] }
    | { ok: false; error: string }
  > {
    try {
      // Bypass the token cache so the user gets a real round-trip every time.
      const validation = validateScopes(scopes ?? EBAY_DEFAULT_SCOPE)
      if (!validation.valid) {
        return {
          ok: false,
          error: `Unsupported scope(s): ${validation.invalid.join(', ')}`,
        }
      }
      const cacheKey = [...validation.normalised].sort().join(' ')
      this.tokenCache.delete(cacheKey)
      const info = await this.getAccessTokenInfo(validation.normalised)
      return { ok: true, expiresAt: info.expiresAt, scopes: info.scopes }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  /** Clear all cached tokens (e.g. after credentials change). */
  clearTokenCache(): void {
    this.tokenCache.clear()
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
