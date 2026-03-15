/**
 * TelegramService — sends deal alerts via the Telegram Bot API.
 *
 * Credentials are read from localStorage keys (telegram_bot_token, telegram_chat_id)
 * with a Spark KV fallback (vinyl-vault-api-keys camelCase fields: telegramBotToken,
 * telegramChatId) for sync with the Settings UI.
 */

export interface DealInfo {
  roi: number | string
  netProfit: number | string
  ebayItemId?: string
  discogsListingId?: string
  itemId?: string
  releaseId?: string
  discogsReleaseId?: string
  price?: number | string
  buyPrice?: number | string
  artist?: string
  title?: string
  condition?: string
  adjustedValue?: number | string
  marketValue?: number | string
  fees?: number | string
  totalFees?: number | string
  source?: string
  url?: string
  itemWebUrl?: string
  listingUrl?: string
  discogsUrl?: string
}

export interface DealTier {
  tier: 'instant_flip' | 'hot_deal' | 'good_deal'
  emoji: string
  label: string
  silent: boolean
}

interface ReleaseCooldownEntry {
  ts: number
  price: number
}

class TelegramService {
  private botToken: string
  private chatId: string
  private readonly apiBase = 'https://api.telegram.org'
  private _notifiedIds: Set<string>
  private _releaseCooldowns: Record<string, ReleaseCooldownEntry>

  constructor() {
    // Prefer existing dedicated localStorage keys
    let botToken = localStorage.getItem('telegram_bot_token') || ''
    let chatId = localStorage.getItem('telegram_chat_id') || ''

    // If not set, try to hydrate from Spark KV via globalThis
    if (!botToken || !chatId) {
      void this._syncFromKv()
    }

    this.botToken = botToken
    this.chatId = chatId

    this._notifiedIds = new Set<string>(
      JSON.parse(localStorage.getItem('deal_scanner_notified_ids') || '[]'),
    )
    this._releaseCooldowns = JSON.parse(
      localStorage.getItem('telegram_release_cooldowns') || '{}',
    )
  }

  /**
   * Hydrate credentials from Spark KV (camelCase keys as stored by SettingsView).
   */
  private async _syncFromKv(): Promise<void> {
    const sparkKv = (globalThis as any)?.spark?.kv
    if (!sparkKv || typeof sparkKv.get !== 'function') return

    try {
      const raw = await sparkKv.get('vinyl-vault-api-keys')
      if (!raw) return

      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!parsed || typeof parsed !== 'object') return

      // SettingsView stores camelCase keys at the top level
      if (!this.botToken && typeof parsed.telegramBotToken === 'string') {
        this.botToken = parsed.telegramBotToken
        localStorage.setItem('telegram_bot_token', this.botToken)
      }
      if (!this.chatId && typeof parsed.telegramChatId === 'string') {
        this.chatId = parsed.telegramChatId
        localStorage.setItem('telegram_chat_id', this.chatId)
      }
    } catch {
      // Ignore KV errors
    }
  }

  // ---------------------------------------------------------------------------
  // Credential management
  // ---------------------------------------------------------------------------

  updateCredentials(botToken: string, chatId: string): void {
    if (botToken !== undefined) {
      this.botToken = botToken
      localStorage.setItem('telegram_bot_token', botToken)
    }
    if (chatId !== undefined) {
      this.chatId = chatId
      localStorage.setItem('telegram_chat_id', chatId)
    }

    // Sync to Spark KV using camelCase schema (matches SettingsView)
    const sparkKv = (globalThis as any)?.spark?.kv
    if (sparkKv && typeof sparkKv.get === 'function') {
      void (sparkKv.get('vinyl-vault-api-keys') as Promise<Record<string, unknown>>)
        .then((raw) => {
          const kv = raw && typeof raw === 'object' ? raw : {}
          const updates: Record<string, string> = {}
          if (botToken !== undefined) updates.telegramBotToken = this.botToken
          if (chatId !== undefined) updates.telegramChatId = this.chatId
          return sparkKv.set('vinyl-vault-api-keys', { ...kv, ...updates })
        })
        .catch(() => { /* Ignore KV sync errors */ })
    }
  }

  get isConfigured(): boolean {
    return !!(this.botToken && this.chatId)
  }

  reloadCredentials(): void {
    this.botToken = localStorage.getItem('telegram_bot_token') || ''
    this.chatId = localStorage.getItem('telegram_chat_id') || ''
  }

  // ---------------------------------------------------------------------------
  // Tiered alert classification
  // ---------------------------------------------------------------------------

  classifyDeal(deal: DealInfo): DealTier | null {
    const roi = parseFloat(String(deal.roi))
    const profit = parseFloat(String(deal.netProfit))

    if (roi >= 100 && profit >= 15) {
      return { tier: 'instant_flip', emoji: '🔥', label: 'INSTANT FLIP FOUND', silent: false }
    }
    if (roi >= 50 && profit >= 8) {
      return { tier: 'hot_deal', emoji: '💎', label: 'HOT DEAL FOUND', silent: false }
    }
    if (roi >= 30 && profit >= 3) {
      return { tier: 'good_deal', emoji: '📊', label: 'GOOD DEAL FOUND', silent: true }
    }
    return null
  }

  // ---------------------------------------------------------------------------
  // Deduplication helpers
  // ---------------------------------------------------------------------------

  private _listingKey(deal: DealInfo): string | null {
    return deal.ebayItemId || deal.discogsListingId || deal.itemId || null
  }

  private _isAlreadyNotified(deal: DealInfo): boolean {
    const key = this._listingKey(deal)
    return key ? this._notifiedIds.has(String(key)) : false
  }

  private _markNotified(deal: DealInfo): void {
    const key = this._listingKey(deal)
    if (key) {
      this._notifiedIds.add(String(key))
      localStorage.setItem(
        'deal_scanner_notified_ids',
        JSON.stringify([...this._notifiedIds]),
      )
    }
  }

  // ---------------------------------------------------------------------------
  // Per-release cooldown (24 h unless price drops further)
  // ---------------------------------------------------------------------------

  private _isOnCooldown(deal: DealInfo): boolean {
    const releaseId = deal.releaseId || deal.discogsReleaseId
    if (!releaseId) return false
    const entry = this._releaseCooldowns[String(releaseId)]
    if (!entry) return false
    const elapsed = Date.now() - entry.ts
    if (elapsed >= 24 * 60 * 60 * 1000) {
      delete this._releaseCooldowns[String(releaseId)]
      this._saveReleaseCooldowns()
      return false
    }
    // Allow re-alert if price dropped further
    const currentPrice = parseFloat(String(deal.price || 0))
    if (currentPrice && entry.price && currentPrice < entry.price) {
      return false
    }
    return true
  }

  private _recordReleaseCooldown(deal: DealInfo): void {
    const releaseId = deal.releaseId || deal.discogsReleaseId
    if (!releaseId) return
    this._releaseCooldowns[String(releaseId)] = {
      ts: Date.now(),
      price: parseFloat(String(deal.price || deal.buyPrice || 0)),
    }
    this._saveReleaseCooldowns()
  }

  private _saveReleaseCooldowns(): void {
    localStorage.setItem(
      'telegram_release_cooldowns',
      JSON.stringify(this._releaseCooldowns),
    )
  }

  // ---------------------------------------------------------------------------
  // Message formatting
  // ---------------------------------------------------------------------------

  private _escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  private _formatMessage(deal: DealInfo, tier: DealTier): string {
    const rawArtist = deal.artist || 'Unknown Artist'
    const rawTitle = deal.title || 'Unknown Title'
    const rawCondition = deal.condition || '—'
    const buyPrice = parseFloat(String(deal.price || deal.buyPrice || 0)).toFixed(2)
    const marketValue = parseFloat(String(deal.adjustedValue || deal.marketValue || 0)).toFixed(2)
    const netProfit = parseFloat(String(deal.netProfit || 0)).toFixed(2)
    const roi = parseFloat(String(deal.roi || 0)).toFixed(0)
    const fees = parseFloat(String(deal.fees || deal.totalFees || 0)).toFixed(2)
    const rawSource = deal.source || (deal.ebayItemId ? 'eBay' : 'Discogs')
    const rawUrl = deal.url || deal.itemWebUrl || deal.listingUrl || deal.discogsUrl || ''

    const artist = this._escapeHtml(rawArtist)
    const title = this._escapeHtml(rawTitle)
    const condition = this._escapeHtml(rawCondition)
    const source = this._escapeHtml(rawSource)
    const url = rawUrl ? this._escapeHtml(rawUrl) : ''

    const linkHtml = url
      ? `\n🔗 <a href="${url}">View Listing</a>`
      : ''

    const ctaLine =
      tier.tier !== 'good_deal'
        ? '\n\n⚡ Auto-buy threshold met — check VinylVault Deals page'
        : ''

    return (
      `${tier.emoji} <b>${tier.label}</b>\n\n` +
      `🎵 <b>${artist}</b> — ${title}\n` +
      `📀 Condition: ${condition}\n` +
      `💰 Buy Now: £${buyPrice}\n` +
      `📊 Market Value: £${marketValue}\n` +
      `📈 Potential Profit: £${netProfit} (${roi}% ROI)\n` +
      `💸 Fees (est.): £${fees}\n\n` +
      `🏪 Source: ${source}` +
      linkHtml +
      ctaLine
    )
  }

  // ---------------------------------------------------------------------------
  // Core send method
  // ---------------------------------------------------------------------------

  private async _sendMessage(text: string, silent = false): Promise<unknown> {
    if (!this.isConfigured) {
      throw new Error('Telegram not configured — set bot token and chat ID in Settings')
    }
    const url = `${this.apiBase}/bot${this.botToken}/sendMessage`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        disable_notification: silent,
      }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(
        `Telegram API error ${response.status}: ${err.description || response.statusText}`,
      )
    }
    return response.json()
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Send a deal alert. Applies deduplication and per-release cooldown.
   * @param force – skip dedup/cooldown checks
   * @returns true if message was sent
   */
  async sendDealAlert(deal: DealInfo, force = false): Promise<boolean> {
    if (!this.isConfigured) return false

    const tier = this.classifyDeal(deal)
    if (!tier) return false

    if (!force) {
      if (this._isAlreadyNotified(deal)) return false
      if (this._isOnCooldown(deal)) return false
    }

    const text = this._formatMessage(deal, tier)
    await this._sendMessage(text, tier.silent)

    this._markNotified(deal)
    this._recordReleaseCooldown(deal)
    return true
  }

  /** Send a test message to verify bot token and chat ID. */
  async testConnection(): Promise<boolean> {
    await this._sendMessage(
      '✅ <b>VinylVault connected!</b>\n\nTelegram alerts are working correctly. You will receive deal notifications here when undervalued vinyl is detected.',
      false,
    )
    return true
  }
}

export const telegramService = new TelegramService()
