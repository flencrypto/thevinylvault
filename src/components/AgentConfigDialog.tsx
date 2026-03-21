import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Robot, Brain, Lightning, Target, Sparkle, Warning, Info, CheckCircle } from '@phosphor-icons/react'
import { useKV } from '@github/spark/hooks'
import { toast } from 'sonner'

export interface AgentConfig {
  enabled: boolean
  name: string
  aiPlatform: 'openai' | 'spark' | 'custom'
  customModelName?: string
  customApiEndpoint?: string
  customApiKey?: string
  
  bargainDetection: {
    enabled: boolean
    minScore: number
    signals: {
      titleMismatch: boolean
      lowPrice: boolean
      wrongCategory: boolean
      jobLot: boolean
      promoKeywords: boolean
      poorMetadata: boolean
    }
    customPromptAdditions?: string
  }
  
  priceAnalysis: {
    enabled: boolean
    useDiscogsData: boolean
    useEbayData: boolean
    priceVarianceThreshold: number
  }
  
  releaseMatching: {
    enabled: boolean
    minConfidence: number
    autoAcceptHighConfidence: boolean
    highConfidenceThreshold: number
  }
  
  advancedSettings: {
    temperature: number
    maxTokens: number
    retryAttempts: number
    timeoutSeconds: number
  }
}

const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: true,
  name: 'Bargain Hunter Agent',
  aiPlatform: 'spark',
  
  bargainDetection: {
    enabled: true,
    minScore: 50,
    signals: {
      titleMismatch: true,
      lowPrice: true,
      wrongCategory: true,
      jobLot: true,
      promoKeywords: true,
      poorMetadata: true,
    },
  },
  
  priceAnalysis: {
    enabled: true,
    useDiscogsData: true,
    useEbayData: true,
    priceVarianceThreshold: 25,
  },
  
  releaseMatching: {
    enabled: true,
    minConfidence: 70,
    autoAcceptHighConfidence: false,
    highConfidenceThreshold: 90,
  },
  
  advancedSettings: {
    temperature: 0.7,
    maxTokens: 1500,
    retryAttempts: 2,
    timeoutSeconds: 30,
  },
}

interface AgentConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AgentConfigDialog({ open, onOpenChange }: AgentConfigDialogProps) {
  const [config = DEFAULT_AGENT_CONFIG, setConfig] = useKV<AgentConfig>('agent-config', DEFAULT_AGENT_CONFIG)
  const [localConfig, setLocalConfig] = useState<AgentConfig>(config)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalConfig(config)
  }, [config, open])

  const handleSave = () => {
    setConfig(localConfig)
    toast.success('Agent configuration saved', {
      description: 'Your AI agent settings have been updated'
    })
    onOpenChange(false)
  }

  const handleReset = () => {
    setLocalConfig(DEFAULT_AGENT_CONFIG)
    toast.info('Reset to defaults', {
      description: 'Configuration has been reset. Click Save to apply changes.'
    })
  }

  const updateBargainSignal = (signal: keyof AgentConfig['bargainDetection']['signals'], value: boolean) => {
    setLocalConfig(prev => ({
      ...prev,
      bargainDetection: {
        ...prev.bargainDetection,
        signals: {
          ...prev.bargainDetection.signals,
          [signal]: value,
        },
      },
    }))
  }

  const platformDescriptions = {
    spark: 'Uses the built-in Spark AI platform (GPT-4o) - Recommended for most users',
    openai: 'Direct OpenAI API integration - Requires your own API key in Settings',
    custom: 'Connect to any custom AI API endpoint - For advanced users',
  }

  const getActiveSignalsCount = () => {
    return Object.values(localConfig.bargainDetection.signals).filter(Boolean).length
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Robot className="w-6 h-6 text-accent" weight="bold" />
            AI Agent Configuration
          </DialogTitle>
          <DialogDescription>
            Configure how your AI agent analyzes marketplace listings and detects bargains
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="bargain">Bargain Detection</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="w-5 h-5 text-accent" />
                  Agent Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable AI Agent</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically analyze listings with AI
                    </p>
                  </div>
                  <Switch
                    checked={localConfig.enabled}
                    onCheckedChange={(checked) =>
                      setLocalConfig(prev => ({ ...prev, enabled: checked }))
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="agent-name">Agent Name</Label>
                  <Input
                    id="agent-name"
                    value={localConfig.name}
                    onChange={(e) =>
                      setLocalConfig(prev => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g., Bargain Hunter Agent"
                  />
                  <p className="text-xs text-muted-foreground">
                    Give your agent a custom name for easy identification
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="ai-platform">AI Platform</Label>
                  <Select
                    value={localConfig.aiPlatform}
                    onValueChange={(value: 'openai' | 'spark' | 'custom') =>
                      setLocalConfig(prev => ({ ...prev, aiPlatform: value }))
                    }
                  >
                    <SelectTrigger id="ai-platform">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spark">
                        <div className="flex items-center gap-2">
                          <Sparkle className="w-4 h-4 text-accent" weight="fill" />
                          <span>Spark AI (GPT-4o)</span>
                          <Badge variant="secondary" className="ml-2">Recommended</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="openai">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4" />
                          <span>OpenAI Direct</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="custom">
                        <div className="flex items-center gap-2">
                          <Lightning className="w-4 h-4" />
                          <span>Custom API</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {platformDescriptions[localConfig.aiPlatform]}
                  </p>
                </div>

                {localConfig.aiPlatform === 'custom' && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4 space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="custom-endpoint">Custom API Endpoint</Label>
                        <Input
                          id="custom-endpoint"
                          value={localConfig.customApiEndpoint || ''}
                          onChange={(e) =>
                            setLocalConfig(prev => ({ ...prev, customApiEndpoint: e.target.value }))
                          }
                          placeholder="https://api.example.com/v1/chat/completions"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="custom-model">Model Name</Label>
                        <Input
                          id="custom-model"
                          value={localConfig.customModelName || ''}
                          onChange={(e) =>
                            setLocalConfig(prev => ({ ...prev, customModelName: e.target.value }))
                          }
                          placeholder="gpt-4, claude-3, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="custom-key">API Key</Label>
                        <Input
                          id="custom-key"
                          type="password"
                          value={localConfig.customApiKey || ''}
                          onChange={(e) =>
                            setLocalConfig(prev => ({ ...prev, customApiKey: e.target.value }))
                          }
                          placeholder="sk-..."
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bargain" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-5 h-5 text-accent" />
                  Bargain Detection Signals
                </CardTitle>
                <CardDescription>
                  Select which signals the agent should use to identify bargains
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Bargain Detection</Label>
                    <p className="text-xs text-muted-foreground">
                      Analyze listings for bargain potential
                    </p>
                  </div>
                  <Switch
                    checked={localConfig.bargainDetection.enabled}
                    onCheckedChange={(checked) =>
                      setLocalConfig(prev => ({
                        ...prev,
                        bargainDetection: { ...prev.bargainDetection, enabled: checked }
                      }))
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Minimum Bargain Score</Label>
                    <Badge variant="secondary">{localConfig.bargainDetection.minScore}</Badge>
                  </div>
                  <Slider
                    value={[localConfig.bargainDetection.minScore]}
                    onValueChange={([value]) =>
                      setLocalConfig(prev => ({
                        ...prev,
                        bargainDetection: { ...prev.bargainDetection, minScore: value }
                      }))
                    }
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Only show listings with a bargain score above this threshold
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Detection Signals</Label>
                    <Badge variant="outline">
                      {getActiveSignalsCount()} of 6 active
                    </Badge>
                  </div>

                  <div className="grid gap-3">
                    <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Title Mismatch</Label>
                        <p className="text-xs text-muted-foreground">
                          Detect misspellings, missing info, or poor metadata in titles
                        </p>
                      </div>
                      <Switch
                        checked={localConfig.bargainDetection.signals.titleMismatch}
                        onCheckedChange={(checked) => updateBargainSignal('titleMismatch', checked)}
                      />
                    </div>

                    <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Low Price Detection</Label>
                        <p className="text-xs text-muted-foreground">
                          Identify unusually low prices compared to market value
                        </p>
                      </div>
                      <Switch
                        checked={localConfig.bargainDetection.signals.lowPrice}
                        onCheckedChange={(checked) => updateBargainSignal('lowPrice', checked)}
                      />
                    </div>

                    <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Wrong Category</Label>
                        <p className="text-xs text-muted-foreground">
                          Find miscategorized or incorrectly listed items
                        </p>
                      </div>
                      <Switch
                        checked={localConfig.bargainDetection.signals.wrongCategory}
                        onCheckedChange={(checked) => updateBargainSignal('wrongCategory', checked)}
                      />
                    </div>

                    <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Job Lot Detection</Label>
                        <p className="text-xs text-muted-foreground">
                          Identify bundles/lots with potentially high-value items
                        </p>
                      </div>
                      <Switch
                        checked={localConfig.bargainDetection.signals.jobLot}
                        onCheckedChange={(checked) => updateBargainSignal('jobLot', checked)}
                      />
                    </div>

                    <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Promo/Rare Keywords</Label>
                        <p className="text-xs text-muted-foreground">
                          Detect promo, test pressing, white label, or rare variant mentions
                        </p>
                      </div>
                      <Switch
                        checked={localConfig.bargainDetection.signals.promoKeywords}
                        onCheckedChange={(checked) => updateBargainSignal('promoKeywords', checked)}
                      />
                    </div>

                    <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Poor Metadata</Label>
                        <p className="text-xs text-muted-foreground">
                          Find listings where seller doesn't know what they have
                        </p>
                      </div>
                      <Switch
                        checked={localConfig.bargainDetection.signals.poorMetadata}
                        onCheckedChange={(checked) => updateBargainSignal('poorMetadata', checked)}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="custom-prompt">Custom Prompt Additions (Optional)</Label>
                  <Textarea
                    id="custom-prompt"
                    value={localConfig.bargainDetection.customPromptAdditions || ''}
                    onChange={(e) =>
                      setLocalConfig(prev => ({
                        ...prev,
                        bargainDetection: { 
                          ...prev.bargainDetection, 
                          customPromptAdditions: e.target.value 
                        }
                      }))
                    }
                    placeholder="Add any additional instructions for the AI agent..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    These instructions will be appended to the AI's bargain detection prompt
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightning className="w-5 h-5 text-accent" />
                  Price Analysis Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Price Analysis</Label>
                    <p className="text-xs text-muted-foreground">
                      Compare listing prices with market data
                    </p>
                  </div>
                  <Switch
                    checked={localConfig.priceAnalysis.enabled}
                    onCheckedChange={(checked) =>
                      setLocalConfig(prev => ({
                        ...prev,
                        priceAnalysis: { ...prev.priceAnalysis, enabled: checked }
                      }))
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Data Sources</Label>
                  
                  <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Use Discogs Market Data</Label>
                      <p className="text-xs text-muted-foreground">
                        Compare against Discogs marketplace prices (requires API token)
                      </p>
                    </div>
                    <Switch
                      checked={localConfig.priceAnalysis.useDiscogsData}
                      onCheckedChange={(checked) =>
                        setLocalConfig(prev => ({
                          ...prev,
                          priceAnalysis: { ...prev.priceAnalysis, useDiscogsData: checked }
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-start justify-between p-3 rounded-lg border bg-card">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Use eBay Sold Data</Label>
                      <p className="text-xs text-muted-foreground">
                        Compare against recent eBay sold listings (requires API key)
                      </p>
                    </div>
                    <Switch
                      checked={localConfig.priceAnalysis.useEbayData}
                      onCheckedChange={(checked) =>
                        setLocalConfig(prev => ({
                          ...prev,
                          priceAnalysis: { ...prev.priceAnalysis, useEbayData: checked }
                        }))
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Price Variance Threshold</Label>
                    <Badge variant="secondary">{localConfig.priceAnalysis.priceVarianceThreshold}%</Badge>
                  </div>
                  <Slider
                    value={[localConfig.priceAnalysis.priceVarianceThreshold]}
                    onValueChange={([value]) =>
                      setLocalConfig(prev => ({
                        ...prev,
                        priceAnalysis: { ...prev.priceAnalysis, priceVarianceThreshold: value }
                      }))
                    }
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Flag listings priced this much below median market value
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Release Matching</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically match listings to known releases
                    </p>
                  </div>
                  <Switch
                    checked={localConfig.releaseMatching.enabled}
                    onCheckedChange={(checked) =>
                      setLocalConfig(prev => ({
                        ...prev,
                        releaseMatching: { ...prev.releaseMatching, enabled: checked }
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Minimum Match Confidence</Label>
                    <Badge variant="secondary">{localConfig.releaseMatching.minConfidence}%</Badge>
                  </div>
                  <Slider
                    value={[localConfig.releaseMatching.minConfidence]}
                    onValueChange={([value]) =>
                      setLocalConfig(prev => ({
                        ...prev,
                        releaseMatching: { ...prev.releaseMatching, minConfidence: value }
                      }))
                    }
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Only accept release matches with confidence above this level
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Warning className="w-5 h-5 text-amber-500" />
                  Advanced Settings
                </CardTitle>
                <CardDescription>
                  Fine-tune AI model parameters. Only change these if you know what you're doing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="temperature">Temperature</Label>
                    <Badge variant="secondary">{localConfig.advancedSettings.temperature.toFixed(1)}</Badge>
                  </div>
                  <Slider
                    id="temperature"
                    value={[localConfig.advancedSettings.temperature * 100]}
                    onValueChange={([value]) =>
                      setLocalConfig(prev => ({
                        ...prev,
                        advancedSettings: { ...prev.advancedSettings, temperature: value / 100 }
                      }))
                    }
                    min={0}
                    max={200}
                    step={10}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Controls randomness. Lower = more focused, Higher = more creative (0.0 - 2.0)
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="max-tokens">Max Tokens</Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    value={localConfig.advancedSettings.maxTokens}
                    onChange={(e) =>
                      setLocalConfig(prev => ({
                        ...prev,
                        advancedSettings: { ...prev.advancedSettings, maxTokens: parseInt(e.target.value) || 1500 }
                      }))
                    }
                    min={100}
                    max={4000}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum length of AI responses (100 - 4000)
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="retry-attempts">Retry Attempts</Label>
                  <Input
                    id="retry-attempts"
                    type="number"
                    value={localConfig.advancedSettings.retryAttempts}
                    onChange={(e) =>
                      setLocalConfig(prev => ({
                        ...prev,
                        advancedSettings: { ...prev.advancedSettings, retryAttempts: parseInt(e.target.value) || 2 }
                      }))
                    }
                    min={0}
                    max={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of times to retry failed API calls (0 - 5)
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={localConfig.advancedSettings.timeoutSeconds}
                    onChange={(e) =>
                      setLocalConfig(prev => ({
                        ...prev,
                        advancedSettings: { ...prev.advancedSettings, timeoutSeconds: parseInt(e.target.value) || 30 }
                      }))
                    }
                    min={5}
                    max={120}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum time to wait for AI responses (5 - 120 seconds)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-accent/10 border-accent/30">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" weight="fill" />
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-accent">Configuration Tips</p>
                    <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                      <li>Use Spark AI platform for the best experience with zero configuration</li>
                      <li>Enable all bargain signals for comprehensive detection</li>
                      <li>Lower temperature (0.3-0.5) for more consistent results</li>
                      <li>Higher variance threshold (30-40%) to catch more bargains</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
          >
            Reset to Defaults
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="gap-2"
          >
            <CheckCircle className="w-4 h-4" weight="bold" />
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
