import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  ChartLine, 
  TrendUp, 
  TrendDown, 
  Minus,
  MapPin,
  User,
  Tag,
  Sparkle,
  Bell,
  Info
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  fetchDiscogsPriceStats,
  trackHistoricalPrices,
  analyzeMarketTrend,
  generateMarketInsights,
  analyzeSellerPatterns,
  createPriceAlert,
  type DiscogsPriceStats,
  type DiscogsMarketTrend,
  type DiscogsMarketInsights,
  type DiscogsSellerStats,
} from '@/lib/discogs-marketplace-analytics'
import { DiscogsApiConfig } from '@/lib/marketplace-discogs'

interface DiscogsMarketAnalysisDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  releaseId: number
  releaseName: string
  discogsConfig: DiscogsApiConfig
}

export default function DiscogsMarketAnalysisDialog({
  open,
  onOpenChange,
  releaseId,
  releaseName,
  discogsConfig,
}: DiscogsMarketAnalysisDialogProps) {
  const [priceStats, setPriceStats] = useState<DiscogsPriceStats | null>(null)
  const [marketTrend, setMarketTrend] = useState<DiscogsMarketTrend | null>(null)
  const [insights, setInsights] = useState<DiscogsMarketInsights | null>(null)
  const [sellerStats, setSellerStats] = useState<DiscogsSellerStats[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const loadAnalytics = async () => {
    setIsLoading(true)
    try {
      const stats = await fetchDiscogsPriceStats(releaseId, discogsConfig)
      if (!stats) {
        toast.error('No marketplace data found for this release')
        return
      }
      setPriceStats(stats)

      await trackHistoricalPrices(releaseId, discogsConfig)

      const trend = await analyzeMarketTrend(releaseId, discogsConfig)
      setMarketTrend(trend)

      const marketInsights = await generateMarketInsights(releaseId, discogsConfig)
      setInsights(marketInsights)

      const sellers = await analyzeSellerPatterns(releaseId, discogsConfig)
      setSellerStats(sellers.slice(0, 10))

      toast.success('Market analysis complete')
    } catch (error) {
      console.error('Failed to load analytics:', error)
      toast.error('Failed to load market analytics')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreatePriceAlert = async () => {
    if (!priceStats) return
    
    const targetPrice = priceStats.lowestPrice * 0.9
    
    try {
      await createPriceAlert(releaseId, releaseName, targetPrice, priceStats.currency)
      toast.success(`Price alert created for ${priceStats.currency} ${targetPrice.toFixed(2)}`)
    } catch (error) {
      toast.error('Failed to create price alert')
    }
  }

  const getTrendIcon = (trend?: string) => {
    if (!trend) return <Minus className="w-4 h-4" />
    switch (trend) {
      case 'rising':
        return <TrendUp className="w-4 h-4 text-red-400" weight="bold" />
      case 'falling':
        return <TrendDown className="w-4 h-4 text-green-400" weight="bold" />
      case 'volatile':
        return <Sparkle className="w-4 h-4 text-yellow-400" weight="fill" />
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getMarketDepthBadge = (depth?: string) => {
    const variants: Record<string, string> = {
      deep: 'bg-green-500/20 text-green-300',
      moderate: 'bg-blue-500/20 text-blue-300',
      shallow: 'bg-yellow-500/20 text-yellow-300',
      rare: 'bg-red-500/20 text-red-300',
    }
    return variants[depth || 'moderate'] || variants.moderate
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-xl text-white flex items-center gap-2">
            <ChartLine className="w-6 h-6 text-accent" weight="bold" />
            Discogs Market Analysis
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {releaseName}
          </DialogDescription>
        </DialogHeader>

        {!priceStats && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <ChartLine className="w-16 h-16 text-slate-600" weight="bold" />
            <p className="text-slate-400 text-center">
              Load comprehensive market data from Discogs including<br />
              price statistics, trends, seller patterns, and market insights
            </p>
            <Button onClick={loadAnalytics} className="mt-4" disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Load Market Analysis'}
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400">Analyzing Discogs marketplace data...</p>
          </div>
        )}

        {priceStats && !isLoading && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-slate-800/50">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="conditions">Conditions</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="sellers">Sellers</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[50vh] mt-4">
              <TabsContent value="overview" className="space-y-4 pr-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-slate-400">Lowest Price</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        {priceStats.currency} {priceStats.lowestPrice.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-slate-400">Median Price</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        {priceStats.currency} {priceStats.medianPrice.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-slate-400">Highest Price</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        {priceStats.currency} {priceStats.highestPrice.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-sm text-white flex items-center gap-2">
                      <Sparkle className="w-4 h-4 text-accent" weight="fill" />
                      Market Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {insights && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">Market Depth</span>
                          <Badge className={getMarketDepthBadge(insights.marketDepth)}>
                            {insights.marketDepth}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">Liquidity Score</span>
                          <span className="text-sm font-semibold text-white">
                            {insights.liquidityScore}/100
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">Price Stability</span>
                          <Badge variant="secondary">{insights.priceStability}</Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">Fair Value</span>
                          <span className="text-sm font-semibold text-white">
                            {priceStats.currency} {insights.fairValuePrice.toFixed(2)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-700">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Recommended Buy</div>
                            <div className="text-sm font-semibold text-green-400">
                              {priceStats.currency} {insights.recommendedBuyPrice.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Recommended Sell</div>
                            <div className="text-sm font-semibold text-accent">
                              {priceStats.currency} {insights.recommendedSellPrice.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 mt-4 pt-4 border-t border-slate-700">
                          {insights.insights.map((insight, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <Info className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" weight="fill" />
                              <span className="text-xs text-slate-300">{insight}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <Button 
                      onClick={handleCreatePriceAlert}
                      variant="outline"
                      size="sm"
                      className="w-full mt-4"
                    >
                      <Bell className="w-4 h-4 mr-2" />
                      Create Price Alert
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-sm text-white">Price Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {priceStats.priceDistribution.map((dist, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-24">{dist.range} {priceStats.currency}</span>
                          <div className="flex-1 bg-slate-700 rounded-full h-2">
                            <div
                              className="bg-accent rounded-full h-2 transition-all"
                              style={{
                                width: `${(dist.count / priceStats.totalListings) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 w-12 text-right">{dist.count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="conditions" className="space-y-4 pr-4">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-sm text-white">Prices by Condition</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(priceStats.byCondition)
                        .sort(([, a], [, b]) => b.avgPrice - a.avgPrice)
                        .map(([condition, data]) => (
                          <div key={condition} className="border border-slate-700 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="outline" className="font-mono">
                                {condition}
                              </Badge>
                              <span className="text-xs text-slate-400">{data.count} listings</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <div className="text-slate-500">Min</div>
                                <div className="font-semibold text-slate-300">
                                  {priceStats.currency} {data.minPrice.toFixed(2)}
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-500">Avg</div>
                                <div className="font-semibold text-white">
                                  {priceStats.currency} {data.avgPrice.toFixed(2)}
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-500">Max</div>
                                <div className="font-semibold text-slate-300">
                                  {priceStats.currency} {data.maxPrice.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-sm text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-accent" weight="fill" />
                      Prices by Country
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(priceStats.byCountry)
                        .sort(([, a], [, b]) => b.count - a.count)
                        .slice(0, 10)
                        .map(([country, data]) => (
                          <div key={country} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              <span className="text-sm text-slate-300">{country}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-slate-500">{data.count} listings</span>
                              <span className="text-sm font-semibold text-white">
                                {priceStats.currency} {data.avgPrice.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="trends" className="space-y-4 pr-4">
                {marketTrend ? (
                  <>
                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardHeader>
                        <CardTitle className="text-sm text-white flex items-center gap-2">
                          {getTrendIcon(marketTrend.trend)}
                          Market Trend
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">Trend Status</span>
                          <Badge className={
                            marketTrend.trend === 'rising' ? 'bg-red-500/20 text-red-300' :
                            marketTrend.trend === 'falling' ? 'bg-green-500/20 text-green-300' :
                            marketTrend.trend === 'volatile' ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-blue-500/20 text-blue-300'
                          }>
                            {marketTrend.trend}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">30-Day Change</div>
                            <div className="text-lg font-semibold text-white">
                              {marketTrend.priceChangePercent30d > 0 ? '+' : ''}
                              {marketTrend.priceChangePercent30d.toFixed(1)}%
                            </div>
                            <div className="text-xs text-slate-400">
                              {marketTrend.priceChange30d > 0 ? '+' : ''}
                              {priceStats.currency} {marketTrend.priceChange30d.toFixed(2)}
                            </div>
                          </div>

                          {marketTrend.priceChange90d !== undefined && (
                            <div>
                              <div className="text-xs text-slate-500 mb-1">90-Day Change</div>
                              <div className="text-lg font-semibold text-white">
                                {marketTrend.priceChangePercent90d! > 0 ? '+' : ''}
                                {marketTrend.priceChangePercent90d!.toFixed(1)}%
                              </div>
                              <div className="text-xs text-slate-400">
                                {marketTrend.priceChange90d > 0 ? '+' : ''}
                                {priceStats.currency} {marketTrend.priceChange90d.toFixed(2)}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                          <span className="text-sm text-slate-400">Listing Velocity</span>
                          <Badge variant="secondary">{marketTrend.velocity}</Badge>
                        </div>

                        <div className="bg-slate-900/50 rounded-lg p-3 mt-4">
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {marketTrend.analysis}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="py-12 text-center">
                      <p className="text-slate-400 text-sm">
                        Not enough historical data for trend analysis.<br />
                        Check back after tracking this release for 30+ days.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="sellers" className="space-y-4 pr-4">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-sm text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-accent" weight="fill" />
                      Top Sellers by Price
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {sellerStats.length > 0 ? (
                      <div className="space-y-3">
                        {sellerStats.map((seller, idx) => (
                          <div key={seller.username} className="border border-slate-700 rounded-lg p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>
                                <span className="text-sm font-semibold text-white">{seller.username}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {seller.totalListings} {seller.totalListings === 1 ? 'listing' : 'listings'}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <div className="text-slate-500">Avg Price</div>
                                <div className="font-semibold text-white">
                                  {priceStats.currency} {seller.averagePrice.toFixed(2)}
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-500">Range</div>
                                <div className="font-semibold text-slate-300">
                                  {seller.priceRange.min.toFixed(0)}-{seller.priceRange.max.toFixed(0)}
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-500">Location</div>
                                <div className="font-semibold text-slate-300 truncate">
                                  {seller.location}
                                </div>
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1">
                              {seller.conditions.slice(0, 3).map(cond => (
                                <Badge key={cond} variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {cond}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-slate-400 text-sm">No seller data available</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
