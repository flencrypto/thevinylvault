import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { 
  Sparkle, 
  CheckCircle, 
  Trophy, 
  TrendUp, 
  Eye, 
  HandPointing,
  Heart,
  ChatCircle,
  CurrencyCircleDollar,
  CircleNotch,
  Play,
  Stop,
  Copy
} from '@phosphor-icons/react'
import { CollectionItem } from '@/lib/types'
import { 
  ABTest, 
  TITLE_STYLE_DESCRIPTIONS, 
} from '@/lib/ab-testing-types'
import {
  generateTitleVariants,
  createABTest,
  startABTest,
  completeABTest,
  updateVariantPerformance,
  calculateVariantPerformance,
  determineWinningVariant
} from '@/lib/ab-testing-service'
import { toast } from 'sonner'
import { useKV } from '@github/spark/hooks'

interface ABTestingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CollectionItem | null
  channel: 'ebay' | 'discogs' | 'shopify'
  onSelectTitle: (title: string) => void
}

export default function ABTestingDialog({
  open,
  onOpenChange,
  item,
  channel,
  onSelectTitle
}: ABTestingDialogProps) {
  const [abTests, setABTests] = useKV<ABTest[]>('vinyl-vault-ab-tests', [])
  const [currentTest, setCurrentTest] = useState<ABTest | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'generate' | 'results'>('generate')

  if (!item) return null

  const existingTest = abTests?.find(t => t.itemId === item.id && t.status !== 'completed')

  const handleGenerateVariants = async () => {
    setIsGenerating(true)
    
    try {
      const variants = await generateTitleVariants(item, channel, 5)
      
      const test = createABTest(item.id, variants)
      setCurrentTest(test)
      
      toast.success(`Generated ${variants.length} title variants`)
    } catch (error) {
      console.error('Failed to generate variants:', error)
      toast.error('Failed to generate title variants')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleStartTest = () => {
    if (!currentTest || !selectedVariantId) {
      toast.error('Please select a variant to start testing')
      return
    }

    const updatedTest = startABTest(currentTest, selectedVariantId)
    setABTests(tests => [...(tests || []).filter(t => t.id !== updatedTest.id), updatedTest])
    setCurrentTest(updatedTest)
    
    toast.success('A/B test started! Track performance in your marketplace.')
  }

  const handleCompleteTest = () => {
    if (!currentTest) return

    const completedTest = completeABTest(currentTest)
    setABTests(tests => (tests || []).map(t => t.id === completedTest.id ? completedTest : t))
    setCurrentTest(completedTest)
    setActiveTab('results')
    
    toast.success('Test completed! View results below.')
  }

  const handleUseTitle = (title: string) => {
    onSelectTitle(title)
    onOpenChange(false)
    toast.success('Title applied to listing')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleUpdateMetrics = (variantId: string) => {
    if (!currentTest) return

    const test = updateVariantPerformance(currentTest, variantId, {
      views: Math.floor(Math.random() * 100) + 50,
      clicks: Math.floor(Math.random() * 30) + 10,
      watchlists: Math.floor(Math.random() * 10),
      messages: Math.floor(Math.random() * 5),
      sales: Math.floor(Math.random() * 3),
    })

    setCurrentTest(test)
    setABTests(tests => (tests || []).map(t => t.id === test.id ? test : t))
  }

  const testToDisplay = currentTest || existingTest
  const testResults = testToDisplay ? determineWinningVariant(testToDisplay) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent" weight="fill" />
            A/B Title Testing
          </DialogTitle>
          <DialogDescription>
            Generate and test multiple title variations to maximize conversion rates
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'generate' | 'results')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Generate Variants</TabsTrigger>
            <TabsTrigger value="results">Test Results</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4 mt-4">
            {!testToDisplay ? (
              <div className="space-y-4">
                <Card className="p-6 bg-muted/30">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <Sparkle className="w-5 h-5 text-accent" weight="fill" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">AI-Powered Title Variants</h3>
                        <p className="text-sm text-muted-foreground">
                          Generate 5 different title styles optimized for different buyer personas and search strategies
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mt-4">
                      {Object.entries(TITLE_STYLE_DESCRIPTIONS).slice(0, 4).map(([style, desc]) => (
                        <div key={style} className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" weight="fill" />
                          <div>
                            <div className="font-medium capitalize">{style.replace('_', ' ')}</div>
                            <div className="text-muted-foreground">{desc.split('-')[1]}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                <div className="flex justify-center">
                  <Button
                    onClick={handleGenerateVariants}
                    disabled={isGenerating}
                    size="lg"
                    className="gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <CircleNotch className="w-5 h-5 animate-spin" />
                        Generating Variants...
                      </>
                    ) : (
                      <>
                        <Sparkle className="w-5 h-5" weight="fill" />
                        Generate Title Variants
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Test Status</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={testToDisplay.status === 'active' ? 'default' : 'secondary'}>
                        {testToDisplay.status}
                      </Badge>
                      {testToDisplay.status === 'active' && testToDisplay.activeVariantId && (
                        <span className="text-xs text-muted-foreground">
                          Testing variant {testToDisplay.variants.findIndex(v => v.id === testToDisplay.activeVariantId) + 1}
                        </span>
                      )}
                    </div>
                  </div>

                  {testToDisplay.status === 'draft' && (
                    <Button onClick={handleStartTest} disabled={!selectedVariantId} className="gap-2">
                      <Play className="w-4 h-4" weight="fill" />
                      Start Test
                    </Button>
                  )}

                  {testToDisplay.status === 'active' && (
                    <Button onClick={handleCompleteTest} variant="outline" className="gap-2">
                      <Stop className="w-4 h-4" weight="fill" />
                      Complete Test
                    </Button>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Title Variants ({testToDisplay.variants.length})</Label>
                  
                  {testToDisplay.variants.map((variant, index) => {
                    const performance = calculateVariantPerformance(variant)
                    const isSelected = selectedVariantId === variant.id
                    const isActive = testToDisplay.activeVariantId === variant.id

                    return (
                      <Card
                        key={variant.id}
                        className={`p-4 cursor-pointer transition-all ${
                          isSelected ? 'ring-2 ring-accent' : ''
                        } ${isActive ? 'bg-accent/5' : ''}`}
                        onClick={() => setSelectedVariantId(variant.id)}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">
                                  Variant {index + 1}
                                </Badge>
                                <Badge variant="secondary" className="text-xs capitalize">
                                  {variant.style.replace('_', ' ')}
                                </Badge>
                                {isActive && (
                                  <Badge className="text-xs">Active</Badge>
                                )}
                              </div>
                              <div className="font-mono text-sm break-words">{variant.text}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {variant.text.length} characters
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigator.clipboard.writeText(variant.text)
                                toast.success('Title copied')
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>

                          {testToDisplay.status === 'active' && variant.performance && (
                            <div className="grid grid-cols-5 gap-2 text-xs">
                              <div className="flex items-center gap-1">
                                <Eye className="w-3 h-3 text-muted-foreground" />
                                <span>{performance.views}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <HandPointing className="w-3 h-3 text-muted-foreground" />
                                <span>{performance.clicks}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Heart className="w-3 h-3 text-muted-foreground" />
                                <span>{performance.watchlists}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <ChatCircle className="w-3 h-3 text-muted-foreground" />
                                <span>{performance.messages}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <CurrencyCircleDollar className="w-3 h-3 text-muted-foreground" />
                                <span>{performance.sales}</span>
                              </div>
                            </div>
                          )}

                          {testToDisplay.status === 'draft' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUseTitle(variant.text)
                              }}
                            >
                              Use This Title
                            </Button>
                          )}
                        </div>
                      </Card>
                    )
                  })}
                </div>

                {testToDisplay.status === 'active' && (
                  <Card className="p-4 bg-muted/30">
                    <div className="text-sm space-y-2">
                      <div className="font-medium">Testing Instructions</div>
                      <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>Use the active variant in your marketplace listing</li>
                        <li>Track views, clicks, and sales in your marketplace analytics</li>
                        <li>Manually update metrics here or integrate with marketplace API</li>
                        <li>Complete the test when you have sufficient data</li>
                      </ol>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="results" className="space-y-4 mt-4">
            {testResults.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <div>No test results yet</div>
                <div className="text-sm">Generate variants and complete a test to see results</div>
              </div>
            ) : (
              <div className="space-y-4">
                {testResults.map((result, index) => {
                  const variant = testToDisplay?.variants.find(v => v.id === result.variantId)
                  if (!variant) return null

                  return (
                    <Card
                      key={result.variantId}
                      className={`p-4 ${result.isWinner ? 'ring-2 ring-accent' : ''}`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={result.isWinner ? 'default' : 'outline'}>
                                {index + 1}. {result.isWinner ? 'Winner' : `Rank ${index + 1}`}
                              </Badge>
                              <Badge variant="secondary" className="capitalize">
                                {variant.style.replace('_', ' ')}
                              </Badge>
                              {result.isWinner && result.improvement && (
                                <Badge className="gap-1">
                                  <TrendUp className="w-3 h-3" />
                                  +{result.improvement.toFixed(1)}% better
                                </Badge>
                              )}
                            </div>
                            <div className="font-mono text-sm">{result.variantText}</div>
                          </div>
                          {result.isWinner && (
                            <Trophy className="w-6 h-6 text-accent" weight="fill" />
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Click-Through Rate</div>
                            <div className="text-lg font-bold">
                              {result.performance.clickThroughRate.toFixed(1)}%
                            </div>
                            <Progress 
                              value={result.performance.clickThroughRate} 
                              className="h-1 mt-1"
                            />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Conversion Rate</div>
                            <div className="text-lg font-bold">
                              {result.performance.conversionRate.toFixed(1)}%
                            </div>
                            <Progress 
                              value={result.performance.conversionRate} 
                              className="h-1 mt-1"
                            />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Total Sales</div>
                            <div className="text-lg font-bold">{result.performance.sales}</div>
                          </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-4 gap-3 text-xs">
                          <div>
                            <div className="text-muted-foreground">Views</div>
                            <div className="font-medium">{result.performance.views}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Clicks</div>
                            <div className="font-medium">{result.performance.clicks}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Watchlists</div>
                            <div className="font-medium">{result.performance.watchlists}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Messages</div>
                            <div className="font-medium">{result.performance.messages}</div>
                          </div>
                        </div>

                        {result.isWinner && (
                          <Button
                            className="w-full gap-2"
                            onClick={() => handleUseTitle(result.variantText)}
                          >
                            <CheckCircle className="w-4 h-4" weight="fill" />
                            Use Winning Title
                          </Button>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
