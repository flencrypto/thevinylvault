import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Key, Check, Eye, EyeSlash, Info } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface APIKeys {
  openaiKey: string
  discorgsKey: string
  discorgsSecret: string
  ebayClientId: string
  ebayClientSecret: string
  ebayDevId: string
}

export default function SettingsView() {
  const [apiKeys, setApiKeys] = useKV<APIKeys>('vinyl-vault-api-keys', {
    openaiKey: '',
    discorgsKey: '',
    discorgsSecret: '',
    ebayClientId: '',
    ebayClientSecret: '',
    ebayDevId: '',
  })

  const [showKeys, setShowKeys] = useState({
    openaiKey: false,
    discorgsKey: false,
    discorgsSecret: false,
    ebayClientId: false,
    ebayClientSecret: false,
    ebayDevId: false,
  })

  const [notificationsEnabled, setNotificationsEnabled] = useKV<boolean>('vinyl-vault-notifications', true)
  const [autoSync, setAutoSync] = useKV<boolean>('vinyl-vault-auto-sync', true)

  const handleKeyChange = (key: keyof APIKeys, value: string) => {
    setApiKeys((current = {
      openaiKey: '',
      discorgsKey: '',
      discorgsSecret: '',
      ebayClientId: '',
      ebayClientSecret: '',
      ebayDevId: '',
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

  const handleSave = () => {
    toast.success('Settings saved successfully', {
      description: 'Your API keys and preferences have been updated',
    })
  }

  const clearAllKeys = () => {
    setApiKeys({
      openaiKey: '',
      discorgsKey: '',
      discorgsSecret: '',
      ebayClientId: '',
      ebayClientSecret: '',
      ebayDevId: '',
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
                <Label htmlFor="discogs-key" className="text-slate-200">Consumer Key</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="discogs-key"
                      type={showKeys.discorgsKey ? 'text' : 'password'}
                      value={apiKeys?.discorgsKey || ''}
                      onChange={(e) => handleKeyChange('discorgsKey', e.target.value)}
                      placeholder="Enter your Discogs consumer key"
                      className="bg-slate-950/50 border-slate-700 text-white pr-10"
                    />
                    <button
                      onClick={() => toggleShowKey('discorgsKey')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showKeys.discorgsKey ? (
                        <EyeSlash className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discogs-secret" className="text-slate-200">Consumer Secret</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="discogs-secret"
                      type={showKeys.discorgsSecret ? 'text' : 'password'}
                      value={apiKeys?.discorgsSecret || ''}
                      onChange={(e) => handleKeyChange('discorgsSecret', e.target.value)}
                      placeholder="Enter your Discogs consumer secret"
                      className="bg-slate-950/50 border-slate-700 text-white pr-10"
                    />
                    <button
                      onClick={() => toggleShowKey('discorgsSecret')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showKeys.discorgsSecret ? (
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
                Used for market data, pricing trends, and collection management
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
