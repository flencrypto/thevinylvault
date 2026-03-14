export type MediaGrade = 'M' | 'NM' | 'EX' | 'VG+' | 'VG' | 'G' | 'F' | 'P'
export type SleeveGrade = 'M' | 'NM' | 'EX' | 'VG+' | 'VG' | 'G' | 'F' | 'P'
export type ItemStatus = 'owned' | 'for_sale' | 'sold' | 'traded' | 'archived'
export type SourceType = 'shop' | 'ebay' | 'discogs' | 'fair' | 'gift' | 'unknown'
export type Format = 'LP' | '7in' | '12in' | 'EP' | 'Boxset'

export interface Artist {
  id: string
  name: string
  country?: string
  formedYear?: number
}

export interface Label {
  id: string
  name: string
  country?: string
}

export interface Release {
  id: string
  title: string
  artistId: string
  artistName: string
  releaseYear: number
  country: string
  catalogNumber?: string
  labelId?: string
  labelName?: string
}

export interface Pressing {
  id: string
  releaseId: string
  pressingName: string
  country: string
  year: number
  format: Format
  vinylColor?: string
  barcodes?: string[]
  matrixNumbers?: string[]
}

export interface ItemCondition {
  mediaGrade: MediaGrade
  sleeveGrade: SleeveGrade
  gradingStandard: 'Goldmine' | 'RecordCollector'
  gradingNotes?: string
  gradedAt: string
}

export interface CollectionItem {
  id: string
  collectionId: string
  pressingId?: string
  releaseId?: string
  customTitle?: string
  artistName: string
  releaseTitle: string
  format: Format
  year: number
  country: string
  catalogNumber?: string
  acquisitionDate?: string
  purchasePrice?: number
  purchaseCurrency: string
  sourceType: SourceType
  sourceReference?: string
  quantity: number
  storageLocation?: string
  status: ItemStatus
  notes?: string
  condition: ItemCondition
  images?: string[]
  priceHistory?: PriceHistoryEntry[]
  createdAt: string
  updatedAt: string
}

export interface PriceEstimate {
  estimateLow: number
  estimateMid: number
  estimateHigh: number
  currency: string
  confidenceScore: number
  drivers?: Array<{ name: string; impact: number }>
  comparableSales?: number
}

export interface PriceHistoryEntry {
  id: string
  timestamp: string
  estimatedValue: number
  currency: string
  mediaGrade: MediaGrade
  sleeveGrade: SleeveGrade
  source: 'manual' | 'auto' | 'market_update'
  notes?: string
}

export interface CollectionStats {
  totalItems: number
  totalValue: number
  currency: string
  itemsByStatus: Record<ItemStatus, number>
  itemsByFormat: Record<Format, number>
  recentAdditions: number
  averageValue: number
}

export interface ListingDraft {
  id: string
  itemId: string
  title: string
  subtitle?: string
  description: string
  price: number
  currency: string
  conditionSummary: string
  generatedByAi: boolean
  createdAt: string
  updatedAt?: string
  seoKeywords?: string[]
}

export type ImageType = 'front_cover' | 'back_cover' | 'label' | 'runout' | 'insert' | 'spine'

export interface ItemImage {
  id: string
  itemId?: string
  type: ImageType
  dataUrl: string
  mimeType: string
  uploadedAt: string
  imgbbUrl?: string
  imgbbDisplayUrl?: string
  imgbbThumbUrl?: string
  imgbbDeleteUrl?: string
}

export interface PressingCandidate {
  id: string
  pressingName: string
  releaseTitle: string
  artistName: string
  year: number
  country: string
  format: Format
  catalogNumber?: string
  matrixNumbers?: string[]
  discogsUrl?: string
  discogsId?: number
  discogsReleaseId?: number
  discogsVariant?: string
  imageUrls?: string[]
  confidence: number
  matchedIdentifiers: string[]
  reasoning: string
}

export interface ImageAnalysisResult {
  extractedText: string[]
  identifiedLabels: string[]
  matrixNumbers: string[]
  catalogNumbers: string[]
  barcodes: string[]
  confidence: number
}

export const GRADE_DESCRIPTIONS: Record<MediaGrade, string> = {
  M: 'Mint - Perfect condition, never played',
  NM: 'Near Mint - Looks and sounds like new',
  EX: 'Excellent - Minor signs of use, excellent sound',
  'VG+': 'Very Good Plus - Light wear, good sound quality',
  VG: 'Very Good - Noticeable wear, still plays well',
  G: 'Good - Significant wear, background noise',
  F: 'Fair - Heavy wear, may skip',
  P: 'Poor - Damaged, barely playable',
}

export const FORMAT_LABELS: Record<Format, string> = {
  LP: '12" LP',
  '7in': '7" Single',
  '12in': '12" Single',
  EP: 'EP',
  Boxset: 'Box Set',
}

export const STATUS_LABELS: Record<ItemStatus, string> = {
  owned: 'In Collection',
  for_sale: 'For Sale',
  sold: 'Sold',
  traded: 'Traded',
  archived: 'Archived',
}

export type WatchlistType = 'artist' | 'release' | 'pressing' | 'freetext'
export type BargainSignalType = 
  | 'title_mismatch' 
  | 'low_price' 
  | 'wrong_category' 
  | 'job_lot' 
  | 'promo_keywords' 
  | 'poor_metadata'

export interface WatchlistItem {
  id: string
  collectionId: string
  type: WatchlistType
  artistName?: string
  releaseTitle?: string
  pressingDetails?: string
  searchQuery?: string
  targetPrice?: number
  targetCurrency: string
  notifyOnMatch: boolean
  createdAt: string
  lastScannedAt?: string
}

export interface BargainSignal {
  type: BargainSignalType
  score: number
  description: string
  evidence?: string
}

export interface MarketListing {
  id: string
  source: 'ebay' | 'discogs' | 'reverb' | 'other'
  externalId: string
  title: string
  description?: string
  price: number
  currency: string
  condition?: string
  seller: string
  location?: string
  imageUrls?: string[]
  listedAt: string
  url: string
}

export interface BargainCard {
  id: string
  listing: MarketListing
  watchlistItemId?: string
  bargainScore: number
  estimatedValue?: number
  estimatedUpside?: number
  signals: BargainSignal[]
  matchedRelease?: {
    artistName: string
    releaseTitle: string
    year: number
    catalogNumber?: string
  }
  savedAt: string
  viewed: boolean
}

export interface WatchlistMatch {
  id: string
  watchlistItemId: string
  listingId: string
  matchScore: number
  matchReason: string
  notifiedAt?: string
  createdAt: string
}

export interface MintedNFT {
  id: string
  itemId: string
  mintAddress: string
  metadataUri: string
  transactionSignature: string
  network: 'mainnet-beta' | 'devnet' | 'testnet'
  mintedAt: string
  ownerAddress: string
  sellerFeeBasisPoints: number
}

export interface NFTTransfer {
  id: string
  nftId: string
  fromAddress: string
  toAddress: string
  transactionSignature: string
  transferredAt: string
  salePrice?: number
  currency?: string
}

export type NFTTransactionType = 
  | 'mint' 
  | 'transfer' 
  | 'sale' 
  | 'list' 
  | 'delist' 
  | 'burn'
  | 'update_metadata'

export interface NFTTransaction {
  id: string
  nftId: string
  type: NFTTransactionType
  fromAddress?: string
  toAddress?: string
  transactionSignature: string
  blockTime: string
  salePrice?: number
  saleCurrency?: string
  marketplace?: string
  fee?: number
  feePayer?: string
  status: 'confirmed' | 'pending' | 'failed'
  metadata?: Record<string, any>
}

export type SolanaNetwork = 'mainnet-beta' | 'devnet' | 'testnet'

export type TrendAlertType = 'significant_gain' | 'significant_loss' | 'rapid_increase' | 'rapid_decrease' | 'milestone_reached'
export type TrendAlertSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface TrendAlert {
  id: string
  itemId: string
  itemTitle: string
  artistName: string
  type: TrendAlertType
  severity: TrendAlertSeverity
  message: string
  previousValue: number
  currentValue: number
  changeAmount: number
  changePercent: number
  currency: string
  createdAt: string
  read: boolean
  dismissed: boolean
}
