import { CollectionItem, PriceEstimate } from './types'

export function calculateCollectionValue(items: CollectionItem[]): number {
  return items.reduce((total, item) => {
    const estimate = generatePriceEstimate(item)
    return total + estimate.estimateMid * item.quantity
  }, 0)
}

export function generatePriceEstimate(item: CollectionItem): PriceEstimate {
  const baseValue = calculateBaseValue(item)
  const conditionMultiplier = getConditionMultiplier(item.condition.mediaGrade, item.condition.sleeveGrade)
  const rarityMultiplier = getRarityMultiplier(item)
  
  const estimateMid = baseValue * conditionMultiplier * rarityMultiplier
  const estimateLow = estimateMid * 0.7
  const estimateHigh = estimateMid * 1.4
  
  const confidence = calculateConfidence(item)
  
  return {
    estimateLow: Math.round(estimateLow * 100) / 100,
    estimateMid: Math.round(estimateMid * 100) / 100,
    estimateHigh: Math.round(estimateHigh * 100) / 100,
    currency: item.purchaseCurrency,
    confidenceScore: confidence,
    drivers: [
      { name: 'Base market value', impact: 0.40 },
      { name: 'Condition adjustment', impact: 0.35 },
      { name: 'Pressing rarity', impact: 0.25 },
    ],
    comparableSales: Math.floor(Math.random() * 30) + 5,
  }
}

function calculateBaseValue(item: CollectionItem): number {
  const yearFactor = item.year < 1970 ? 1.5 : item.year < 1980 ? 1.3 : item.year < 1990 ? 1.2 : 1.0
  const formatFactor = item.format === 'LP' ? 1.2 : item.format === 'Boxset' ? 2.0 : 1.0
  
  const hashValue = hashString(item.artistName + item.releaseTitle)
  const basePrice = 15 + (hashValue % 85)
  
  return basePrice * yearFactor * formatFactor
}

function getConditionMultiplier(mediaGrade: string, sleeveGrade: string): number {
  const gradeValues: Record<string, number> = {
    M: 1.5,
    NM: 1.3,
    EX: 1.1,
    'VG+': 1.0,
    VG: 0.7,
    G: 0.4,
    F: 0.2,
    P: 0.1,
  }
  
  const mediaValue = gradeValues[mediaGrade] || 1.0
  const sleeveValue = gradeValues[sleeveGrade] || 1.0
  
  return (mediaValue * 0.7 + sleeveValue * 0.3)
}

function getRarityMultiplier(item: CollectionItem): number {
  const isUK = item.country === 'UK'
  const isOriginalPressing = item.catalogNumber?.includes('1st') || false
  
  let multiplier = 1.0
  
  if (isUK) multiplier *= 1.2
  if (isOriginalPressing) multiplier *= 1.5
  if (item.format === 'Boxset') multiplier *= 1.3
  
  return multiplier
}

function calculateConfidence(item: CollectionItem): number {
  let confidence = 0.5
  
  if (item.catalogNumber) confidence += 0.2
  if (item.condition.gradingNotes) confidence += 0.1
  if (item.pressingId) confidence += 0.15
  if (item.images && item.images.length > 0) confidence += 0.05
  
  return Math.min(confidence, 0.95)
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

export function formatCurrency(amount: number, currency: string = 'GBP'): string {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€'
  return `${symbol}${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    M: 'text-accent',
    NM: 'text-green-400',
    EX: 'text-blue-400',
    'VG+': 'text-cyan-400',
    VG: 'text-yellow-400',
    G: 'text-orange-400',
    F: 'text-red-400',
    P: 'text-red-600',
  }
  return colors[grade] || 'text-muted-foreground'
}

export function getStatusColor(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const colors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    owned: 'secondary',
    for_sale: 'default',
    sold: 'outline',
    traded: 'outline',
    archived: 'outline',
  }
  return colors[status] || 'default'
}
