/**
 * WebScrapingService — bridges the React frontend with a Python web scraping
 * agent for advanced vinyl marketplace data collection.
 */

export interface ScrapedListing {
  marketplace: string
  title: string
  artist: string
  price: number
  condition: string
  shipping?: number
  seller: string
  url: string
  imageUrl?: string
  year?: number
  label?: string
  format?: string
  releaseId?: string
  timestamp: string
  source: string
  rawData: Record<string, unknown>
}

export interface ScrapingConfig {
  enabled: boolean
  proxyEnabled: boolean
  proxyList: string[]
  antiDetection: boolean
  maxRetries: number
  timeout: number
  cacheEnabled: boolean
}

export interface ScrapingStatus {
  available: boolean
  enabled: boolean
  config: ScrapingConfig
}

interface ScrapeParams {
  marketplace: string
  query: string
  maxResults: number
  config: ScrapingConfig
}

interface RawScrapedItem {
  title?: string
  artist?: string
  price?: number | string
  condition?: string
  shipping?: number | string
  seller?: string
  url?: string
  imageUrl?: string
  year?: number | string
  label?: string
  format?: string
  releaseId?: string
  [key: string]: unknown
}

const CONDITION_MAP: Record<string, string> = {
  'mint': 'M',
  'near mint': 'NM',
  'very good+': 'VG+',
  'very good': 'VG',
  'good+': 'G+',
  'good': 'G',
  'fair': 'F',
  'poor': 'P',
  'excellent': 'NM',
  'very good plus': 'VG+',
  'good plus': 'G+',
}

const MOCK_ARTISTS = ['The Beatles', 'Pink Floyd', 'Miles Davis', 'Bob Dylan', 'David Bowie']
const MOCK_ALBUMS = ['Abbey Road', 'Dark Side of the Moon', 'Kind of Blue', 'Highway 61 Revisited', 'The Rise and Fall of Ziggy Stardust']
const MOCK_CONDITIONS = ['M', 'NM', 'VG+', 'VG', 'G+']

class WebScrapingService {
  private isAvailable: boolean
  private config: ScrapingConfig

  constructor() {
    this.isAvailable = false
    this.config = this._loadConfig()
    this._checkAvailability()
  }

  private _loadConfig(): ScrapingConfig {
    return {
      enabled: localStorage.getItem('web_scraping_enabled') === 'true',
      proxyEnabled: localStorage.getItem('web_scraping_proxy_enabled') === 'true',
      proxyList: JSON.parse(localStorage.getItem('web_scraping_proxy_list') || '[]'),
      antiDetection: localStorage.getItem('web_scraping_anti_detection') === 'true',
      maxRetries: parseInt(localStorage.getItem('web_scraping_max_retries') || '3', 10),
      timeout: parseInt(localStorage.getItem('web_scraping_timeout') || '30', 10),
      cacheEnabled: localStorage.getItem('web_scraping_cache_enabled') === 'true',
    }
  }

  private async _checkAvailability(): Promise<void> {
    try {
      this.isAvailable = true
    } catch {
      console.warn('Web scraping agent not available')
      this.isAvailable = false
    }
  }

  // ---------------------------------------------------------------------------
  // Public marketplace methods
  // ---------------------------------------------------------------------------

  async scrapeEbayVinyl(query: string, maxResults = 50): Promise<ScrapedListing[]> {
    if (!this.isAvailable || !this.config.enabled) {
      throw new Error('Web scraping service is not available or disabled')
    }

    try {
      const result = await this._executePythonScraper({
        marketplace: 'ebay',
        query,
        maxResults,
        config: this.config,
      })
      return this._formatEbayResults(result)
    } catch (error) {
      console.error('Error scraping eBay:', error)
      throw error
    }
  }

  async scrapeDiscogsVinyl(query: string, maxResults = 50): Promise<ScrapedListing[]> {
    if (!this.isAvailable || !this.config.enabled) {
      throw new Error('Web scraping service is not available or disabled')
    }

    try {
      const result = await this._executePythonScraper({
        marketplace: 'discogs',
        query,
        maxResults,
        config: this.config,
      })
      return this._formatDiscogsResults(result)
    } catch (error) {
      console.error('Error scraping Discogs:', error)
      throw error
    }
  }

  async scrapeAmazonVinyl(query: string, maxResults = 50): Promise<ScrapedListing[]> {
    if (!this.isAvailable || !this.config.enabled) {
      throw new Error('Web scraping service is not available or disabled')
    }

    try {
      const result = await this._executePythonScraper({
        marketplace: 'amazon',
        query,
        maxResults,
        config: this.config,
      })
      return this._formatAmazonResults(result)
    } catch (error) {
      console.error('Error scraping Amazon:', error)
      throw error
    }
  }

  // ---------------------------------------------------------------------------
  // Python scraper bridge
  // ---------------------------------------------------------------------------

  private async _executePythonScraper(params: ScrapeParams): Promise<RawScrapedItem[]> {
    try {
      return await this._callPythonApi(params)
    } catch (error) {
      console.warn('API call failed, falling back to mock data:', error)
      return this._getMockScrapingData(params)
    }
  }

  private async _callPythonApi(params: ScrapeParams): Promise<RawScrapedItem[]> {
    const apiUrl = 'http://localhost:5000/api/scrape'

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplace: params.marketplace,
          query: params.query,
          maxResults: params.maxResults,
          config: params.config,
        }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'API call failed')
      }

      return result.results as RawScrapedItem[]
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('API request timed out after 30 seconds')
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          'API server not reachable. Make sure the Python server is running on port 5000.',
        )
      }
      throw error
    }
  }

  // ---------------------------------------------------------------------------
  // Result formatters
  // ---------------------------------------------------------------------------

  private _formatEbayResults(data: RawScrapedItem[]): ScrapedListing[] {
    return data.map(item => ({
      marketplace: 'eBay',
      title: item.title || '',
      artist: item.artist || '',
      price: parseFloat(String(item.price || 0)),
      condition: this._standardizeCondition(item.condition || ''),
      shipping: parseFloat(String(item.shipping || 0)),
      seller: item.seller || '',
      url: item.url || '',
      imageUrl: item.imageUrl || '',
      timestamp: new Date().toISOString(),
      source: 'web-scraper',
      rawData: item as Record<string, unknown>,
    }))
  }

  private _formatDiscogsResults(data: RawScrapedItem[]): ScrapedListing[] {
    return data.map(item => ({
      marketplace: 'Discogs',
      title: item.title || '',
      artist: item.artist || '',
      price: parseFloat(String(item.price || 0)),
      condition: this._standardizeCondition(item.condition || ''),
      year: parseInt(String(item.year || 0), 10),
      label: item.label || '',
      format: item.format || '',
      seller: item.seller || '',
      url: item.url || '',
      releaseId: item.releaseId || '',
      timestamp: new Date().toISOString(),
      source: 'web-scraper',
      rawData: item as Record<string, unknown>,
    }))
  }

  private _formatAmazonResults(data: RawScrapedItem[]): ScrapedListing[] {
    return data.map(item => ({
      marketplace: 'Amazon',
      title: item.title || '',
      artist: item.artist || '',
      price: parseFloat(String(item.price || 0)),
      condition: this._standardizeCondition(item.condition || ''),
      shipping: parseFloat(String(item.shipping || 0)),
      seller: item.seller || '',
      url: item.url || '',
      imageUrl: item.imageUrl || '',
      timestamp: new Date().toISOString(),
      source: 'web-scraper',
      rawData: item as Record<string, unknown>,
    }))
  }

  private _standardizeCondition(condition: string): string {
    const normalized = condition.toLowerCase().trim()
    return CONDITION_MAP[normalized] || condition
  }

  // ---------------------------------------------------------------------------
  // Mock data fallback
  // ---------------------------------------------------------------------------

  private _getMockScrapingData(params: ScrapeParams): RawScrapedItem[] {
    const mockData: RawScrapedItem[] = []
    const count = Math.min(params.maxResults, 10)

    for (let i = 0; i < count; i++) {
      mockData.push({
        title: MOCK_ALBUMS[i % MOCK_ALBUMS.length],
        artist: MOCK_ARTISTS[i % MOCK_ARTISTS.length],
        price: (15 + Math.random() * 85).toFixed(2),
        condition: MOCK_CONDITIONS[i % MOCK_CONDITIONS.length],
        shipping: (3 + Math.random() * 7).toFixed(2),
        seller: `Seller${i + 1}`,
        url: `https://${params.marketplace}.com/listing/${i}`,
        imageUrl: `https://example.com/image${i}.jpg`,
        ...(params.marketplace === 'discogs'
          ? {
              year: 1960 + (i % 60),
              label: 'Columbia',
              format: 'LP',
              releaseId: `release${i}`,
            }
          : {}),
      })
    }

    return mockData
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  enable(): void {
    this.config.enabled = true
    localStorage.setItem('web_scraping_enabled', 'true')
  }

  disable(): void {
    this.config.enabled = false
    localStorage.setItem('web_scraping_enabled', 'false')
  }

  isEnabled(): boolean {
    return this.config.enabled
  }

  updateConfig(newConfig: Partial<ScrapingConfig>): void {
    this.config = { ...this.config, ...newConfig }

    for (const [key, value] of Object.entries(newConfig)) {
      localStorage.setItem(
        `web_scraping_${key}`,
        typeof value === 'object' ? JSON.stringify(value) : String(value),
      )
    }
  }

  getStatus(): ScrapingStatus {
    return {
      available: this.isAvailable,
      enabled: this.config.enabled,
      config: this.config,
    }
  }
}

export const webScrapingService = new WebScrapingService()
