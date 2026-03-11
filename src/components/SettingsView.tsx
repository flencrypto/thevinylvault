import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Key, Check, Eye, EyeSlash, Info, Brain, Detective, Image, GraduationCap } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface APIKeys {
  openaiKey: string
  discogsKey: string
  discogsSecret: string
  discogsUserToken: string
  ebayClientId: string
  ebayClientSecret: string
  ebayDevId: string
  imgbbKey: string
}

interface ConfidenceThresholds {
  imageClassification: number
  pressingIdentification: number
  conditionGrading: number
  bargainDetection: number
}

export default function SettingsView() {
  const [apiKeys, setApiKeys] = useKV<APIKeys>('vinyl-vault-api-keys', {
    openaiKey: '',
    discogsKey: '',
    discogsSecret: '',
    discogsUserToken: '',
    ebayClientId: '',
    ebayClientSecret: '',
    ebayDevId: '',
    imgbbKey: '',
  })

  const [showKeys, setShowKeys] = useState({
    openaiKey: false,
    discogsKey: false,
    discogsSecret: false,
    discogsUserToken: false,
    ebayClientId: false,
    ebayClientSecret: false,
    ebayDevId: false,
    imgbbKey: false,
  })

  const [notificationsEnabled, setNotificationsEnabled] = useKV<boolean>('vinyl-vault-notifications', true)
  const [autoSync, setAutoSync] = useKV<boolean>('vinyl-vault-auto-sync', true)
  
  const [confidenceThresholds, setConfidenceThresholds] = useKV<ConfidenceThresholds>('vinyl-vault-confidence-thresholds', {
    imageClassification: 75,
    pressingIdentification: 70,
    conditionGrading: 65,
    bargainDetection: 80,
  })

  const handleKeyChange = (key: keyof APIKeys, value: string) => {
    setApiKeys((current = {
      openaiKey: '',
      discogsKey: '',
      discogsSecret: '',
      discogsUserToken: '',
      ebayClientId: '',
      ebayClientSecret: '',
      ebayDevId: '',
      imgbbKey: '',
    }) => ({
      ...current,
      [key]: value,
    }))
  }

  const toggleShowKey = (key: keyof typeof showKeys) => {
    setShowKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleThresholdChange = (key: keyof ConfidenceThresholds, value: number[]) => {
    setConfidenceThresholds((current = {
      imageClassification: 75,
      pressingIdentification: 70,
      conditionGrading: 65,
      bargainDetection: 80,
    }) => ({
      ...current,
      [key]: value[0],
    }))
  }

  const resetThresholds = () => {
    setConfidenceThresholds({
      imageClassification: 75,
      pressingIdentification: 70,
      conditionGrading: 65,
      bargainDetection: 80,
    })
    toast.success('Confidence thresholds reset to defaults')
  }

  const handleSave = () => {
    toast.success('Settings saved successfully', {
      description: 'Your API keys and preferences have been updated',
    })
  }

  const clearAllKeys = () => {
    setApiKeys({
      openaiKey: '',
      discogsKey: '',
      discogsSecret: '',
      discogsUserToken: '',
      ebayClientId: '',
      ebayClientSecret: '',
      ebayDevId: '',
      imgbbKey: '',
    })
    toast.success('All API keys cleared')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24 px-4">
      <div className="max-w-2xl mx-auto pt-6 space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-accent to-accent/60 rounded-lg flex items-center justify-center">
            <Key className="w-5 h-5 text-accent-foreground" weight="bold" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Settings</h2>
            <p className="text-sm text-slate-400">Manage your API keys and preferences</p>
          </div>
        </div>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Key className="w-5 h-5" />
              API Keys
            </CardTitle>
            <CardDescription className="text-slate-400">
              Configure your API keys for AI features and marketplace integrations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="openai-key" className="text-slate-200">OpenAI API Key</Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    id="openai-key"
                    type={showKeys.openaiKey ? 'text' : 'password'}
                    value={apiKeys?.openaiKey || ''}
                    onChange={(e) => handleKeyChange('openaiKey', e.target.value)}
                    placeholder="sk-..."
                    className="bg-slate-950/50 border-slate-700 text-white pr-10"
                  />
                  <button
                    onClick={() => toggleShowKey('openaiKey')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showKeys.openaiKey ? (
                      <EyeSlash className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Used for AI-powered grading, listing generation, and image analysis
              </p>
            </div>

            <Separator className="bg-slate-800" />

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white">Discogs API</h4>
              
              <div className="space-y-2">
                <Label htmlFor="discogs-user-token" className="text-slate-200">User Token (Recommended)</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="discogs-user-token"
                      type={showKeys.discogsUserToken ? 'text' : 'password'}
                      value={apiKeys?.discogsUserToken || ''}
                      onChange={(e) => handleKeyChange('discogsUserToken', e.target.value)}
                      placeholder="Enter your Discogs user token"
                      className="bg-slate-950/50 border-slate-700 text-white pr-10"
                    />
                    <button
                      onClick={() => toggleShowKey('discogsUserToken')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showKeys.discogsUserToken ? (
                        <EyeSlash className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Generate a personal access token from <a href="https://www.discogs.com/settings/developers" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Discogs Developer Settings</a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discogs-key" className="text-slate-200">Consumer Key (Optional)</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="discogs-key"
                      type={showKeys.discogsKey ? 'text' : 'password'}
                      value={apiKeys?.discogsKey || ''}
                      onChange={(e) => handleKeyChange('discogsKey', e.target.value)}
                      placeholder="Enter your Discogs consumer key"
                      className="bg-slate-950/50 border-slate-700 text-white pr-10"
                    />
                    <button
                      onClick={() => toggleShowKey('discogsKey')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showKeys.discogsKey ? (
                        <EyeSlash className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discogs-secret" className="text-slate-200">Consumer Secret (Optional)</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="discogs-secret"
                      type={showKeys.discogsSecret ? 'text' : 'password'}
                      value={apiKeys?.discogsSecret || ''}
                      onChange={(e) => handleKeyChange('discogsSecret', e.target.value)}
                      placeholder="Enter your Discogs consumer secret"
                      className="bg-slate-950/50 border-slate-700 text-white pr-10"
                    />
                    <button
                      onClick={() => toggleShowKey('discogsSecret')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showKeys.discogsSecret ? (
                        <EyeSlash className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-slate-500 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Used for pressing identification, market data, pricing trends, and bargain detection. User token is sufficient for most features.
              </p>
            </div>

            <Separator className="bg-slate-800" />

            <div className="space-y-2">
              <Label htmlFor="imgbb-key" className="text-slate-200">imgBB API Key</Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    id="imgbb-key"
                    type={showKeys.imgbbKey ? 'text' : 'password'}
                    value={apiKeys?.imgbbKey || ''}
                    onChange={(e) => handleKeyChange('imgbbKey', e.target.value)}
                    placeholder="Enter your imgBB API key"
                    className="bg-slate-950/50 border-slate-700 text-white pr-10"
                  />
                  <button
                    onClick={() => toggleShowKey('imgbbKey')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showKeys.imgbbKey ? (
                      <EyeSlash className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Required for uploading photos to eBay listings. Get your free API key at <a href="https://api.imgbb.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">api.imgbb.com</a>
              </p>
            </div>

            <Separator className="bg-slate-800" />

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-white">eBay API</h4>
              
              <div className="space-y-2">
                <Label htmlFor="ebay-client-id" className="text-slate-200">Client ID</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="ebay-client-id"
                      type={showKeys.ebayClientId ? 'text' : 'password'}
                      value={apiKeys?.ebayClientId || ''}
                      onChange={(e) => handleKeyChange('ebayClientId', e.target.value)}
                      placeholder="Enter your eBay client ID"
                      className="bg-slate-950/50 border-slate-700 text-white pr-10"
                    />
                    <button
                      onClick={() => toggleShowKey('ebayClientId')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showKeys.ebayClientId ? (
                        <EyeSlash className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ebay-client-secret" className="text-slate-200">Client Secret</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="ebay-client-secret"
                      type={showKeys.ebayClientSecret ? 'text' : 'password'}
                      value={apiKeys?.ebayClientSecret || ''}
                      onChange={(e) => handleKeyChange('ebayClientSecret', e.target.value)}
                      placeholder="Enter your eBay client secret"
                      className="bg-slate-950/50 border-slate-700 text-white pr-10"
                    />
                    <button
                      onClick={() => toggleShowKey('ebayClientSecret')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showKeys.ebayClientSecret ? (
                        <EyeSlash className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ebay-dev-id" className="text-slate-200">Developer ID</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="ebay-dev-id"
                      type={showKeys.ebayDevId ? 'text' : 'password'}
                      value={apiKeys?.ebayDevId || ''}
                      onChange={(e) => handleKeyChange('ebayDevId', e.target.value)}
                      placeholder="Enter your eBay developer ID"
                      className="bg-slate-950/50 border-slate-700 text-white pr-10"
                    />
                    <button
                      onClick={() => toggleShowKey('ebayDevId')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showKeys.ebayDevId ? (
                        <EyeSlash className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-slate-500 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Used for marketplace listings, pricing data, and sales analytics
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave} className="flex-1 bg-accent hover:bg-accent/90">
                <Check className="w-4 h-4 mr-2" />
                Save Settings
              </Button>
              <Button onClick={clearAllKeys} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                Clear All
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Brain className="w-5 h-5" />
              AI Confidence Thresholds
            </CardTitle>
            <CardDescription className="text-slate-400">
              Control when auto-detection is trusted and automatically applied
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-accent" />
                  <Label className="text-slate-200">Image Classification</Label>
                </div>
                <span className="text-sm font-mono text-accent">{confidenceThresholds?.imageClassification || 75}%</span>
              </div>
              <Slider
                value={[confidenceThresholds?.imageClassification || 75]}
                onValueChange={(value) => handleThresholdChange('imageClassification', value)}
                min={50}
                max={95}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                Auto-classify photo types (cover, label, runout) when AI confidence exceeds this threshold. Higher values = more accurate but fewer auto-classifications. Lower values = more convenience but potential misclassifications.
              </p>
            </div>

            <Separator className="bg-slate-800" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Detective className="w-4 h-4 text-accent" />
                  <Label className="text-slate-200">Pressing Identification</Label>
                </div>
                <span className="text-sm font-mono text-accent">{confidenceThresholds?.pressingIdentification || 70}%</span>
              </div>
              <Slider
                value={[confidenceThresholds?.pressingIdentification || 70]}
                onValueChange={(value) => handleThresholdChange('pressingIdentification', value)}
                min={50}
                max={95}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                Auto-match records to releases/pressings when identification confidence exceeds this threshold. Higher values require more certain matches, reducing false positives but potentially missing good matches. Lower values accept more uncertain matches for convenience.
              </p>
            </div>

            <Separator className="bg-slate-800" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-accent" />
                  <Label className="text-slate-200">Condition Grading</Label>
                </div>
                <span className="text-sm font-mono text-accent">{confidenceThresholds?.conditionGrading || 65}%</span>
              </div>
              <Slider
                value={[confidenceThresholds?.conditionGrading || 65]}
                onValueChange={(value) => handleThresholdChange('conditionGrading', value)}
                min={50}
                max={95}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                Auto-suggest media and sleeve grades when AI analysis confidence exceeds this threshold. Set higher for conservative grading (safer for sellers), lower to get suggestions more often (requires manual review).
              </p>
            </div>

            <Separator className="bg-slate-800" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Detective className="w-4 h-4 text-accent" />
                  <Label className="text-slate-200">Bargain Detection</Label>
                </div>
                <span className="text-sm font-mono text-accent">{confidenceThresholds?.bargainDetection || 80}%</span>
              </div>
              <Slider
                value={[confidenceThresholds?.bargainDetection || 80]}
                onValueChange={(value) => handleThresholdChange('bargainDetection', value)}
                min={50}
                max={95}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                Flag marketplace listings as bargains when AI detection confidence exceeds this threshold. Higher values = fewer but more reliable bargain alerts. Lower values = more alerts but may include false positives.
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={resetThresholds} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                Reset to Defaults
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Preferences</CardTitle>
            <CardDescription className="text-slate-400">
              Customize your app experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-slate-200">Price Trend Notifications</Label>
                <p className="text-xs text-slate-500">Get alerts when items gain or lose value</p>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
              />
            </div>

            <Separator className="bg-slate-800" />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-slate-200">Auto-Sync Market Data</Label>
                <p className="text-xs text-slate-500">Automatically update pricing and trends</p>
              </div>
              <Switch
                checked={autoSync}
                onCheckedChange={setAutoSync}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-sm">About</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 space-y-2">
            <p>VinylVault v1.0.0</p>
            <p>All API keys are stored securely on your device and never shared.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
