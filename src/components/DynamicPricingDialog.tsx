import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { CollectionItem } from '@/lib/types'
import { generateAutoPricing, AutoPricingRecommendation } from '@/lib/dynamic-pricing-ai'
import { 
  TrendUp, 
  TrendDown, 
  Minus,
  CircleNotch, 
  Sparkle,
  ChartLine,
  Target,
  Lightning,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Equals
} from '@phosphor-icons/react'
import { toast } from 'sonner'

interface DynamicPricingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CollectionItem
  onPriceAccept?: (price: number, recommendation: AutoPricingRecommendation) => void
}

export default function DynamicPricingDialog({ 
  open, 
  onOpenChange, 
  item,
  onPriceAccept 
}: DynamicPricingDialogProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [recommendation, setRecommendation] = useState<AutoPricingRecommendation | null>(null)
  const [selectedStrategy, setSelectedStrategy] = useState<'competitive' | 'premium' | 'quick_sale' | 'market_rate'>('market_rate')

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    try {
      const result = await generateAutoPricing(item, {
        strategy: selectedStrategy,
        targetProfitMargin: 0.20,
        considerSeasonality: true
      })
      setRecommendation(result)
      toast.success('Pricing analysis complete!')
    } catch (error) {
      console.error('Pricing analysis failed:', error)
      toast.error('Failed to generate pricing recommendation')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAcceptPrice = () => {
    if (recommendation && onPriceAccept) {
      onPriceAccept(recommendation.recommendedPrice, recommendation)
      onOpenChange(false)
      toast.success(`Price set to £${recommendation.recommendedPrice.toFixed(2)}`)
    }
  }

  const getTrendIcon = () => {
    if (!recommendation) return null
    if (recommendation.marketIntelligence.trendMomentum === 'increasing') 
      return <TrendUp className="w-5 h-5 text-green-400" weight="bold" />
    if (recommendation.marketIntelligence.trendMomentum === 'decreasing') 
      return <TrendDown className="w-5 h-5 text-red-400" weight="bold" />
    return <Minus className="w-5 h-5 text-muted-foreground" weight="bold" />
  }

  const getCompetitiveIcon = () => {
    if (!recommendation) return null
    if (recommendation.competitivePosition === 'below_market') 
      return <ArrowDown className="w-4 h-4 text-green-400" weight="bold" />
    if (recommendation.competitivePosition === 'above_market') 
      return <ArrowUp className="w-4 h-4 text-yellow-400" weight="bold" />
    return <Equals className="w-4 h-4 text-blue-400" weight="bold" />
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkle className="w-6 h-6 text-accent" weight="fill" />
            AI Dynamic Pricing
          </DialogTitle>
          <DialogDescription>
            Get intelligent pricing recommendations based on real market data and trends
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="p-4 bg-muted/30">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Item Details</Label>
              <div className="text-sm">
                <p className="font-semibold">{item.artistName} - {item.releaseTitle}</p>
                <p className="text-muted-foreground">
                  {item.format} • {item.year} • {item.country} • {item.condition.mediaGrade}/{item.condition.sleeveGrade}
                </p>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <Label>Pricing Strategy</Label>
            <Select 
              value={selectedStrategy} 
              onValueChange={(value: string) => setSelectedStrategy(value as 'competitive' | 'premium' | 'quick_sale' | 'market_rate')}
              disabled={isAnalyzing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market_rate">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Market Rate - Balanced approach
                  </div>
                </SelectItem>
                <SelectItem value="competitive">
                  <div className="flex items-center gap-2">
                    <Lightning className="w-4 h-4" />
                    Competitive - Price to sell
                  </div>
                </SelectItem>
                <SelectItem value="premium">
                  <div className="flex items-center gap-2">
                    <Sparkle className="w-4 h-4" />
                    Premium - Maximize profit
                  </div>
                </SelectItem>
                <SelectItem value="quick_sale">
                  <div className="flex items-center gap-2">
                    <TrendUp className="w-4 h-4" />
                    Quick Sale - Fast turnover
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {!recommendation && (
              <Button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing}
                className="w-full gap-2"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <CircleNotch className="w-5 h-5 animate-spin" />
                    Analyzing Market Data...
                  </>
                ) : (
                  <>
                    <ChartLine className="w-5 h-5" weight="bold" />
                    Generate Pricing Recommendation
                  </>
                )}
              </Button>
            )}
          </div>

          {isAnalyzing && (
            <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CircleNotch className="w-4 h-4 animate-spin" />
                  Analyzing market trends and comparable sales...
                </div>
                <Progress value={66} className="h-2" />
              </div>
            </Card>
          )}

          {recommendation && (
            <div className="space-y-6">
              <Card className="p-6 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/30">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Recommended Price</Label>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className="text-4xl font-bold text-accent">
                        £{recommendation.recommendedPrice.toFixed(2)}
                      </p>
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle className="w-3 h-3" weight="fill" />
                        {Math.round(recommendation.confidence * 100)}% confidence
                      </Badge>
                    </div>
                  </div>
                  {getTrendIcon()}
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Price Floor</Label>
                    <p className="font-semibold text-lg">£{recommendation.priceFloor.toFixed(2)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Price Ceiling</Label>
                    <p className="font-semibold text-lg">£{recommendation.priceCeiling.toFixed(2)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Profit Margin</Label>
                    <p className={`font-semibold text-lg ${recommendation.profitMargin > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {recommendation.profitMargin > 0 ? '+' : ''}{(recommendation.profitMargin * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Strategy</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {recommendation.strategy.strategy.replace('_', ' ')}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {recommendation.strategy.description}
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">Market Position</Label>
                  <div className="flex items-center gap-2">
                    {getCompetitiveIcon()}
                    <span className="font-semibold capitalize">
                      {recommendation.competitivePosition.replace('_', ' ')}
                    </span>
                  </div>
                </Card>

                <Card className="p-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">Expected Sale Speed</Label>
                  <div className="flex items-center gap-2">
                    <Lightning className={`w-4 h-4 ${
                      recommendation.expectedSaleSpeed === 'fast' ? 'text-green-400' :
                      recommendation.expectedSaleSpeed === 'moderate' ? 'text-yellow-400' :
                      'text-orange-400'
                    }`} weight="fill" />
                    <span className="font-semibold capitalize">{recommendation.expectedSaleSpeed}</span>
                  </div>
                </Card>
              </div>

              <Card className="p-5">
                <Label className="text-sm font-semibold mb-3 block">Market Intelligence</Label>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Demand Signal:</span>
                    <Badge variant="secondary" className="ml-2 capitalize">
                      {recommendation.marketIntelligence.demandSignal}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Supply Level:</span>
                    <Badge variant="secondary" className="ml-2 capitalize">
                      {recommendation.marketIntelligence.supplyLevel}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Market Trend:</span>
                    <Badge variant="secondary" className="ml-2 capitalize">
                      {recommendation.marketIntelligence.trendMomentum}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Seasonal Factor:</span>
                    <Badge variant="secondary" className="ml-2">
                      {((recommendation.marketIntelligence.seasonalFactor - 1) * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>

                <Separator className="my-4" />

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Competitive Landscape</Label>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Lowest</p>
                      <p className="font-semibold">£{recommendation.marketIntelligence.competitiveLandscape.lowestPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Average</p>
                      <p className="font-semibold">£{recommendation.marketIntelligence.competitiveLandscape.averagePrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Highest</p>
                      <p className="font-semibold">£{recommendation.marketIntelligence.competitiveLandscape.highestPrice.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-5 bg-muted/30">
                <Label className="text-sm font-semibold mb-3 block">Pricing Reasoning</Label>
                <ul className="space-y-2">
                  {recommendation.reasoning.map((reason, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" weight="fill" />
                      <span className="text-muted-foreground">{reason}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setRecommendation(null)
                    setIsAnalyzing(false)
                  }}
                  className="flex-1"
                >
                  Recalculate
                </Button>
                <Button 
                  onClick={handleAcceptPrice}
                  className="flex-1 gap-2"
                  size="lg"
                >
                  <CheckCircle className="w-5 h-5" weight="fill" />
                  Use This Price
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
