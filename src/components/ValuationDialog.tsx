import { useState, useEffect } from 'react'
import { CollectionItem } from '@/lib/types'
import { DetailedPriceEstimate, generateDetailedValuation } from '@/lib/valuation-service'
import { formatCurrency, formatDate } from '@/lib/helpers'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { TrendUp, TrendDown, Minus, ChartLine, Tag, Clock, X } from '@phosphor-icons/react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ValuationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CollectionItem | null
}

export function ValuationDialog({ open, onOpenChange, item }: ValuationDialogProps) {
  const [valuation, setValuation] = useState<DetailedPriceEstimate | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open && item) {
      loadValuation()
    }
  }, [open, item])

  const loadValuation = async () => {
    if (!item) return
    
    setIsLoading(true)
    try {
      const estimate = await generateDetailedValuation(item)
      setValuation(estimate)
    } catch (error) {
      console.error('Failed to generate valuation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!item) return null

  const getTrendIcon = () => {
    if (!valuation?.marketTrend) return <Minus size={20} />
    if (valuation.marketTrend === 'rising') return <TrendUp size={20} className="text-green-400" />
    if (valuation.marketTrend === 'falling') return <TrendDown size={20} className="text-red-400" />
    return <Minus size={20} className="text-muted-foreground" />
  }

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">High Confidence</Badge>
    if (score >= 0.6) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Medium Confidence</Badge>
    return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Low Confidence</Badge>
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl">Market Valuation</DialogTitle>
              <DialogDescription className="mt-2">
                {item.artistName} - {item.releaseTitle}
              </DialogDescription>
              <div className="flex gap-2 mt-3">
                <Badge variant="outline">{item.condition.mediaGrade}/{item.condition.sleeveGrade}</Badge>
                <Badge variant="outline">{item.country}</Badge>
                <Badge variant="outline">{item.format}</Badge>
                {item.catalogNumber && <Badge variant="outline" className="font-mono text-xs">{item.catalogNumber}</Badge>}
              </div>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-12">
            <div className="flex items-center justify-center">
              <ChartLine size={48} className="text-muted-foreground animate-pulse" />
            </div>
            <p className="text-center text-muted-foreground">Analyzing market data...</p>
            <Progress value={66} className="w-full" />
          </div>
        ) : valuation ? (
          <Tabs defaultValue="estimate" className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="estimate">Estimate</TabsTrigger>
              <TabsTrigger value="comps">
                Comparables ({valuation.comparableSalesCount})
              </TabsTrigger>
              <TabsTrigger value="trends">Price Trends</TabsTrigger>
            </TabsList>

            <TabsContent value="estimate" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6 bg-muted/30 border-border">
                  <div className="text-sm text-muted-foreground mb-1">Low Estimate</div>
                  <div className="text-2xl font-bold">{formatCurrency(valuation.estimateLow, valuation.currency)}</div>
                </Card>
                <Card className="p-6 bg-primary/10 border-primary/30">
                  <div className="text-sm text-muted-foreground mb-1">Mid Estimate</div>
                  <div className="text-3xl font-bold text-primary">{formatCurrency(valuation.estimateMid, valuation.currency)}</div>
                </Card>
                <Card className="p-6 bg-muted/30 border-border">
                  <div className="text-sm text-muted-foreground mb-1">High Estimate</div>
                  <div className="text-2xl font-bold">{formatCurrency(valuation.estimateHigh, valuation.currency)}</div>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-semibold">Confidence Score</div>
                    {getConfidenceBadge(valuation.confidenceScore)}
                  </div>
                  <Progress value={valuation.confidenceScore * 100} className="h-3" />
                  <div className="text-sm text-muted-foreground mt-2">
                    {(valuation.confidenceScore * 100).toFixed(0)}% confidence based on available data
                  </div>
                </Card>

                {valuation.sellerRecommendedPrice && (
                  <Card className="p-6 bg-accent/10 border-accent/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag size={20} className="text-accent" />
                      <div className="text-sm font-semibold">Recommended Listing Price</div>
                    </div>
                    <div className="text-3xl font-bold text-accent">
                      {formatCurrency(valuation.sellerRecommendedPrice, valuation.currency)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      Priced to sell while maximizing value
                    </div>
                  </Card>
                )}
              </div>

              {valuation.marketTrend && (
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    {getTrendIcon()}
                    <div className="text-sm font-semibold">Market Trend</div>
                  </div>
                  <div className="text-lg capitalize">{valuation.marketTrend}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {valuation.marketTrend === 'rising' && 'Prices have been increasing recently'}
                    {valuation.marketTrend === 'stable' && 'Prices have remained relatively stable'}
                    {valuation.marketTrend === 'falling' && 'Prices have been declining recently'}
                  </div>
                </Card>
              )}

              <div>
                <h3 className="text-lg font-semibold mb-4">Valuation Drivers</h3>
                <div className="space-y-3">
                  {valuation.explanations.map((explanation, idx) => (
                    <Card key={idx} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{explanation.driver}</div>
                        <Badge variant="outline">{(explanation.impact * 100).toFixed(0)}% impact</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{explanation.description}</div>
                      <Progress value={explanation.impact * 100} className="h-2 mt-2" />
                    </Card>
                  ))}
                </div>
              </div>

              <Card className="p-6 bg-muted/50 border-muted">
                <div className="text-sm text-muted-foreground">
                  <strong>Note:</strong> These estimates are based on {valuation.comparableSalesCount} comparable sales, 
                  condition grading ({item.condition.mediaGrade}/{item.condition.sleeveGrade}), and pressing rarity signals. 
                  Actual market prices may vary based on buyer demand, listing quality, and marketplace dynamics.
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="comps" className="mt-6">
              {valuation.comparableSalesData.length === 0 ? (
                <div className="text-center py-12">
                  <Clock size={48} className="text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Comparables Found</h3>
                  <p className="text-muted-foreground">
                    No recent sales data available for this release. Estimate is based on heuristics.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {valuation.comparableSalesData.map((comp) => (
                    <Card key={comp.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{comp.title}</div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {comp.source.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {comp.conditionMedia}/{comp.conditionSleeve}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {comp.sellerCountry}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {formatDate(comp.soldAt)}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">
                            {formatCurrency(comp.soldPrice, comp.currency)}
                          </div>
                          {comp.url && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 mt-1"
                              onClick={() => window.open(comp.url, '_blank')}
                            >
                              View Listing
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="trends" className="mt-6">
              {valuation.priceHistory && valuation.priceHistory.length > 1 ? (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Price History</h3>
                  <div className="h-80 bg-card border border-border rounded-lg p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={valuation.priceHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(date) => new Date(date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis 
                          tickFormatter={(value) => `£${value}`}
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          labelFormatter={(date) => formatDate(date)}
                          formatter={(value) => [formatCurrency(Number(value || 0), 'GBP'), 'Sold Price']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="price" 
                          stroke="hsl(var(--accent))" 
                          strokeWidth={3}
                          dot={{ fill: 'hsl(var(--accent))', r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <ChartLine size={48} className="text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Insufficient Price History</h3>
                  <p className="text-muted-foreground">
                    Not enough historical sales data to display a trend chart.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
