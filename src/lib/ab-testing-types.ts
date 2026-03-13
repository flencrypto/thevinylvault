export interface TitleVariant {
  id: string
  text: string
  style: TitleStyle
  createdAt: string
  performance?: VariantPerformance
}

export interface VariantPerformance {
  views: number
  clicks: number
  watchlists: number
  messages: number
  sales: number
  clickThroughRate: number
  conversionRate: number
  averageSalePrice?: number
}

export type TitleStyle = 
  | 'seo_optimized'
  | 'concise'
  | 'detailed'
  | 'collector_focused'
  | 'keyword_rich'
  | 'simple'

export interface ABTest {
  id: string
  itemId: string
  listingDraftId?: string
  variants: TitleVariant[]
  activeVariantId?: string
  status: 'draft' | 'active' | 'paused' | 'completed'
  startedAt?: string
  completedAt?: string
  winningVariantId?: string
  testDuration?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface TestResult {
  variantId: string
  variantText: string
  performance: VariantPerformance
  isWinner: boolean
  confidenceScore: number
  improvement?: number
}

export const TITLE_STYLE_DESCRIPTIONS: Record<TitleStyle, string> = {
  seo_optimized: 'SEO Optimized - Maximum keyword density for search visibility',
  concise: 'Concise - Short and punchy, key info only',
  detailed: 'Detailed - Comprehensive with all specs and identifiers',
  collector_focused: 'Collector-Focused - Emphasizes rarity and pressing details',
  keyword_rich: 'Keyword-Rich - Multiple search terms for broad reach',
  simple: 'Simple - Clean and minimal, artist and title focus',
}

export const TITLE_STYLE_EXAMPLES: Record<TitleStyle, string> = {
  seo_optimized: 'Pink Floyd - Dark Side of The Moon LP UK 1st Press Harvest SHVL 804 1973 VG+',
  concise: 'Pink Floyd - Dark Side of The Moon (1973 UK 1st Press) VG+',
  detailed: 'Pink Floyd - Dark Side of The Moon - Harvest SHVL 804 - UK 1st Press 1973 - Solid Blue Triangle - A3/B3 Matrix - Vinyl LP VG+/VG+',
  collector_focused: 'Pink Floyd Dark Side of The Moon 1973 UK 1st Press Harvest Solid Blue Triangle A3/B3',
  keyword_rich: 'Pink Floyd Dark Side Moon Vinyl LP 1973 Original UK Press Harvest SHVL 804 Classic Rock Prog Rare',
  simple: 'Pink Floyd - Dark Side of The Moon (1973)',
}
