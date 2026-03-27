import { CollectionItem } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VinylDisc } from '@/components/ui/vinyl-disc'
import { colors } from '@/lib/design-tokens'
import { getGradeColor, getStatusColor, formatCurrency, generatePriceEstimate } from '@/lib/helpers'
import { FORMAT_LABELS, STATUS_LABELS } from '@/lib/types'
import { TrendBadge } from './TrendIndicator'
import React, { useMemo } from 'react'

/** Maps a vinyl media grade to the VinylDisc label colour token. */
function gradeToLabelColor(grade: string): string {
  if (grade === 'M' || grade === 'NM') return colors.amber[500]
  if (grade === 'VG+') return colors.purple[500]
  return colors.slate[600]
}

interface ItemCardProps {
  item: CollectionItem
  onItemClick?: (item: CollectionItem) => void
}

export const ItemCard = React.memo(function ItemCard({ item, onItemClick }: ItemCardProps) {
  const estimate = generatePriceEstimate(item)

  const trendData = useMemo(() => {
    if (!item.priceHistory || item.priceHistory.length < 2) {
      return null
    }

    const sortedHistory = [...item.priceHistory].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    const oldest = sortedHistory[0].estimatedValue
    const newest = sortedHistory[sortedHistory.length - 1].estimatedValue
    const change = newest - oldest
    const changePercent = (change / oldest) * 100

    return {
      changePercent,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
    }
  }, [item.priceHistory])

  return (
    <Card 
      className="transition-all duration-200 hover:shadow-lg hover:scale-[1.01] cursor-pointer"
      onClick={onItemClick ? () => onItemClick(item) : undefined}
    >
      <CardContent className="p-6">
        <div className="flex gap-4">
          <div className="w-24 h-24 bg-secondary rounded flex items-center justify-center flex-shrink-0 border border-border overflow-hidden">
            <VinylDisc
              size="md"
              labelColor={gradeToLabelColor(item.condition.mediaGrade)}
              labelText={item.format === '7in' ? '7"' : item.format === '12in' ? '12"' : item.format}
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg leading-tight truncate">
                  {item.releaseTitle}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {item.artistName}
                </p>
              </div>
              <Badge variant={getStatusColor(item.status)} className="flex-shrink-0">
                {STATUS_LABELS[item.status]}
              </Badge>
            </div>
            
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
              <span className="font-mono">{FORMAT_LABELS[item.format]}</span>
              <span>•</span>
              <span>{item.year}</span>
              <span>•</span>
              <span>{item.country}</span>
              {item.catalogNumber && (
                <>
                  <span>•</span>
                  <span className="font-mono">{item.catalogNumber}</span>
                </>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Media: </span>
                  <span className={`font-semibold ${getGradeColor(item.condition.mediaGrade)}`}>
                    {item.condition.mediaGrade}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Sleeve: </span>
                  <span className={`font-semibold ${getGradeColor(item.condition.sleeveGrade)}`}>
                    {item.condition.sleeveGrade}
                  </span>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <div className="text-lg font-bold text-accent">
                    {formatCurrency(estimate.estimateMid, item.purchaseCurrency)}
                  </div>
                  {trendData && (
                    <TrendBadge value={trendData.changePercent} size="sm" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  est. value
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
