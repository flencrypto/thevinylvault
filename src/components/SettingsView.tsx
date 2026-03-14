import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Key, Check, Eye, EyeSlash, Info, Brain, Detective, Image, GraduationCap, Lightning, Database, CloudArrowUp, TestTube, Question, Robot, PaperPlaneTilt } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { testDiscogsConnection } from '@/lib/marketplace-discogs'
import { uploadImageToImgBB } from '@/lib/imgbb-service'
import { DiscogsTestDialog } from '@/components/DiscogsTestDialog'
import { DiscogsCacheStats } from '@/components/DiscogsCacheStats'

interface APIKeys {
  openaiKey: string
  discogsKey: string
  discogsSecret: string
  discogsUserToken: string
  ebayClientId: string
  ebayClientSecret: string
  ebayDevId: string
  imgbbKey: string
  xaiApiKey: string
  deepseekApiKey: string
  telegramBotToken: string
  telegramChatId: string
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
    xaiApiKey: '',
    deepseekApiKey: '',
    telegramBotToken: '',
    telegramChatId: '',
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
    xaiApiKey: false,
    deepseekApiKey: false,
    telegramBotToken: false,
    telegramChatId: false,
  })

  const [notificationsEnabled, setNotificationsEnabled] = useKV<boolean>('vinyl-vault-notifications', true)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const { xaiApiKey, deepseekApiKey, telegramBotToken, telegramChatId } = apiKeys

    if (xaiApiKey) {
      window.localStorage.setItem('xai_api_key', xaiApiKey)
    } else {
      window.localStorage.removeItem('xai_api_key')
    }

    if (deepseekApiKey) {
      window.localStorage.setItem('deepseek_api_key', deepseekApiKey)
    } else {
      window.localStorage.removeItem('deepseek_api_key')
    }

    if (telegramBotToken) {
      window.localStorage.setItem('telegram_bot_token', telegramBotToken)
    } else {
      window.localStorage.removeItem('telegram_bot_token')
    }

    if (telegramChatId) {
      window.localStorage.setItem('telegram_chat_id', telegramChatId)
    } else {
      window.localStorage.removeItem('telegram_chat_id')
    }
  }, [
    apiKeys.xaiApiKey,
    apiKeys.deepseekApiKey,
    apiKeys.telegramBotToken,
    apiKeys.telegramChatId,
  ])
  const [autoSync, setAutoSync] = useKV<boolean>('vinyl-vault-auto-sync', true)
  
  const [confidenceThresholds, setConfidenceThresholds] = useKV<ConfidenceThresholds>('vinyl-vault-confidence-thresholds', {
    imageClassification: 75,
    pressingIdentification: 70,
    conditionGrading: 65,
    bargainDetection: 80,
  })

  const [testingDiscogs, setTestingDiscogs] = useState(false)
  const [testingImgBB, setTestingImgBB] = useState(false)
  const [showDiscogsTestDialog, setShowDiscogsTestDialog] = useState(false)

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
      xaiApiKey: '',
      deepseekApiKey: '',
      telegramBotToken: '',
      telegramChatId: '',
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

  const testDiscogsAPI = async () => {
    if (!apiKeys?.discogsUserToken) {
      toast.error('Please enter a Discogs user token first')
      return
    }

    setTestingDiscogs(true)
    try {
      const result = await testDiscogsConnection({
        userToken: apiKeys.discogsUserToken,
      })

      if (result.success) {
        toast.success('Discogs API connected!', {
          description: result.message,
        })
      } else {
        toast.error('Discogs connection failed', {
          description: result.message,
        })
      }
    } catch (error) {
      toast.error('Discogs connection test failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setTestingDiscogs(false)
    }
  }

  const testImgBBAPI = async () => {
    if (!apiKeys?.imgbbKey) {
      toast.error('Please enter an imgBB API key first')
      return
    }

    setTestingImgBB(true)
    try {
      const testImageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      
      await uploadImageToImgBB(testImageDataUrl, apiKeys.imgbbKey, 'test-connection')
      
      toast.success('imgBB API connected!', {
        description: 'Test image uploaded successfully',
      })
    } catch (error) {
      toast.error('imgBB connection failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setTestingImgBB(false)
    }
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
      xaiApiKey: '',
      deepseekApiKey: '',
      telegramBotToken: '',
      telegramChatId: '',
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white">Discogs API</h4>
                  {apiKeys?.discogsUserToken && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">
                      <Database className="w-3 h-3 mr-1" weight="fill" />
                      Connected
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <a 
                    href="/DISCOGS_API_SETUP.md" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:text-accent-foreground flex items-center gap-1 hover:underline"
                  >
                    <Info className="w-3 h-3" />
                    Setup Guide
                  </a>
                  <a 
                    href="/DISCOGS_TROUBLESHOOTING.md" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:text-accent-foreground flex items-center gap-1 hover:underline"
                  >
                    <Question className="w-3 h-3" />
                    Troubleshooting
                  </a>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="discogs-user-token" className="text-slate-200 flex items-center gap-2">
                  Personal Access Token (Required)
                  {apiKeys?.discogsUserToken && (
                    <Database className="w-4 h-4 text-green-500" weight="fill" />
                  )}
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="discogs-user-token"
                      type={showKeys.discogsUserToken ? 'text' : 'password'}
                      value={apiKeys?.discogsUserToken || ''}
                      onChange={(e) => handleKeyChange('discogsUserToken', e.target.value)}
                      placeholder="Paste your Discogs personal access token here"
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
                  <Button
                    onClick={testDiscogsAPI}
                    disabled={testingDiscogs || !apiKeys?.discogsUserToken}
                    variant="outline"
                    className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-2"
                  >
                    {testingDiscogs ? (
                      <>
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Lightning className="w-4 h-4" />
                        Test
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5 text-accent flex-shrink-0" />
                      <div className="text-xs text-slate-300 space-y-1">
                        <p className="font-semibold text-accent">How to get your token:</p>
                        <ol className="list-decimal list-inside space-y-1 text-slate-400">
                          <li>Visit <a href="https://www.discogs.com/settings/developers" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Discogs Developer Settings</a></li>
                          <li>Scroll to "Personal Access Tokens" section</li>
                          <li>Click "Generate new token"</li>
                          <li>Name it "VinylVault" and click Generate</li>
                          <li>Copy the token immediately (shown only once!)</li>
                          <li>Paste it above and click Test</li>
                        </ol>
                        <p className="text-amber-400 font-semibold mt-2">⚠️ Don't use OAuth - just the Personal Access Token above!</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setShowDiscogsTestDialog(true)}
                      disabled={!apiKeys?.discogsUserToken}
                      variant="ghost"
                      size="sm"
                      className="text-accent hover:text-accent-foreground hover:bg-accent/20 gap-2"
                    >
                      <TestTube className="w-4 h-4" />
                      Advanced Test & Database Search
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-slate-800" />

            <div className="space-y-2">
              <Label htmlFor="imgbb-key" className="text-slate-200 flex items-center gap-2">
                imgBB API Key
                {apiKeys?.imgbbKey && (
                  <CloudArrowUp className="w-4 h-4 text-green-500" weight="fill" />
                )}
              </Label>
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
                <Button
                  onClick={testImgBBAPI}
                  disabled={testingImgBB || !apiKeys?.imgbbKey}
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-2"
                >
                  {testingImgBB ? (
                    <>
                      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Lightning className="w-4 h-4" />
                      Test
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-500 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Required for uploading photos to eBay listings. Get your free API key at <a href="https://api.imgbb.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">api.imgbb.com</a>. Images are hosted externally and embedded in marketplace HTML descriptions.
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

            <Separator className="bg-slate-800" />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-white">Alternative AI Providers</h4>
              </div>

              <div className="space-y-2">
                <Label htmlFor="xai-api-key" className="text-slate-200 flex items-center gap-2">
                  xAI (Grok) API Key
                  {apiKeys?.xaiApiKey && (
                    <Robot className="w-4 h-4 text-green-500" weight="fill" />
                  )}
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="xai-api-key"
                      type={showKeys.xaiApiKey ? 'text' : 'password'}
                      value={apiKeys?.xaiApiKey || ''}
                      onChange={(e) => handleKeyChange('xaiApiKey', e.target.value)}
                      placeholder="Enter your xAI API key"
                      className="bg-slate-950/50 border-slate-700 text-white pr-10"
                    />
                    <button
                      onClick={() => toggleShowKey('xaiApiKey')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showKeys.xaiApiKey ? (
                        <EyeSlash className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Used for Grok vision-based record analysis and pressing identification. Get your key at <a href="https://console.x.ai" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">console.x.ai</a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deepseek-api-key" className="text-slate-200 flex items-center gap-2">
                  DeepSeek API Key
                  {apiKeys?.deepseekApiKey && (
                    <Robot className="w-4 h-4 text-green-500" weight="fill" />
                  )}
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="deepseek-api-key"
                      type={showKeys.deepseekApiKey ? 'text' : 'password'}
                      value={apiKeys?.deepseekApiKey || ''}
                      onChange={(e) => handleKeyChange('deepseekApiKey', e.target.value)}
                      placeholder="Enter your DeepSeek API key"
                      className="bg-slate-950/50 border-slate-700 text-white pr-10"
                    />
                    <button
                      onClick={() => toggleShowKey('deepseekApiKey')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showKeys.deepseekApiKey ? (
                        <EyeSlash className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Alternative AI provider for vision-based record analysis. Get your key at <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">platform.deepseek.com</a>
                </p>
              </div>
            </div>

            <Separator className="bg-slate-800" />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-white">Telegram Notifications</h4>
                {apiKeys?.telegramBotToken && apiKeys?.telegramChatId && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">
                    <PaperPlaneTilt className="w-3 h-3 mr-1" weight="fill" />
                    Connected
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telegram-bot-token" className="text-slate-200">Bot Token</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="telegram-bot-token"
                      type={showKeys.telegramBotToken ? 'text' : 'password'}
                      value={apiKeys?.telegramBotToken || ''}
                      onChange={(e) => handleKeyChange('telegramBotToken', e.target.value)}
                      placeholder="Enter your Telegram bot token"
                      className="bg-slate-950/50 border-slate-700 text-white pr-10"
                    />
                    <button
                      onClick={() => toggleShowKey('telegramBotToken')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showKeys.telegramBotToken ? (
                        <EyeSlash className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telegram-chat-id" className="text-slate-200">Chat ID</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="telegram-chat-id"
                      type={showKeys.telegramChatId ? 'text' : 'password'}
                      value={apiKeys?.telegramChatId || ''}
                      onChange={(e) => handleKeyChange('telegramChatId', e.target.value)}
                      placeholder="Enter your Telegram chat ID"
                      className="bg-slate-950/50 border-slate-700 text-white pr-10"
                    />
                    <button
                      onClick={() => toggleShowKey('telegramChatId')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showKeys.telegramChatId ? (
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
                Receive deal alerts and notifications via Telegram. Create a bot with <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">@BotFather</a> and get your Chat ID from <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">@userinfobot</a>
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
            <CardTitle className="text-white flex items-center gap-2">
              <Database className="w-5 h-5" />
              Discogs API Cache
            </CardTitle>
            <CardDescription className="text-slate-400">
              Offline caching reduces API calls and improves performance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DiscogsCacheStats />
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

      <DiscogsTestDialog
        open={showDiscogsTestDialog}
        onOpenChange={setShowDiscogsTestDialog}
        userToken={apiKeys?.discogsUserToken || ''}
      />
    </div>
  )
}
