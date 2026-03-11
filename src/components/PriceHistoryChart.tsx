import { useMemo } from 'react'
import { PriceHistoryEntry } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/helpers'
import { TrendUp, TrendDown, Minus } from '@phosphor-icons/react'

interface PriceHistoryChartProps {
  priceHistory: PriceHistoryEntry[]
  currency: string
  currentValue: number
}

export function PriceHistoryChart({ priceHistory, currency, currentValue }: PriceHistoryChartProps) {
  const sortedHistory = useMemo(() => {
    return [...priceHistory].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
  }, [priceHistory])

  const chartData = useMemo(() => {
    if (sortedHistory.length === 0) return []
    
    const minValue = Math.min(...sortedHistory.map(h => h.estimatedValue))
    const maxValue = Math.max(...sortedHistory.map(h => h.estimatedValue))
    const range = maxValue - minValue || 1

    return sortedHistory.map(entry => ({
      ...entry,
      percentage: ((entry.estimatedValue - minValue) / range) * 100
    }))
  }, [sortedHistory])

  const trend = useMemo(() => {
    if (sortedHistory.length < 2) return null
    
    const oldest = sortedHistory[0].estimatedValue
    const newest = sortedHistory[sortedHistory.length - 1].estimatedValue
    const change = newest - oldest
    const changePercent = (change / oldest) * 100

    return {
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
      change,
      changePercent
    }
  }, [sortedHistory])

  if (priceHistory.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed">
        <div className="text-muted-foreground mb-2">No price history yet</div>
        <div className="text-sm text-muted-foreground">
          Price history will be tracked automatically as the item's value changes
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {trend && (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            {trend.direction === 'up' && (
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <TrendUp className="text-green-500" size={20} weight="bold" />
              </div>
            )}
            {trend.direction === 'down' && (
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <TrendDown className="text-red-500" size={20} weight="bold" />
              </div>
            )}
            {trend.direction === 'flat' && (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Minus className="text-muted-foreground" size={20} weight="bold" />
              </div>
            )}
            <div>
              <div className="text-sm text-muted-foreground">Overall Trend</div>
              <div className={`text-lg font-bold ${
                trend.direction === 'up' ? 'text-green-500' : 
                trend.direction === 'down' ? 'text-red-500' : 
                'text-muted-foreground'
              }`}>
                {trend.change > 0 ? '+' : ''}{formatCurrency(trend.change, currency)}
                {' '}
                ({trend.changePercent > 0 ? '+' : ''}{trend.changePercent.toFixed(1)}%)
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Data Points</div>
            <div className="text-lg font-bold">{priceHistory.length}</div>
          </div>
        </div>
      )}

      <Card className="p-6">
        <div className="relative h-64 mb-8">
          <div className="absolute inset-0 flex flex-col justify-between">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="border-b border-border/30" />
            ))}
          </div>

          <div className="absolute inset-0 flex items-end justify-between gap-1 px-4">
            {chartData.map((point, idx) => (
              <div key={point.id} className="flex-1 flex flex-col items-center justify-end group">
                <div className="relative w-full max-w-[60px]">
                  <div 
                    className="w-full bg-accent/80 rounded-t transition-all hover:bg-accent cursor-pointer"
                    style={{ height: `${Math.max(point.percentage, 5)}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-popover border border-border rounded px-2 py-1 text-xs font-semibold shadow-lg z-10">
                      {formatCurrency(point.estimatedValue, currency)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {sortedHistory.slice().reverse().map((entry, idx) => (
            <div 
              key={entry.id} 
              className={`p-3 rounded-lg border ${idx === 0 ? 'bg-accent/10 border-accent/30' : 'bg-muted/30 border-border/50'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`text-lg font-bold ${idx === 0 ? 'text-accent' : ''}`}>
                      {formatCurrency(entry.estimatedValue, entry.currency)}
                    </div>
                    {idx === 0 && (
                      <span className="text-xs px-2 py-0.5 bg-accent text-accent-foreground rounded-full font-semibold">
                        Latest
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDate(entry.timestamp)}</span>
                    <span>•</span>
                    <span className="font-mono">{entry.mediaGrade}/{entry.sleeveGrade}</span>
                    <span>•</span>
                    <span className="capitalize">{entry.source.replace('_', ' ')}</span>
                  </div>
                  {entry.notes && (
                    <div className="text-xs text-muted-foreground mt-1 italic">
                      {entry.notes}
                    </div>
                  )}
                </div>
                
                {idx < sortedHistory.length - 1 && (
                  <div className={`text-right ${
                    entry.estimatedValue > sortedHistory[sortedHistory.length - idx - 2].estimatedValue 
                      ? 'text-green-500' 
                      : entry.estimatedValue < sortedHistory[sortedHistory.length - idx - 2].estimatedValue
                      ? 'text-red-500'
                      : 'text-muted-foreground'
                  }`}>
                    <div className="text-sm font-semibold">
                      {entry.estimatedValue > sortedHistory[sortedHistory.length - idx - 2].estimatedValue ? '+' : ''}
                      {formatCurrency(
                        entry.estimatedValue - sortedHistory[sortedHistory.length - idx - 2].estimatedValue, 
                        currency
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
