/**
 * DealScannerService — background service that periodically scans for
 * undervalued vinyl listings and fires Telegram / in-app notifications.
 *
 * Depends on:
 *   telegramService   (./telegram-service)
 *   webScrapingService (./web-scraping-service)
 *
 * Configuration is read from localStorage keys `auto_buy_config` and
 * `telegram_alerts_config`.  The vinyl collection is read from Spark KV
 * under `vinyl-vault-collection` (same store used by the rest of the app),
 * with a legacy fallback to the localStorage key `vinyl_collection`.
 * Scan state is stored in localStorage keys
 * `deal_scanner_last_run` and `deal_scanner_notified_ids`.
 */

import { telegramService } from './telegram-service'
import { webScrapingService } from './web-scraping-service'
import { ebayBrowseService } from './ebay-browse-service'
import type { CollectionItem } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScanRecord {
  artist?: string
  Artist?: string
  title?: string
  Title?: string
  album?: string
  Album?: string
  discogsReleaseId?: string
  release_id?: string
  marketValue?: number
  estimated_value?: number
}

export interface ScanConfig {
  enabled: boolean
  intervalMinutes: number
  minRoi: number
  minProfit: number
  maxPrice: number
  minCondition: string
  useWebScraping?: boolean
}

export interface Deal {
  artist: string
  title: string
  condition: string
  price: number
  buyPrice: number
  adjustedValue: number
  marketValue: number
  netProfit: number
  roi: number
  fees: number
  source: string
  ebayItemId?: string
  discogsListingId?: string
  discogsReleaseId?: string
  releaseId?: string
  url: string
  isHot: boolean
  isViable: boolean
  scraperData?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEAL_SCANNER_DEFAULTS: ScanConfig = {
  enabled: false,
  intervalMinutes: 5,
  minRoi: 40,
  minProfit: 8,
  maxPrice: 100,
  minCondition: 'VG+',
}

const CONDITION_ORDER = ['P', 'F', 'G', 'G+', 'VG', 'VG+', 'NM', 'M']

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class DealScannerService {
  private _timer: ReturnType<typeof setInterval> | null = null
  private _running = false
  private _scanning = false

  // ---------------------------------------------------------------------------
  // Configuration helpers
  // ---------------------------------------------------------------------------

  private _getConfig(): ScanConfig {
    const autoBuy = JSON.parse(
      localStorage.getItem('auto_buy_config') || '{}',
    )
    const telegram = JSON.parse(
      localStorage.getItem('telegram_alerts_config') || '{}',
    )
    return { ...DEAL_SCANNER_DEFAULTS, ...autoBuy, ...telegram }
  }

  private async _getCollection(): Promise<ScanRecord[]> {
    // Prefer Spark KV — same store as the rest of the app ('vinyl-vault-collection').
    // The KV store holds CollectionItem objects, so map their fields to the
    // ScanRecord shape expected by scanRecord().
    try {
      const sparkKv = (globalThis as any)?.spark?.kv
      if (sparkKv && typeof sparkKv.get === 'function') {
        const kvCollection = await sparkKv.get('vinyl-vault-collection') as CollectionItem[] | undefined
        if (Array.isArray(kvCollection) && kvCollection.length > 0) {
          return kvCollection.map((item): ScanRecord => ({
            artist: item.artistName,
            title: item.releaseTitle,
            discogsReleaseId: item.discogsReleaseId != null ? String(item.discogsReleaseId) : undefined,
            marketValue: item.estimatedValue?.estimateMid ?? 0,
          }))
        }
      }
    } catch {
      // Fall through to legacy localStorage key
    }
    // Legacy fallback — this key stores records already in ScanRecord shape
    try {
      return JSON.parse(localStorage.getItem('vinyl_collection') || '[]')
    } catch {
      return []
    }
  }

  private async _getDiscogsToken(): Promise<string> {
    try {
      const sparkKv = (globalThis as any)?.spark?.kv
      if (sparkKv && typeof sparkKv.get === 'function') {
        const mpConfig = await sparkKv.get('marketplace-config') as { discogs?: { userToken?: string } } | undefined
        if (mpConfig?.discogs?.userToken) {
          return mpConfig.discogs.userToken
        }
      }
    } catch {
      // KV read failure is non-fatal; fall through to unauthenticated requests
    }
    return ''
  }

  private _getConditionRank(condition: string): number {
    const idx = CONDITION_ORDER.indexOf((condition || '').toUpperCase())
    return idx === -1 ? 0 : idx
  }

  private _estimateFees(price: number): number {
    return price * 0.1275 + 0.3
  }

  private _meetsThreshold(deal: Deal, config: ScanConfig): boolean {
    const conditionOk =
      this._getConditionRank(deal.condition) >=
      this._getConditionRank(config.minCondition)
    return (
      conditionOk &&
      deal.price <= config.maxPrice &&
      deal.roi >= config.minRoi &&
      deal.netProfit >= config.minProfit
    )
  }

  // ---------------------------------------------------------------------------
  // Build deal helper
  // ---------------------------------------------------------------------------

  calculateDeal(
    listing: Record<string, unknown>,
    record: ScanRecord,
    config: ScanConfig,
  ): Deal | null {
    const artist = record.artist || record.Artist || ''
    const title =
      record.title || record.Title || record.album || record.Album || ''

    const priceRaw =
      (listing.price as { value?: number })?.value ??
      (listing.price as number) ??
      0
    const price = parseFloat(String(priceRaw))
    const marketValue = parseFloat(
      String(record.marketValue || record.estimated_value || 0),
    )
    if (!marketValue || price <= 0) return null

    const isDiscogs = (listing.source as string)?.includes('Discogs') ?? false
    const fees = isDiscogs ? price * 0.08 : this._estimateFees(price)
    const netProfit = marketValue - price - fees
    const roi = price > 0 ? parseFloat(((netProfit / price) * 100).toFixed(1)) : 0

    const deal: Deal = {
      artist,
      title,
      condition: (listing.condition as string) || 'VG+',
      price,
      buyPrice: price,
      adjustedValue: marketValue,
      marketValue,
      netProfit: Math.round(netProfit * 100) / 100,
      roi,
      fees: Math.round(fees * 100) / 100,
      source: (listing._source as string) || 'Unknown',
      ebayItemId: (listing.itemId as string) || (listing.ebayItemId as string) || undefined,
      discogsListingId: String(listing.id || listing.discogsListingId || '') || undefined,
      discogsReleaseId: record.discogsReleaseId || record.release_id,
      releaseId: record.discogsReleaseId || record.release_id,
      url: (listing.url as string) || (listing.itemWebUrl as string) || '',
      isHot: netProfit >= 8 && roi >= 40,
      isViable: netProfit >= 3,
      scraperData: (listing.rawData as Record<string, unknown>) || undefined,
    }

    return this._meetsThreshold(deal, config) ? deal : null
  }

  // ---------------------------------------------------------------------------
  // Scan logic
  // ---------------------------------------------------------------------------

  async scanRecord(record: ScanRecord, config: ScanConfig, discogsToken = ''): Promise<Deal[]> {
    const artist = record.artist || record.Artist || ''
    const title =
      record.title || record.Title || record.album || record.Album || ''
    if (!artist || !title) return []

    const found: Deal[] = []

    // --- Web Scraping Service (eBay + Discogs) ---
    if (webScrapingService.isEnabled() && config.useWebScraping !== false) {
      try {
        const query = `${artist} ${title}`
        const marketValue = parseFloat(
          String(record.marketValue || record.estimated_value || 0),
        )

        // Scrape eBay listings
        const ebayListings = await webScrapingService.scrapeEbayVinyl(query, 10)
        for (const listing of ebayListings || []) {
          const price = parseFloat(String(listing.price || 0))
          if (!marketValue || price <= 0) continue

          const ebayFee = this._estimateFees(price)
          const netProfit = marketValue - price - ebayFee
          const roi = price > 0 ? parseFloat(((netProfit / price) * 100).toFixed(1)) : 0

          const deal: Deal = {
            artist,
            title,
            condition: listing.condition || 'VG+',
            price,
            buyPrice: price,
            adjustedValue: marketValue,
            marketValue,
            netProfit: Math.round(netProfit * 100) / 100,
            roi,
            fees: Math.round(ebayFee * 100) / 100,
            source: 'eBay (Scraper)',
            ebayItemId: listing.url
              ? new URL(listing.url).pathname.replace(/\/+$/, '').split('/').pop() || ''
              : '',
            releaseId: record.discogsReleaseId || record.release_id,
            url: listing.url || '',
            isHot: netProfit >= 8 && roi >= 40,
            isViable: netProfit >= 3,
            scraperData: listing.rawData,
          }

          if (this._meetsThreshold(deal, config)) {
            found.push(deal)
          }
        }

        // Scrape Discogs listings
        const discogsListings = await webScrapingService.scrapeDiscogsVinyl(query, 10)
        for (const listing of discogsListings || []) {
          const price = parseFloat(String(listing.price || 0))
          if (!marketValue || price <= 0) continue

          const discogsFee = price * 0.08
          const netProfit = marketValue - price - discogsFee
          const roi = price > 0 ? parseFloat(((netProfit / price) * 100).toFixed(1)) : 0

          const deal: Deal = {
            artist,
            title,
            condition: listing.condition || 'VG+',
            price,
            buyPrice: price,
            adjustedValue: marketValue,
            marketValue,
            netProfit: Math.round(netProfit * 100) / 100,
            roi,
            fees: Math.round(discogsFee * 100) / 100,
            source: 'Discogs (Scraper)',
            discogsListingId: listing.releaseId || '',
            releaseId: record.discogsReleaseId || record.release_id,
            url: listing.url || '',
            isHot: netProfit >= 8 && roi >= 40,
            isViable: netProfit >= 3,
            scraperData: listing.rawData,
          }

          if (this._meetsThreshold(deal, config)) {
            found.push(deal)
          }
        }
      } catch (_err) {
        console.warn('Web scraping failed, falling back to API methods:', _err)
      }
    }

    // --- Discogs marketplace listings (API) ---
    const releaseId = record.discogsReleaseId || record.release_id
    if (releaseId) {
      try {
        const discogsHeaders: Record<string, string> = { 'User-Agent': 'Vinylaysis/1.0' }
        if (discogsToken) {
          discogsHeaders['Authorization'] = `Discogs token=${discogsToken}`
        }
        const response = await fetch(
          `https://api.discogs.com/marketplace/listings?release_id=${releaseId}&limit=5`,
          { headers: discogsHeaders },
        )
        if (response.ok) {
          const data = await response.json()
          const listings = data.listings || data || []
          for (const listing of listings) {
            const price = parseFloat(
              String(listing.price?.value ?? listing.price ?? 0),
            )
            const marketValue = parseFloat(
              String(record.marketValue || record.estimated_value || 0),
            )
            if (!marketValue || price <= 0) continue

            const discogsFee = price * 0.08
            const netProfit = marketValue - price - discogsFee
            const roi = price > 0 ? parseFloat(((netProfit / price) * 100).toFixed(1)) : 0

            const deal: Deal = {
              artist: record.artist || record.Artist || '',
              title:
                record.title || record.Title || record.album || record.Album || '',
              condition: listing.condition || 'VG+',
              price,
              buyPrice: price,
              adjustedValue: marketValue,
              marketValue,
              netProfit: Math.round(netProfit * 100) / 100,
              roi,
              fees: Math.round(discogsFee * 100) / 100,
              source: 'Discogs',
              discogsListingId: String(listing.id),
              discogsReleaseId: releaseId,
              releaseId,
              url: listing.uri
                ? `https://www.discogs.com${listing.uri}`
                : listing.url || '',
              isHot: netProfit >= 8 && roi >= 40,
              isViable: netProfit >= 3,
            }

            if (this._meetsThreshold(deal, config)) {
              found.push(deal)
            }
          }
        }
      } catch {
        // Rate limit or network error — skip silently
      }
    }

    // --- eBay BIN listings ---
    // Prefer the Browse API (OAuth Client Credentials) when Client ID + Secret
    // are configured. Fall back to the legacy Finding API only when an App ID
    // alone is available.
    try {
      const ebayQuery = `${record.artist || record.Artist || ''} ${record.title || record.Title || record.album || record.Album || ''} vinyl`.trim()
      const marketValue = parseFloat(
        String(record.marketValue || record.estimated_value || 0),
      )

      const usedBrowseApi = await this._scanEbayBrowse(
        ebayQuery,
        record,
        config,
        marketValue,
        found,
      )

      if (!usedBrowseApi) {
        await this._scanEbayFinding(record, config, found)
      }
    } catch {
      // Skip silently — eBay path is best-effort.
    }

    return found
  }

  /**
   * Scan eBay using the modern Browse API (OAuth Client Credentials).
   * Returns true if the call was attempted (regardless of result count) so
   * callers know not to fall through to the legacy Finding API.
   */
  private async _scanEbayBrowse(
    query: string,
    record: ScanRecord,
    config: ScanConfig,
    marketValue: number,
    found: Deal[],
  ): Promise<boolean> {
    if (!query) return false
    if (!(await ebayBrowseService.hasCredentials())) return false

    let result
    try {
      result = await ebayBrowseService.searchVinylRecords(query, {
        limit: 10,
        filter: 'buyingOptions:{FIXED_PRICE}',
        sort: 'price',
      })
    } catch (err) {
      console.warn('eBay Browse API search failed:', err)
      return true
    }

    for (const item of result.items) {
      const price = parseFloat(item.price?.value || '0')
      if (!marketValue || price <= 0) continue

      const ebayFee = this._estimateFees(price)
      const netProfit = marketValue - price - ebayFee
      const roi = price > 0 ? parseFloat(((netProfit / price) * 100).toFixed(1)) : 0

      const deal: Deal = {
        artist: record.artist || record.Artist || '',
        title:
          record.title || record.Title || record.album || record.Album || '',
        condition: item.condition?.conditionDisplayName || 'VG+',
        price,
        buyPrice: price,
        adjustedValue: marketValue,
        marketValue,
        netProfit: Math.round(netProfit * 100) / 100,
        roi,
        fees: Math.round(ebayFee * 100) / 100,
        source: 'eBay (Browse)',
        ebayItemId: item.itemId || '',
        releaseId: record.discogsReleaseId || record.release_id,
        url: item.itemWebUrl || '',
        isHot: netProfit >= 8 && roi >= 40,
        isViable: netProfit >= 3,
      }

      if (this._meetsThreshold(deal, config)) {
        found.push(deal)
      }
    }

    return true
  }

  /**
   * Legacy fallback: eBay Finding API (App ID only). Used only when modern
   * OAuth Client Credentials are not configured.
   */
  private async _scanEbayFinding(
    record: ScanRecord,
    config: ScanConfig,
    found: Deal[],
  ): Promise<void> {
    const ebayAppId = localStorage.getItem('ebay_app_id') || ''
    if (!ebayAppId) return

    const keywords = encodeURIComponent(
      `${record.artist || record.Artist || ''} ${record.title || record.Title || record.album || record.Album || ''} vinyl`,
    )
    const ebayUrl =
      `https://svcs.ebay.com/services/search/FindingService/v1` +
      `?OPERATION-NAME=findItemsAdvanced` +
      `&SERVICE-VERSION=1.0.0` +
      `&SECURITY-APPNAME=${ebayAppId}` +
      `&RESPONSE-DATA-FORMAT=JSON` +
      `&keywords=${keywords}` +
      `&itemFilter(0).name=ListingType&itemFilter(0).value=FixedPrice` +
      `&paginationInput.entriesPerPage=5`

    const response = await fetch(ebayUrl)
    if (!response.ok) return

    const data = await response.json()
    const items =
      data.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item || []
    for (const item of items) {
      const price = parseFloat(
        item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0',
      )
      const marketValue = parseFloat(
        String(record.marketValue || record.estimated_value || 0),
      )
      if (!marketValue || price <= 0) continue

      const ebayFee = this._estimateFees(price)
      const netProfit = marketValue - price - ebayFee
      const roi = price > 0 ? parseFloat(((netProfit / price) * 100).toFixed(1)) : 0

      const deal: Deal = {
        artist: record.artist || record.Artist || '',
        title:
          record.title || record.Title || record.album || record.Album || '',
        condition: item.condition?.conditionDisplayName || 'VG+',
        price,
        buyPrice: price,
        adjustedValue: marketValue,
        marketValue,
        netProfit: Math.round(netProfit * 100) / 100,
        roi,
        fees: Math.round(ebayFee * 100) / 100,
        source: 'eBay',
        ebayItemId: item.itemId?.[0] || '',
        releaseId: record.discogsReleaseId || record.release_id,
        url: item.viewItemURL?.[0] || '',
        isHot: netProfit >= 8 && roi >= 40,
        isViable: netProfit >= 3,
      }

      if (this._meetsThreshold(deal, config)) {
        found.push(deal)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Trigger an immediate scan across the collection.
   * Manual scans always run regardless of the enabled toggle.
   * @returns object with notified count and found deals
   */
  async scanNow(): Promise<{ notified: number; deals: Deal[] }> {
    if (this._scanning) return { notified: 0, deals: [] }
    this._scanning = true
    localStorage.setItem('deal_scanner_last_run', new Date().toISOString())

    let notified = 0
    const allDeals: Deal[] = []

    try {
      const config = this._getConfig()
      // For manual scans, use the config thresholds but don't gate on enabled
      const collection = await this._getCollection()
      if (!collection.length) return { notified: 0, deals: [] }

      const discogsToken = await this._getDiscogsToken()

      for (const record of collection) {
        const deals = await this.scanRecord(record, config, discogsToken)
        allDeals.push(...deals)

        for (const deal of deals) {
          if (telegramService.isConfigured) {
            const sent = await telegramService.sendDealAlert(deal)
            if (sent) notified++
          }
        }

        // Respect Discogs rate limit (~60/min) — small pause between records
        await new Promise((r) => setTimeout(r, 1000))
      }
    } finally {
      this._scanning = false
    }

    return { notified, deals: allDeals }
  }

  /**
   * Start periodic background scanning.
   * @param intervalMinutes – override interval (default from config)
   */
  start(intervalMinutes?: number): void {
    if (this._running) return
    this._running = true

    const config = this._getConfig()
    if (!config.enabled) {
      this._running = false
      return
    }

    const ms = (intervalMinutes || config.intervalMinutes || 5) * 60 * 1000

    this.scanNow()
    this._timer = setInterval(() => this.scanNow(), ms)
  }

  /** Stop periodic scanning. */
  stop(): void {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
    this._running = false
  }

  get isRunning(): boolean {
    return this._running
  }
}

export const dealScannerService = new DealScannerService()
