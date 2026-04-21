/**
 * Vinyl Intelligence Coordinator — COMPLETE PRODUCTION BUILD
 * Full end-to-end cycle: photo-type → OCR → matrix search → variant match → eBay sold + trend → Discogs pricing + demand → valuation
 * All features consolidated into one clean class
 */

import { tesseractOCRService } from '../tesseract-ocr-service'
import { identifyPressing } from '../pressing-identification-ai'
import type { ScoredPressingCandidate } from '../pressing-identification-ai'

// ── Types ──────────────────────────────────────────────────────────────────

export type PhotoType = 'deadwax' | 'label' | 'cover' | 'unknown'

export interface PhotoTypeResult {
  type: PhotoType
  confidence: number
}

export interface OcrResult {
  matrix: string[]
  confidence: number
  rawText: string
}

export interface PressingResult {
  success: boolean
  data: {
    matchScore: number
    matchedVariantId?: string
    matrix?: string[]
    variantNotes?: string
    candidate?: ScoredPressingCandidate
    artistName?: string
    releaseTitle?: string
    catalogNumber?: string
    year?: number
    country?: string
  }
}

export interface EbaySoldListing {
  title: string
  price: number
  currency: string
  soldDate: string
  url?: string
}

export interface SoldPricesResult {
  success: boolean
  data: {
    listings: EbaySoldListing[]
    averagePrice: number
    medianPrice: number
    trend30d: number
    trend60d: number
    currency: string
  }
}

export interface DiscogsMarketResult {
  success: boolean
  data: {
    lowestPrice: number | null
    medianPrice: number | null
    numForSale: number
    want: number
    have: number
    demandTrend: 'hot' | 'warm' | 'cool' | 'cold'
    demandScore: number
    currency: string
  }
}

export interface ValuationResult {
  estimateLow: number
  estimateMid: number
  estimateHigh: number
  currency: string
  confidence: number
  momentumSignal: 'strong_buy' | 'buy' | 'hold' | 'sell'
  rationale: string
}

export interface CycleStep {
  step: string
  success: boolean
  [key: string]: unknown
}

export interface CycleResult {
  status: 'pending' | 'complete' | 'error'
  photoType?: PhotoTypeResult
  ocrMatrix?: string[]
  pressing?: PressingResult['data']
  sold?: SoldPricesResult['data']
  discogsMarket?: DiscogsMarketResult['data']
  valuation?: ValuationResult
  steps?: CycleStep[]
  durationMs?: number
  error?: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const DISCOGS_USER_AGENT = 'VinylalysisPro/1.0'
const EBAY_VINYL_CATEGORY = '176985'

// ── Class ──────────────────────────────────────────────────────────────────

class VinylIntelligenceCoordinator {
  private discogsToken: string | null = null

  async init(discogsToken: string | null): Promise<void> {
    this.discogsToken = discogsToken
  }

  async runFullCycle({
    releaseData = null,
    photoFile = null,
    matrixOverride = null,
  }: {
    releaseData?: Record<string, unknown> | null
    photoFile?: File | null
    /** Explicit matrix string (e.g. user-supplied deadwax text). Used when no photo/OCR is available. */
    matrixOverride?: string | null
  } = {}): Promise<CycleResult> {
    console.group('🚀 Vinyl Intelligence Cycle')
    const start = performance.now()
    let result: CycleResult = { status: 'pending', steps: [] }

    try {
      // 1. Photo-type detection
      let photoType: PhotoTypeResult = { type: 'unknown', confidence: 0 }
      if (photoFile) {
        photoType = await this._detectPhotoType(photoFile)
        result.steps!.push({ step: 'Photo Type', success: true, type: photoType.type })
      }

      // 2. Smart OCR
      let ocrResult: OcrResult | null = null
      if (photoFile) {
        ocrResult = await this._safeOCR(photoFile, photoType.type)
        result.steps!.push({
          step: 'OCR',
          success: !!(ocrResult?.matrix?.length),
          confidence: ocrResult?.confidence,
        })
      }

      // 3. Pressing identification (matrix search + enhanced comparison)
      // Prefer an explicit matrixOverride, then releaseData.ocrMatrixOverride, then OCR output.
      const resolvedMatrix =
        matrixOverride ??
        (releaseData?.ocrMatrixOverride as string | undefined) ??
        ocrResult?.matrix?.join('\n') ??
        ''
      const pressing = await this._identifyPressing(
        releaseData,
        resolvedMatrix
      )
      result.steps!.push({
        step: 'Pressing ID',
        success: pressing.success,
        matchScore: pressing.data.matchScore,
      })

      // 4. eBay sold + historical trend
      const sold = await this._researchSoldPrices(pressing.data)
      result.steps!.push({ step: 'eBay Sold', success: sold.success })

      // 5. Discogs pricing + demand trend
      const discogsMarket = await this._fetchDiscogsMarketData(
        (pressing.data.matchedVariantId as string | undefined) ??
          ((releaseData?.id as string | undefined) ?? null)
      )
      result.steps!.push({ step: 'Discogs Market', success: discogsMarket.success })

      // 6. Final valuation
      const valuation = await this._synthesizeValuation(pressing.data, sold, discogsMarket)

      result = {
        status: 'complete',
        photoType,
        ocrMatrix: ocrResult?.matrix ?? [],
        pressing: pressing.data,
        sold: sold.data,
        discogsMarket: discogsMarket.data,
        valuation,
        durationMs: performance.now() - start,
      }

      // Fire matrix diff for UI
      window.dispatchEvent(
        new CustomEvent('matrix-diff-ready', {
          detail: {
            ocrMatrix: result.ocrMatrix,
            discogsMatrix: result.pressing?.matrix ?? [],
            matchScore: result.pressing?.matchScore,
            explanation: result.pressing?.variantNotes,
          },
        })
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('Cycle failed:', err)
      result = { status: 'error', error: message }
    }

    console.groupEnd()
    return result
  }

  // ── Photo Type Detection ────────────────────────────────────────────────

  async _detectPhotoType(photoFile: File): Promise<PhotoTypeResult> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(img.src)
          resolve({ type: 'unknown', confidence: 0 })
          return
        }

        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data

        let brightnessSum = 0
        const sampleSize = 500

        for (let i = 0; i < sampleSize; i++) {
          const x = Math.floor(Math.random() * canvas.width)
          const y = Math.floor(Math.random() * canvas.height)
          const idx = (y * canvas.width + x) * 4
          const b = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
          brightnessSum += b
          if (x > 0) {
            const prevB = (data[idx - 4] + data[idx - 3] + data[idx - 2]) / 3
            if (Math.abs(b - prevB) > 40) {
              // edge detected — contributes to overall brightness contrast profile
            }
          }
        }

        const avgBrightness = brightnessSum / sampleSize
        const aspect = canvas.width / canvas.height

        let type: PhotoType = 'cover'
        if (aspect > 1.4 && avgBrightness < 90) type = 'deadwax'
        else if (aspect < 0.9 && avgBrightness > 140) type = 'label'

        URL.revokeObjectURL(img.src)
        resolve({
          type,
          confidence: type === 'deadwax' ? 85 : type === 'label' ? 75 : 70,
        })
      }
      img.onerror = () => {
        URL.revokeObjectURL(img.src)
        resolve({ type: 'unknown', confidence: 0 })
      }
      img.src = URL.createObjectURL(photoFile)
    })
  }

  // ── Smart OCR ───────────────────────────────────────────────────────────

  async _safeOCR(
    photoFile: File,
    photoType: PhotoType = 'deadwax',
    retries = 3
  ): Promise<OcrResult | null> {
    for (let i = 0; i < retries; i++) {
      try {
        const rawText = await tesseractOCRService.extractText(photoFile)
        if (!rawText) continue

        const matrix = this._extractMatrixLines(rawText)
        const parsed = tesseractOCRService.parseVinylText(rawText)

        // Augment matrix with parsed runout values
        if (parsed.matrixRunoutA && !matrix.includes(parsed.matrixRunoutA)) {
          matrix.push(parsed.matrixRunoutA)
        }
        if (parsed.matrixRunoutB && !matrix.includes(parsed.matrixRunoutB)) {
          matrix.push(parsed.matrixRunoutB)
        }

        // Boost confidence for deadwax images (expected to contain matrix codes)
        const baseConfidence = photoType === 'deadwax' ? 80 : 60
        const confidenceBonus = matrix.length > 0 ? 15 : 0
        const confidence = Math.min(95, baseConfidence + confidenceBonus)

        return { matrix, confidence, rawText }
      } catch {
        if (i < retries - 1) {
          await new Promise((r) => setTimeout(r, 600))
        }
      }
    }
    return null
  }

  // ── Pressing Identification ─────────────────────────────────────────────

  async _identifyPressing(
    releaseData: Record<string, unknown> | null,
    userMatrixRaw: string
  ): Promise<PressingResult> {
    try {
      const ocrRunoutValues = userMatrixRaw
        ? this._normalizeMatrix(userMatrixRaw)
        : []

      const manualHints = releaseData
        ? {
            artist: (releaseData.artist as string | undefined) ??
              (releaseData.artistName as string | undefined),
            title: (releaseData.title as string | undefined) ??
              (releaseData.releaseTitle as string | undefined),
            catalogNumber: (releaseData.catalogNumber as string | undefined) ??
              (releaseData.catno as string | undefined),
            country: releaseData.country as string | undefined,
            year: releaseData.year as number | undefined,
            labelName: Array.isArray(releaseData.labels)
              ? (releaseData.labels[0] as { name?: string })?.name
              : (releaseData.label as string | undefined),
          }
        : {}

      const candidates = await identifyPressing({
        ocrRunoutValues,
        manualHints,
        discogsSearchEnabled: !!this.discogsToken,
        discogsApiToken: this.discogsToken ?? undefined,
      })

      if (!candidates.length) {
        return {
          success: false,
          data: { matchScore: 0 },
        }
      }

      const best = candidates[0]
      const matchScore = best.totalScore ?? best.confidence ?? 0

      // Extract matrix strings from matched identifiers
      const matrix = best.matrixNumbers ?? []
      const matrixFromMatches = best.matches
        .filter((m) => m.type === 'matrix')
        .map((m) => m.value)
      const allMatrix = [...new Set([...matrix, ...matrixFromMatches])]

      return {
        success: true,
        data: {
          matchScore,
          matchedVariantId: best.discogsId?.toString(),
          matrix: allMatrix,
          variantNotes: best.reasoning,
          candidate: best,
          artistName: best.artistName,
          releaseTitle: best.releaseTitle,
          catalogNumber: best.catalogNumber,
          year: best.year,
          country: best.country,
        },
      }
    } catch (err) {
      console.warn('Pressing identification failed:', err)
      return { success: false, data: { matchScore: 0 } }
    }
  }

  // ── eBay Sold + Historical Trend ────────────────────────────────────────

  async _researchSoldPrices(
    pressing: PressingResult['data']
  ): Promise<SoldPricesResult> {
    const defaultResult: SoldPricesResult = {
      success: false,
      data: {
        listings: [],
        averagePrice: 0,
        medianPrice: 0,
        trend30d: 0,
        trend60d: 0,
        currency: 'USD',
      },
    }

    try {
      const ebayAppId =
        localStorage.getItem('ebay_client_id') ??
        localStorage.getItem('ebay_app_id')

      if (!ebayAppId) return defaultResult

      const query = [
        pressing.artistName,
        pressing.releaseTitle,
        pressing.catalogNumber,
        'vinyl',
      ]
        .filter(Boolean)
        .join(' ')

      if (!query.trim()) return defaultResult

      const now = new Date()
      const from60 = new Date(now)
      from60.setDate(from60.getDate() - 60)

      const params = new URLSearchParams({
        'OPERATION-NAME': 'findCompletedItems',
        'SERVICE-VERSION': '1.0.0',
        'SECURITY-APPNAME': ebayAppId,
        'RESPONSE-DATA-FORMAT': 'JSON',
        'REST-PAYLOAD': '',
        keywords: query,
        'itemFilter(0).name': 'SoldItemsOnly',
        'itemFilter(0).value': 'true',
        'itemFilter(1).name': 'EndTimeFrom',
        'itemFilter(1).value': from60.toISOString(),
        'itemFilter(2).name': 'CategoryId',
        'itemFilter(2).value': EBAY_VINYL_CATEGORY,
        'paginationInput.entriesPerPage': '40',
        sortOrder: 'EndTimeSoonest',
      })

      const url = `https://svcs.ebay.com/services/search/FindingService/v1?${params.toString()}`
      const response = await fetch(url)
      if (!response.ok) return defaultResult

      const data = await response.json()
      const rawItems: unknown[] =
        data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? []

      const listings: EbaySoldListing[] = rawItems.map((ebayItem: unknown) => {
        const item = ebayItem as Record<string, unknown[]>
        return {
          title: (item.title?.[0] as string) ?? '',
          price: parseFloat(
            (
              (item.sellingStatus?.[0] as Record<string, unknown[]>)
                ?.currentPrice?.[0] as Record<string, string>
            )?.__value__ ?? '0'
          ),
          currency:
            (
              (item.sellingStatus?.[0] as Record<string, unknown[]>)
                ?.currentPrice?.[0] as Record<string, string>
            )?.['@currencyId'] ?? 'USD',
          soldDate:
            (item.listingInfo?.[0] as Record<string, string[]>)?.endTime?.[0] ??
            new Date().toISOString(),
          url: (item.viewItemURL?.[0] as string) ?? undefined,
        }
      })

      const prices = listings.map((l) => l.price).filter((p) => p > 0)
      if (!prices.length) return defaultResult

      const cutoff30 = new Date()
      cutoff30.setDate(cutoff30.getDate() - 30)
      const prices30 = listings
        .filter((l) => new Date(l.soldDate) >= cutoff30)
        .map((l) => l.price)
        .filter((p) => p > 0)

      const cutoff60 = new Date()
      cutoff60.setDate(cutoff60.getDate() - 60)
      const prices60 = listings
        .filter((l) => new Date(l.soldDate) < cutoff30 && new Date(l.soldDate) >= cutoff60)
        .map((l) => l.price)
        .filter((p) => p > 0)

      const avg30 = prices30.length ? this._average(prices30) : 0
      const avg60 = prices60.length ? this._average(prices60) : 0
      const trend30d = avg60 > 0 ? ((avg30 - avg60) / avg60) * 100 : 0

      const allAvg = this._average(prices)
      const recentHalf = prices.slice(0, Math.ceil(prices.length / 2))
      const olderHalf = prices.slice(Math.ceil(prices.length / 2))
      const avgRecent = this._average(recentHalf)
      const avgOlder = olderHalf.length ? this._average(olderHalf) : avgRecent
      const trend60d = avgOlder > 0 ? ((avgRecent - avgOlder) / avgOlder) * 100 : 0

      return {
        success: true,
        data: {
          listings,
          averagePrice: Math.round(allAvg * 100) / 100,
          medianPrice: Math.round(this._median(prices) * 100) / 100,
          trend30d: Math.round(trend30d * 10) / 10,
          trend60d: Math.round(trend60d * 10) / 10,
          currency: listings[0]?.currency ?? 'USD',
        },
      }
    } catch (err) {
      console.warn('eBay sold research failed:', err)
      return defaultResult
    }
  }

  // ── Discogs Pricing + Demand Trend ──────────────────────────────────────

  async _fetchDiscogsMarketData(
    releaseId: string | null
  ): Promise<DiscogsMarketResult> {
    const defaultResult: DiscogsMarketResult = {
      success: false,
      data: {
        lowestPrice: null,
        medianPrice: null,
        numForSale: 0,
        want: 0,
        have: 0,
        demandTrend: 'cold',
        demandScore: 0,
        currency: 'USD',
      },
    }

    if (!releaseId || !this.discogsToken) return defaultResult

    try {
      const authParams = `token=${this.discogsToken}`
      const headers = { 'User-Agent': DISCOGS_USER_AGENT }

      const [releaseRes, marketRes] = await Promise.all([
        fetch(`https://api.discogs.com/releases/${releaseId}?${authParams}`, {
          headers,
        }),
        fetch(
          `https://api.discogs.com/marketplace/stats/${releaseId}?${authParams}`,
          { headers }
        ),
      ])

      let want = 0
      let have = 0
      let numForSale = 0
      let lowestPrice: number | null = null
      let medianPrice: number | null = null
      let currency = 'USD'

      if (releaseRes.ok) {
        const releaseData = await releaseRes.json()
        want = releaseData.community?.want ?? 0
        have = releaseData.community?.have ?? 0
      }

      if (marketRes.ok) {
        const stats = await marketRes.json()
        numForSale = stats.num_for_sale ?? 0
        if (stats.lowest_price) {
          lowestPrice = parseFloat(stats.lowest_price.value ?? '0')
          currency = stats.lowest_price.currency ?? 'USD'
        }
        if (stats.median_price) {
          medianPrice = parseFloat(stats.median_price.value ?? '0')
        }
      }

      const { trend: demandTrend, score: demandScore } = this._calculateDemandTrend(
        want,
        have,
        numForSale
      )

      return {
        success: true,
        data: {
          lowestPrice,
          medianPrice,
          numForSale,
          want,
          have,
          demandTrend,
          demandScore,
          currency,
        },
      }
    } catch (err) {
      console.warn('Discogs market data fetch failed:', err)
      return defaultResult
    }
  }

  _calculateDemandTrend(
    want: number,
    have: number,
    numForSale: number
  ): { trend: 'hot' | 'warm' | 'cool' | 'cold'; score: number } {
    if (have === 0 && want === 0) return { trend: 'cold', score: 0 }

    // Want-to-have ratio (demand signal)
    const wantToHave = have > 0 ? want / have : want > 0 ? 2 : 0

    // Supply scarcity (fewer listings → higher score)
    const scarcityScore =
      numForSale === 0 ? 1.0 : numForSale < 5 ? 0.8 : numForSale < 20 ? 0.5 : 0.2

    // Community size bonus (more data = more reliable)
    const communityBonus = Math.min(0.2, (have + want) / 5000)

    const rawScore = Math.min(1.0, wantToHave * 0.6 + scarcityScore * 0.3 + communityBonus)
    const score = Math.round(rawScore * 100) / 100

    let trend: 'hot' | 'warm' | 'cool' | 'cold'
    if (score >= 0.75) trend = 'hot'
    else if (score >= 0.5) trend = 'warm'
    else if (score >= 0.25) trend = 'cool'
    else trend = 'cold'

    return { trend, score }
  }

  // ── Final Valuation Synthesis ───────────────────────────────────────────

  async _synthesizeValuation(
    pressing: PressingResult['data'],
    sold: SoldPricesResult,
    discogsMarket: DiscogsMarketResult
  ): Promise<ValuationResult> {
    const grokValuation = await this._identifyValueWithGrok(pressing, sold, discogsMarket)
    if (grokValuation) {
      return grokValuation
    }

    const currency = sold.data.currency || discogsMarket.data.currency || 'USD'
    let baseMid = 0
    let confidence = 0.3

    // Weight sold data most heavily
    if (sold.success && sold.data.medianPrice > 0) {
      baseMid = sold.data.medianPrice
      confidence = 0.7
    } else if (discogsMarket.success && discogsMarket.data.medianPrice !== null) {
      baseMid = discogsMarket.data.medianPrice
      confidence = 0.5
    } else if (discogsMarket.success && discogsMarket.data.lowestPrice !== null) {
      baseMid = discogsMarket.data.lowestPrice * 1.2
      confidence = 0.4
    }

    if (baseMid === 0) {
      baseMid = 25 // minimal fallback
    }

    // Apply match score premium — higher match score → closer to actual variant
    const matchPremium = pressing.matchScore > 0.8 ? 1.15 : pressing.matchScore > 0.6 ? 1.05 : 1.0
    baseMid *= matchPremium

    // Apply demand momentum
    const demandMultiplier =
      discogsMarket.data.demandTrend === 'hot'
        ? 1.2
        : discogsMarket.data.demandTrend === 'warm'
        ? 1.1
        : discogsMarket.data.demandTrend === 'cold'
        ? 0.9
        : 1.0

    const momentumMid = baseMid * demandMultiplier

    // Apply eBay price trend adjustment
    const trendAdjustment = 1 + Math.max(-0.15, Math.min(0.15, sold.data.trend30d / 100))
    const adjustedMid = momentumMid * trendAdjustment

    const estimateMid = Math.round(adjustedMid * 100) / 100
    const estimateLow = Math.round(adjustedMid * 0.75 * 100) / 100
    const estimateHigh = Math.round(adjustedMid * 1.4 * 100) / 100

    // Momentum signal
    let momentumSignal: ValuationResult['momentumSignal'] = 'hold'
    if (
      discogsMarket.data.demandTrend === 'hot' &&
      sold.data.trend30d > 5
    ) {
      momentumSignal = 'strong_buy'
    } else if (
      discogsMarket.data.demandTrend !== 'cold' &&
      sold.data.trend30d >= 0
    ) {
      momentumSignal = 'buy'
    } else if (
      discogsMarket.data.demandTrend === 'cold' ||
      sold.data.trend30d < -10
    ) {
      momentumSignal = 'sell'
    }

    const rationale = [
      sold.success
        ? `Based on ${sold.data.listings.length} eBay sold listings (median: ${currency} ${sold.data.medianPrice})`
        : 'No recent eBay sold data found',
      discogsMarket.success
        ? `Discogs: ${discogsMarket.data.numForSale} for sale, want/have = ${discogsMarket.data.want}/${discogsMarket.data.have} (${discogsMarket.data.demandTrend})`
        : 'No Discogs market data',
      sold.data.trend30d !== 0
        ? `30d price trend: ${sold.data.trend30d > 0 ? '+' : ''}${sold.data.trend30d}%`
        : '',
      pressing.matchScore > 0
        ? `Pressing match confidence: ${Math.round(pressing.matchScore * 100)}%`
        : '',
    ]
      .filter(Boolean)
      .join('. ')

    return {
      estimateLow,
      estimateMid,
      estimateHigh,
      currency,
      confidence: Math.round(confidence * 100) / 100,
      momentumSignal,
      rationale,
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async _identifyValueWithGrok(
    pressing: PressingResult['data'],
    sold: SoldPricesResult,
    discogsMarket: DiscogsMarketResult
  ): Promise<ValuationResult | null> {
    const creds = await this._resolveXaiCredentials()
    if (!creds?.apiKey) return null

    const systemPrompt = `You are Vinylasis's valuation model. Return only valid JSON with:
{
  "estimateLow": number,
  "estimateMid": number,
  "estimateHigh": number,
  "currency": "USD",
  "confidence": 0.0,
  "momentumSignal": "strong_buy|buy|hold|sell",
  "rationale": "short explanation"
}
Rules:
- Use only provided sold and market signals
- Keep confidence between 0 and 1
- Ensure estimateLow <= estimateMid <= estimateHigh
- If market data is sparse, lower confidence`

    const payload = {
      pressing,
      sold: sold.data,
      soldSuccess: sold.success,
      discogsMarket: discogsMarket.data,
      discogsSuccess: discogsMarket.success,
    }

    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${creds.apiKey}`,
        },
        body: JSON.stringify({
          model: creds.model,
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 600,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Identify realistic valuation from this intelligence data:\n${JSON.stringify(payload)}`,
            },
          ],
        }),
      })

      if (!response.ok) {
        console.warn('Grok valuation request failed:', response.status)
        return null
      }

      const data = await response.json()
      const content = data?.choices?.[0]?.message?.content
      if (typeof content !== 'string' || !content.trim()) return null

      const parsed = JSON.parse(this._extractJsonObject(content)) as Record<string, unknown>

      const estimateLow = Number(parsed.estimateLow)
      const estimateMid = Number(parsed.estimateMid)
      const estimateHigh = Number(parsed.estimateHigh)

      if (!Number.isFinite(estimateLow) || !Number.isFinite(estimateMid) || !Number.isFinite(estimateHigh)) {
        return null
      }

      const sorted = [estimateLow, estimateMid, estimateHigh].sort((a, b) => a - b)
      const currency =
        typeof parsed.currency === 'string' && parsed.currency.trim()
          ? parsed.currency.trim().toUpperCase()
          : sold.data.currency || discogsMarket.data.currency || 'USD'

      const rationale =
        typeof parsed.rationale === 'string' && parsed.rationale.trim()
          ? parsed.rationale.trim()
          : 'Grok valuation generated from sold and market intelligence signals.'

      return {
        estimateLow: Math.round(sorted[0] * 100) / 100,
        estimateMid: Math.round(sorted[1] * 100) / 100,
        estimateHigh: Math.round(sorted[2] * 100) / 100,
        currency,
        confidence: this._normalizeConfidence(parsed.confidence),
        momentumSignal: this._normalizeMomentumSignal(parsed.momentumSignal),
        rationale,
      }
    } catch (err) {
      console.warn('Grok value identification failed:', err)
      return null
    }
  }

  private async _resolveXaiCredentials(): Promise<{ apiKey: string; model: string } | null> {
    const directApiKey = localStorage.getItem('xai_api_key')
    const directModel = localStorage.getItem('xai_model') || 'grok-4-1-fast-reasoning'
    if (directApiKey) {
      return { apiKey: directApiKey, model: directModel }
    }

    const sparkKv = (globalThis as { spark?: { kv?: { get?: (key: string) => Promise<unknown> } } })?.spark?.kv
    if (!sparkKv?.get) return null

    try {
      const raw = await sparkKv.get('vinyl-vault-api-keys')
      if (!raw) return null
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!parsed || typeof parsed !== 'object') return null

      const apiKey = typeof parsed.xaiApiKey === 'string' ? parsed.xaiApiKey : null
      const model = typeof parsed.xaiModel === 'string' ? parsed.xaiModel : 'grok-4-1-fast-reasoning'
      if (!apiKey) return null

      return { apiKey, model }
    } catch {
      return null
    }
  }

  private _extractJsonObject(content: string): string {
    const fenced = content.match(/```json\s*([\s\S]*?)\s*```/)
    if (fenced) return fenced[1].trim()

    const start = content.indexOf('{')
    if (start === -1) return content.trim()

    let depth = 0
    for (let i = start; i < content.length; i++) {
      if (content[i] === '{') depth++
      else if (content[i] === '}') depth--
      if (depth === 0) {
        return content.substring(start, i + 1).trim()
      }
    }

    return content.substring(start).trim()
  }

  private _normalizeMomentumSignal(
    signal: unknown
  ): ValuationResult['momentumSignal'] {
    if (signal === 'strong_buy' || signal === 'buy' || signal === 'hold' || signal === 'sell') {
      return signal
    }
    return 'hold'
  }

  private _normalizeConfidence(value: unknown): number {
    const PERCENT_SCALE = 100
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return 0.5
    // Grok may return confidence as either a decimal (0-1) or a percentage (0-100).
    const normalized = numeric > 1 ? numeric / PERCENT_SCALE : numeric
    return Math.round(Math.max(0, Math.min(1, normalized)) * 100) / 100
  }

  private _normalizeMatrix(raw: string): string[] {
    if (!raw?.trim()) return []

    return raw
      .split(/[\n,;]+/)
      .map((s) =>
        s
          .trim()
          .toUpperCase()
          .replace(/[^\w\s\-/]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      )
      .filter((s) => s.length >= 2)
  }

  private _extractMatrixLines(text: string): string[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const matrixPattern = /^[A-Z0-9]{2,6}[\s-][A-Z0-9]{2,8}(?:[\s-][A-Z0-9]{1,4})*$/
    const results: string[] = []

    for (const line of lines) {
      if (matrixPattern.test(line) && line.length >= 5 && line.length <= 30) {
        results.push(line)
        if (results.length >= 4) break
      }
      if (/\b(STERLING|PORKY|PECKO|TML|RL|EMI|CBS|HAECO|MCA|RE|PR|WEA)\b/.test(line)) {
        if (!results.includes(line)) results.push(line)
      }
    }

    return results
  }

  private _median(numbers: number[]): number {
    if (!numbers.length) return 0
    const sorted = [...numbers].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }

  private _average(numbers: number[]): number {
    if (!numbers.length) return 0
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length
  }
}

// Export singleton
export const intelligenceCoordinator = new VinylIntelligenceCoordinator()
