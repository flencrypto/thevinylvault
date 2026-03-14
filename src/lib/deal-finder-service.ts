/**
 * DealFinderService — deal analysis and ROI calculation service for vinyl
 * records.  Computes profitability metrics, condition-adjusted values, and
 * marketplace fee breakdowns.
 *
 * Depends on:
 *   webScrapingService (./web-scraping-service)
 */

import { webScrapingService, type ScrapedListing } from './web-scraping-service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DealMetrics {
  buyPrice: number
  estimatedValue: number
  adjustedValue: number
  listingPrice: number
  totalFees: number
  netProfit: number
  roi: string
  margin: string
  score: number
  isViable: boolean
  isHot: boolean
  recommendation: 'PASS' | 'MARGINAL' | 'GOOD DEAL' | 'QUICK FLIP'
}

export interface DealAnalysis extends DealMetrics {
  artist: string
  title: string
  discogsUrl: string | null
  releaseId: string | number | null
  scraperData: Record<string, unknown> | null
  timestamp: number
}

export interface ScrapedDeal extends DealAnalysis {
  marketplace: string
  url: string
  seller: string
  imageUrl?: string
  shipping: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_PROFIT_PERCENTAGE = 0.3
const MIN_PROFIT_ABSOLUTE = 3

const CONDITION_MULTIPLIERS: Record<string, number> = {
  M: 1.5,
  NM: 1.3,
  'VG+': 1.0,
  VG: 0.7,
  'G+': 0.5,
  G: 0.35,
  F: 0.2,
  P: 0.1,
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class DealFinderService {
  /**
   * Compute profitability metrics for a potential vinyl deal.
   *
   * Fee breakdown (eBay UK approx):
   *   eBay final-value fee  13%
   *   PayPal processing     2.9% + £0.30
   *   Shipping              £4.50
   *   Packing materials     £1.50
   */
  calculateMetrics(
    buyPrice: number,
    estimatedValue: number,
    condition = 'VG',
    goal = 'balanced',
  ): DealMetrics {
    const condMult = CONDITION_MULTIPLIERS[condition] ?? 0.7
    const adjustedValue = estimatedValue * condMult

    // Fee calculation
    const ebayFees = adjustedValue * 0.13
    const paypalFees = adjustedValue * 0.029 + 0.3
    const shipping = 4.5
    const packing = 1.5
    const totalFees = ebayFees + paypalFees + shipping + packing

    const minProfit = Math.max(buyPrice * MIN_PROFIT_PERCENTAGE, MIN_PROFIT_ABSOLUTE)

    // Suggested listing price based on selling goal
    let listingPrice: number
    switch (goal) {
      case 'quick':
        listingPrice = adjustedValue * 0.85
        break
      case 'max':
        listingPrice = adjustedValue * 1.1
        break
      default:
        listingPrice = adjustedValue
    }

    const netProfit = listingPrice - buyPrice - totalFees
    const roi = buyPrice > 0 ? ((netProfit / buyPrice) * 100).toFixed(1) : '0'
    const margin = ((netProfit / listingPrice) * 100).toFixed(1)

    // Deal score (0-100) — ROI-weighted
    let score = 0
    if (netProfit >= minProfit) score += 40
    if (parseFloat(roi) >= 30) score += 30
    if (parseFloat(roi) >= 50) score += 20
    if (adjustedValue > buyPrice * 2) score += 10

    const recommendation: DealMetrics['recommendation'] =
      netProfit < 0
        ? 'PASS'
        : parseFloat(roi) >= 50
          ? 'QUICK FLIP'
          : parseFloat(roi) >= 30
            ? 'GOOD DEAL'
            : 'MARGINAL'

    return {
      buyPrice,
      estimatedValue,
      adjustedValue,
      listingPrice: Math.round(listingPrice),
      totalFees: Math.round(totalFees * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      roi,
      margin,
      score,
      isViable: netProfit >= minProfit && parseFloat(roi) >= 20,
      isHot: netProfit >= minProfit * 1.5 && parseFloat(roi) >= 40,
      recommendation,
    }
  }

  /**
   * Analyse a single deal, combining buy-price data with optional Discogs /
   * scraper market information.
   */
  analyzeDeal(
    artist: string,
    title: string,
    buyPrice: number,
    listedCondition: string,
    discogsData?: Record<string, unknown> | null,
    scraperData?: Record<string, unknown> | null,
  ): DealAnalysis {
    let estimatedValue = 15 // Default fallback

    if (scraperData && typeof scraperData.marketValue === 'number') {
      estimatedValue = scraperData.marketValue
    } else if (discogsData) {
      if (typeof discogsData.lowest_price === 'number') {
        estimatedValue = discogsData.lowest_price
      } else if (typeof discogsData.median === 'number') {
        estimatedValue = discogsData.median
      }
    }

    const metrics = this.calculateMetrics(buyPrice, estimatedValue, listedCondition)

    return {
      artist,
      title,
      ...metrics,
      discogsUrl: (discogsData?.uri as string) || null,
      releaseId: (discogsData?.id as string | number) || null,
      scraperData: scraperData || null,
      timestamp: Date.now(),
    }
  }

  /**
   * Concurrently scrape eBay, Discogs and Amazon for a given record, then
   * analyse each listing and return sorted by deal score.
   */
  async scrapeAllMarketplaces(
    artist: string,
    title: string,
    maxResultsPerMarket = 10,
  ): Promise<ScrapedDeal[]> {
    const marketplaces: Array<{
      name: string
      scrape: (q: string, n: number) => Promise<ScrapedListing[]>
    }> = [
      { name: 'ebay', scrape: (q, n) => webScrapingService.scrapeEbayVinyl(q, n) },
      { name: 'discogs', scrape: (q, n) => webScrapingService.scrapeDiscogsVinyl(q, n) },
      { name: 'amazon', scrape: (q, n) => webScrapingService.scrapeAmazonVinyl(q, n) },
    ]

    const query = `${artist} ${title}`
    const allDeals: ScrapedDeal[] = []

    const results = await Promise.allSettled(
      marketplaces.map((mp) => mp.scrape(query, maxResultsPerMarket)),
    )

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'rejected') {
        console.warn(`Failed to scrape ${marketplaces[i].name}:`, result.reason)
        continue
      }

      for (const listing of result.value) {
        const deal = this.analyzeDeal(
          artist,
          title,
          listing.price,
          listing.condition,
        )

        allDeals.push({
          ...deal,
          marketplace: listing.marketplace,
          url: listing.url,
          seller: listing.seller,
          imageUrl: listing.imageUrl,
          shipping: listing.shipping || 0,
          scraperData: listing.rawData,
        })
      }
    }

    return allDeals.sort((a, b) => b.score - a.score)
  }

  /** Format a number as a £-prefixed currency string. */
  formatCurrency(amount: number): string {
    return '£' + parseFloat(String(amount)).toFixed(2)
  }
}

export const dealFinderService = new DealFinderService()
