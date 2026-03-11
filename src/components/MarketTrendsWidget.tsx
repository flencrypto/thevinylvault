import { useMemo } from 'react'
import { CollectionItem } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { TrendIndicator } from './TrendIndicator'
import { ChartLine, TrendUp, TrendDown } from '@phosphor-icons/react'

interface MarketTrendsWidgetProps {
  items: CollectionItem[]
}

export function MarketTrendsWidget({ items }: MarketTrendsWidgetProps) {
  const trendStats = useMemo(() => {
    let risingCount = 0
    let fallingCount = 0
    let flatCount = 0
    const itemTrends: { item: CollectionItem; trend: number }[] = []

    items.forEach(item => {
      if (item.priceHistory && item.priceHistory.length >= 2) {
        const sortedHistory = [...item.priceHistory].sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
        const oldest = sortedHistory[0].estimatedValue
        const newest = sortedHistory[sortedHistory.length - 1].estimatedValue
        const change = newest - oldest
        const changePercent = (change / oldest) * 100

        if (changePercent > 1) risingCount++
        else if (changePercent < -1) fallingCount++
        else flatCount++

        itemTrends.push({ item, trend: changePercent })
      }
    })

    itemTrends.sort((a, b) => b.trend - a.trend)

    const topGainers = itemTrends.slice(0, 3)
    const topLosers = itemTrends.slice(-3).reverse()

    return {
      risingCount,
      fallingCount,
      flatCount,
      topGainers,
      topLosers,
      totalWithHistory: itemTrends.length,
    }
  }, [items])

  if (trendStats.totalWithHistory === 0) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-border">
        <div className="flex items-center gap-3 mb-4">
          <ChartLine className="text-accent" size={24} weight="bold" />
          <h3 className="text-lg font-semibold">Market Trends</h3>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          <p>No price history available yet.</p>
          <p className="text-sm mt-1">Trends will appear as items are tracked over time.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-border">
      <div className="flex items-center gap-3 mb-4">
        <ChartLine className="text-accent" size={24} weight="bold" />
        <h3 className="text-lg font-semibold">Market Trends</h3>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendUp className="text-green-500" size={20} weight="bold" />
          </div>
          <div className="text-2xl font-bold text-green-500">{trendStats.risingCount}</div>
          <div className="text-xs text-muted-foreground">Rising</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendDown className="text-red-500" size={20} weight="bold" />
          </div>
          <div className="text-2xl font-bold text-red-500">{trendStats.fallingCount}</div>
          <div className="text-xs text-muted-foreground">Falling</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-muted-foreground">{trendStats.flatCount}</div>
          <div className="text-xs text-muted-foreground">Stable</div>
        </div>
      </div>

      {trendStats.topGainers.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-medium text-muted-foreground mb-2">Top Gainers</div>
          <div className="space-y-2">
            {trendStats.topGainers.map(({ item, trend }) => (
              <div key={item.id} className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-lg p-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.releaseTitle}</div>
                  <div className="text-xs text-muted-foreground truncate">{item.artistName}</div>
                </div>
                <TrendIndicator value={trend} showIcon showValue size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {trendStats.topLosers.length > 0 && trendStats.topLosers[0].trend < -1 && (
        <div>
          <div className="text-sm font-medium text-muted-foreground mb-2">Top Losers</div>
          <div className="space-y-2">
            {trendStats.topLosers.map(({ item, trend }) => (
              <div key={item.id} className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.releaseTitle}</div>
                  <div className="text-xs text-muted-foreground truncate">{item.artistName}</div>
                </div>
                <TrendIndicator value={trend} showIcon showValue size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
