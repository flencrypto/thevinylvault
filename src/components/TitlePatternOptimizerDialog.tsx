import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Trophy,
  TrendUp,
  Sparkle,
  ChartBar,
  ListChecks,
  Target,
  ArrowRight,
  CheckCircle,
  Info,
} from '@phosphor-icons/react'
import { CollectionItem } from '@/lib/types'
import { ABTest } from '@/lib/ab-testing-types'
import {
  analyzeWinningPatterns,
  generateOptimizedTitleFromPatterns,
  getPatternRecommendation,
  TitlePattern,
  PatternAnalysis,
} from '@/lib/title-pattern-optimizer'
import { toast } from 'sonner'
import { useKV } from '@github/spark/hooks'

interface TitlePatternOptimizerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CollectionItem | null
  channel: 'ebay' | 'discogs' | 'shopify'
  onApplyTitle: (title: string) => void
}

export default function TitlePatternOptimizerDialog({
  open,
  onOpenChange,
  item,
  channel,
  onApplyTitle,
}: TitlePatternOptimizerDialogProps) {
  const [abTests] = useKV<ABTest[]>('vinyl-vault-ab-tests', [])
  const [autoOptimize, setAutoOptimize] = useKV<boolean>('vinyl-vault-auto-optimize-titles', false)
  const [analysis, setAnalysis] = useState<PatternAnalysis | null>(null)
  const [optimizedTitle, setOptimizedTitle] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (open && abTests && abTests.length > 0) {
      analyzePatterns()
    }
  }, [open, abTests])

  const analyzePatterns = async () => {
    setIsAnalyzing(true)
    try {
      const completedTests = (abTests || []).filter(test => test.status === 'completed')
      const patternAnalysis = await analyzeWinningPatterns(completedTests)
      setAnalysis(patternAnalysis)
    } catch (error) {
      console.error('Failed to analyze patterns:', error)
      toast.error('Failed to analyze title patterns')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const generateTitle = async () => {
    if (!item || !analysis) return

    setIsGenerating(true)
    try {
      const title = await generateOptimizedTitleFromPatterns(item, channel, analysis.topPatterns)
      setOptimizedTitle(title)
      toast.success('Optimized title generated!')
    } catch (error) {
      console.error('Failed to generate optimized title:', error)
      toast.error('Failed to generate optimized title')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApplyTitle = () => {
    if (optimizedTitle) {
      onApplyTitle(optimizedTitle)
      onOpenChange(false)
      toast.success('Title applied to listing')
    }
  }

  if (!item) return null

  const completedTestCount = (abTests || []).filter(t => t.status === 'completed').length
  const hasData = completedTestCount > 0

  const recommendation = analysis ? getPatternRecommendation(item, analysis.topPatterns) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy size={24} className="text-accent" weight="fill" />
            Winning Title Pattern Optimizer
          </DialogTitle>
          <DialogDescription>
            Learn from your successful listings to automatically optimize future titles
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
          <div className="space-y-6">
            {isAnalyzing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Analyzing patterns...</span>
                </div>
                <Progress value={66} />
              </div>
            )}

            {!hasData && !isAnalyzing && (
              <Card className="p-6 bg-muted/30 border-dashed">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                    <Info size={32} className="text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">No Data Yet</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Complete A/B tests to build your pattern library. The system will learn which
                      title styles and formats perform best for your listings.
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Start Running A/B Tests
                  </Button>
                </div>
              </Card>
            )}

            {hasData && analysis && !isAnalyzing && (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                        <ChartBar size={20} className="text-accent" weight="fill" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{completedTestCount}</div>
                        <div className="text-xs text-muted-foreground">Tests Completed</div>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                        <Trophy size={20} className="text-green-500" weight="fill" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{analysis.topPatterns.length}</div>
                        <div className="text-xs text-muted-foreground">Patterns Found</div>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                        <Target size={20} className="text-blue-500" weight="fill" />
                      </div>
                      <div>
                        <div className="text-sm font-medium capitalize">
                          {analysis.recommendedStyle.replace('_', ' ')}
                        </div>
                        <div className="text-xs text-muted-foreground">Best Style</div>
                      </div>
                    </div>
                  </Card>
                </div>

                <Card className="p-4 bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
                  <div className="flex items-start gap-3">
                    <Sparkle size={24} className="text-accent flex-shrink-0 mt-0.5" weight="fill" />
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="font-semibold mb-1">Auto-Optimize Future Listings</h3>
                        <p className="text-sm text-muted-foreground">
                          Automatically apply winning patterns when generating new listing titles
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          id="auto-optimize"
                          checked={autoOptimize}
                          onCheckedChange={setAutoOptimize}
                        />
                        <Label htmlFor="auto-optimize" className="text-sm font-normal cursor-pointer">
                          {autoOptimize ? 'Enabled' : 'Disabled'}
                        </Label>
                      </div>
                    </div>
                  </div>
                </Card>

                {analysis.keyInsights.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendUp size={20} className="text-accent" weight="bold" />
                      <h3 className="font-semibold">Key Insights</h3>
                    </div>
                    <div className="space-y-2">
                      {analysis.keyInsights.map((insight, idx) => (
                        <Card key={idx} className="p-3 bg-muted/30">
                          <div className="flex items-start gap-2">
                            <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" weight="fill" />
                            <p className="text-sm">{insight}</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.successfulElements.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ListChecks size={20} className="text-accent" weight="bold" />
                      <h3 className="font-semibold">Successful Elements</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analysis.successfulElements.map((element, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1.5">
                          <CheckCircle size={14} weight="fill" />
                          {element}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {recommendation && recommendation.recommendedPattern && (
                  <div className="space-y-3">
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-2">Recommended Pattern for This Record</h3>
                      <Card className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {recommendation.recommendedPattern.style.replace('_', ' ')}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Used {recommendation.recommendedPattern.usageCount}x
                            </span>
                          </div>
                          <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                            {recommendation.expectedPerformance}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Pattern Structure</div>
                          <div className="font-mono text-sm bg-muted/50 p-2 rounded">
                            {recommendation.recommendedPattern.pattern}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Conversion Rate</div>
                            <div className="font-semibold">
                              {recommendation.recommendedPattern.avgConversionRate.toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Click-Through Rate</div>
                            <div className="font-semibold">
                              {recommendation.recommendedPattern.avgClickThroughRate.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{recommendation.reason}</p>
                      </Card>
                    </div>

                    <div className="space-y-3">
                      <Button
                        onClick={generateTitle}
                        disabled={isGenerating}
                        className="w-full gap-2"
                        size="lg"
                      >
                        {isGenerating ? (
                          <>
                            <Sparkle size={20} className="animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkle size={20} weight="fill" />
                            Generate Optimized Title
                          </>
                        )}
                      </Button>

                      {optimizedTitle && (
                        <Card className="p-4 space-y-3 bg-accent/5 border-accent/20">
                          <div className="flex items-center gap-2">
                            <CheckCircle size={20} className="text-accent" weight="fill" />
                            <h4 className="font-semibold">Optimized Title</h4>
                          </div>
                          <div className="bg-background p-3 rounded-lg border">
                            <p className="text-sm font-medium">{optimizedTitle}</p>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{optimizedTitle.length} characters</span>
                            <span>{optimizedTitle.length <= 80 ? '✓ Within limits' : '⚠ Too long'}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={handleApplyTitle} className="flex-1 gap-2">
                              Apply to Listing
                              <ArrowRight size={16} />
                            </Button>
                            <Button variant="outline" onClick={generateTitle}>
                              Regenerate
                            </Button>
                          </div>
                        </Card>
                      )}
                    </div>
                  </div>
                )}

                {analysis.topPatterns.length > 1 && (
                  <div className="space-y-3">
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-3">All Winning Patterns</h3>
                      <div className="space-y-2">
                        {analysis.topPatterns.slice(0, 5).map((pattern, idx) => (
                          <Card key={pattern.id} className="p-3">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-bold text-accent">#{idx + 1}</span>
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="capitalize text-xs">
                                    {pattern.style.replace('_', ' ')}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {pattern.usageCount}x used
                                  </span>
                                </div>
                                <div className="font-mono text-xs bg-muted/50 p-2 rounded">
                                  {pattern.pattern}
                                </div>
                                <div className="flex gap-4 text-xs">
                                  <span className="text-muted-foreground">
                                    Conv: <span className="text-foreground font-medium">{pattern.avgConversionRate.toFixed(1)}%</span>
                                  </span>
                                  <span className="text-muted-foreground">
                                    CTR: <span className="text-foreground font-medium">{pattern.avgClickThroughRate.toFixed(1)}%</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
