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
