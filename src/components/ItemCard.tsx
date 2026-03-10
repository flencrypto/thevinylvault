import { CollectionItem } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getGradeColor, getStatusColor, formatCurrency, generatePriceEstimate } from '@/lib/helpers'
import { FORMAT_LABELS, STATUS_LABELS } from '@/lib/types'

interface ItemCardProps {
  item: CollectionItem
  onClick?: () => void
}

export function ItemCard({ item, onClick }: ItemCardProps) {
  const estimate = generatePriceEstimate(item)

  return (
    <Card 
      className="transition-all duration-200 hover:shadow-lg hover:scale-[1.01] cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex gap-4">
          <div className="w-24 h-24 bg-secondary rounded flex items-center justify-center flex-shrink-0 border border-border">
            <div className="text-4xl text-muted-foreground">♫</div>
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
                <div className="text-lg font-bold text-accent">
                  {formatCurrency(estimate.estimateMid, item.purchaseCurrency)}
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
}
