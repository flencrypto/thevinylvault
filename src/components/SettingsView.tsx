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
import { Key, Check, Eye, EyeSlash, Info, Brain, Detective, Image, GraduationCap, Lightning, Database, CloudArrowUp, TestTube, Question, Robot, PaperPlaneTilt, BellRinging, Copy, DownloadSimple, UploadSimple, FileArrowUp, Warning } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { testDiscogsConnection } from '@/lib/marketplace-discogs'
import { uploadImageToImgBB } from '@/lib/imgbb-service'
import { DiscogsTestDialog } from '@/components/DiscogsTestDialog'
import { DiscogsCacheStats } from '@/components/DiscogsCacheStats'
import DiscogsSetupGuide from '@/components/DiscogsSetupGuide'

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
  pinataJwt: string
}

interface ConfidenceThresholds {
  imageClassification: number
  pressingIdentification: number
  conditionGrading: number
  bargainDetection: number
}

const VALID_API_KEY_NAMES: ReadonlySet<keyof APIKeys> = new Set([
  'openaiKey', 'discogsKey', 'discogsSecret', 'discogsUserToken',
  'ebayClientId', 'ebayClientSecret', 'ebayDevId',
  'imgbbKey', 'xaiApiKey', 'deepseekApiKey',
  'telegramBotToken', 'telegramChatId', 'pinataJwt',
])

const ENV_KEY_MAP: Record<string, keyof APIKeys> = {
  OPENAI_API_KEY: 'openaiKey',
  DISCOGS_USER_TOKEN: 'discogsUserToken',
  DISCOGS_CONSUMER_KEY: 'discogsKey',
  DISCOGS_CONSUMER_SECRET: 'discogsSecret',
  EBAY_CLIENT_ID: 'ebayClientId',
  EBAY_CLIENT_SECRET: 'ebayClientSecret',
  EBAY_DEV_ID: 'ebayDevId',
  IMGBB_API_KEY: 'imgbbKey',
  XAI_API_KEY: 'xaiApiKey',
  DEEPSEEK_API_KEY: 'deepseekApiKey',
  TELEGRAM_BOT_TOKEN: 'telegramBotToken',
  TELEGRAM_CHAT_ID: 'telegramChatId',
  PINATA_JWT: 'pinataJwt',
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
    pinataJwt: '',
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
    pinataJwt: false,
  })

  const [notificationsEnabled, setNotificationsEnabled] = useKV<boolean>('vinyl-vault-notifications', true)

  useEffect(() => {
    if (typeof window === 'undefined' || !apiKeys) {
      return
    }

    const syncKey = (localKey: string, value: string | undefined) => {
      if (value) {
        window.localStorage.setItem(localKey, value)
      } else {
        window.localStorage.removeItem(localKey)
      }
    }

    syncKey('openai_api_key', apiKeys.openaiKey)
    syncKey('discogs_consumer_key', apiKeys.discogsKey)
    syncKey('discogs_consumer_secret', apiKeys.discogsSecret)
    syncKey('discogs_personal_token', apiKeys.discogsUserToken)
    // ebay_app_id is the alias used by deal-scanner-service for ebayClientId
    syncKey('ebay_client_id', apiKeys.ebayClientId)
    syncKey('ebay_app_id', apiKeys.ebayClientId)
    syncKey('ebay_client_secret', apiKeys.ebayClientSecret)
    syncKey('ebay_dev_id', apiKeys.ebayDevId)
    syncKey('imgbb_api_key', apiKeys.imgbbKey)
    syncKey('xai_api_key', apiKeys.xaiApiKey)
    syncKey('deepseek_api_key', apiKeys.deepseekApiKey)
    syncKey('telegram_bot_token', apiKeys.telegramBotToken)
    syncKey('telegram_chat_id', apiKeys.telegramChatId)
    syncKey('pinata_jwt', apiKeys.pinataJwt)
  }, [
    apiKeys?.openaiKey,
    apiKeys?.discogsKey,
    apiKeys?.discogsSecret,
    apiKeys?.discogsUserToken,
    apiKeys?.ebayClientId,
    apiKeys?.ebayClientSecret,
    apiKeys?.ebayDevId,
    apiKeys?.imgbbKey,
    apiKeys?.xaiApiKey,
    apiKeys?.deepseekApiKey,
    apiKeys?.telegramBotToken,
    apiKeys?.telegramChatId,
    apiKeys?.pinataJwt,
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
  const [showExportWarning, setShowExportWarning] = useState(false)

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
      pinataJwt: '',
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

  const handleExportCSV = () => {
    if (!showExportWarning) {
      setShowExportWarning(true)
      return
    }
    setShowExportWarning(false)
    if (!apiKeys) return
    const rows: [string, string][] = [
      ['openaiKey', apiKeys.openaiKey ?? ''],
      ['discogsUserToken', apiKeys.discogsUserToken ?? ''],
      ['discogsKey', apiKeys.discogsKey ?? ''],
      ['discogsSecret', apiKeys.discogsSecret ?? ''],
      ['ebayClientId', apiKeys.ebayClientId ?? ''],
      ['ebayClientSecret', apiKeys.ebayClientSecret ?? ''],
      ['ebayDevId', apiKeys.ebayDevId ?? ''],
      ['imgbbKey', apiKeys.imgbbKey ?? ''],
      ['xaiApiKey', apiKeys.xaiApiKey ?? ''],
      ['deepseekApiKey', apiKeys.deepseekApiKey ?? ''],
      ['telegramBotToken', apiKeys.telegramBotToken ?? ''],
      ['telegramChatId', apiKeys.telegramChatId ?? ''],
      ['pinataJwt', apiKeys.pinataJwt ?? ''],
    ]
    const escapeCsvValue = (v: string) => {
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`
      }
      return v
    }
    const csv = ['key,value', ...rows.map(([k, v]) => `${k},${escapeCsvValue(v)}`)].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vinylaysis-api-keys.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('API keys exported as CSV')
  }

  const handleImportCSV = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result as string
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
        const updates: Partial<APIKeys> = {}
        let count = 0
        // Skip header row (key,value)
        for (const line of lines) {
          if (line.startsWith('key,')) continue
          const commaIdx = line.indexOf(',')
          if (commaIdx === -1) continue
          const key = line.slice(0, commaIdx).trim()
          // Handle CSV-quoted values (e.g., "value with, comma")
          let value = line.slice(commaIdx + 1).trim()
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1).replace(/""/g, '"')
          }
          if (!value) continue
          if (VALID_API_KEY_NAMES.has(key as keyof APIKeys)) {
            (updates as Record<string, string>)[key] = value
            count++
          }
        }
        if (count > 0 && apiKeys) {
          setApiKeys({ ...apiKeys, ...updates })
          toast.success(`Imported ${count} API key${count !== 1 ? 's' : ''} from CSV`)
        } else {
          toast.error('No valid API keys found in CSV')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleImportEnv = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.env,.txt'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result as string
        const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
        const updates: Partial<APIKeys> = {}
        let count = 0
        for (const line of lines) {
          const eqIdx = line.indexOf('=')
          if (eqIdx === -1) continue
          const envKey = line.slice(0, eqIdx).trim()
          const value = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
          if (!value) continue
          const mappedKey = ENV_KEY_MAP[envKey]
          if (mappedKey) {
            (updates as Record<string, string>)[mappedKey] = value
            count++
          }
        }
        if (count > 0 && apiKeys) {
          setApiKeys({ ...apiKeys, ...updates })
          toast.success(`Imported ${count} API key${count !== 1 ? 's' : ''} from .env file`)
        } else {
          toast.error('No recognised API keys found in .env file')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleSave = () => {
    if (!apiKeys) {
      toast.error('Settings not loaded yet, please try again')
      return
    }
    setApiKeys(apiKeys)
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
      pinataJwt: '',
    })
    if (typeof window !== 'undefined') {
      const localKeys = [
        'openai_api_key',
        'discogs_consumer_key',
        'discogs_consumer_secret',
        'discogs_personal_token',
        'ebay_client_id',
        'ebay_app_id',
        'ebay_client_secret',
        'ebay_dev_id',
        'imgbb_api_key',
        'xai_api_key',
        'deepseek_api_key',
        'telegram_bot_token',
        'telegram_chat_id',
        'pinata_jwt',
      ]
      localKeys.forEach((k) => window.localStorage.removeItem(k))
    }
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

        {!apiKeys?.discogsUserToken ? (
          <DiscogsSetupGuide
            onGetStarted={() => {
              const tokenInput = document.getElementById('discogs-user-token')
              tokenInput?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              tokenInput?.focus()
            }}
            isConfigured={false}
          />
        ) : (
          <DiscogsSetupGuide
            onGetStarted={() => {}}
            isConfigured={true}
          />
        )}

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

            <div className={`space-y-4 rounded-lg p-4 transition-colors ${apiKeys?.discogsUserToken ? 'bg-green-500/5 border border-green-500/20' : 'bg-accent/5 border border-accent/20'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className={`w-5 h-5 ${apiKeys?.discogsUserToken ? 'text-green-500' : 'text-accent'}`} weight="fill" />
                  <h4 className="text-base font-bold text-white">Discogs API</h4>
                  {apiKeys?.discogsUserToken ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">
                      <Check className="w-3 h-3 mr-1" weight="bold" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
                      Setup Required
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
              
              {apiKeys?.discogsUserToken && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-sm text-green-400 flex items-center gap-2">
                    <Check className="w-4 h-4" weight="bold" />
                    Real database matching enabled! Your pressing identification results will include verified Discogs catalog data.
                  </p>
                </div>
              )}
              
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
                          <li>Name it "Vinylaysis" and click Generate</li>
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
                Required for uploading photos to eBay listings. Get your free API key at <a href="https://api.imgbb.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">https://api.imgbb.com</a>. Uploaded images are hosted externally and embedded in marketplace HTML descriptions.
              </p>
            </div>

            <Separator className="bg-slate-800" />

            <div className="space-y-2">
              <Label htmlFor="pinata-jwt" className="text-slate-200 flex items-center gap-2">
                Pinata JWT (NFT Metadata Storage)
                {apiKeys?.pinataJwt && (
                  <CloudArrowUp className="w-4 h-4 text-green-500" weight="fill" />
                )}
              </Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    id="pinata-jwt"
                    type={showKeys.pinataJwt ? 'text' : 'password'}
                    value={apiKeys?.pinataJwt || ''}
                    onChange={(e) => handleKeyChange('pinataJwt', e.target.value)}
                    placeholder="Enter your Pinata JWT token"
                    className="bg-slate-950/50 border-slate-700 text-white pr-10"
                  />
                  <button
                    onClick={() => toggleShowKey('pinataJwt')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showKeys.pinataJwt ? (
                      <EyeSlash className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Required for on-chain NFT minting. Metadata is pinned to IPFS via Pinata. Get your free JWT at <a href="https://app.pinata.cloud/developers/api-keys" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">app.pinata.cloud</a>.
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

            {/* eBay Marketplace Account Deletion / Closure Notifications */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <BellRinging className="w-4 h-4 text-amber-400" weight="fill" />
                <h4 className="text-sm font-semibold text-white">eBay Marketplace Account Deletion Notifications</h4>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  eBay requires all developers using their APIs to subscribe to (or opt out of) marketplace account
                  deletion/closure notifications. Failure to comply will result in termination of API access.
                </p>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-300">
                    Step 1 — Set the <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded text-[11px]">EBAY_VERIFICATION_TOKEN</code> environment variable in your Netlify dashboard
                  </p>
                  <p className="text-xs text-slate-400 pl-3">
                    Generate any secure random string (e.g. a UUID) and save it as{' '}
                    <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded text-[11px]">EBAY_VERIFICATION_TOKEN</code>{' '}
                    in <strong>Netlify → Site settings → Environment variables</strong>.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-300">
                    Step 2 — Register the endpoint URL &amp; verification token in the eBay Developer Portal
                  </p>
                  <p className="text-xs text-slate-400 pl-3">
                    Go to <a href="https://developer.ebay.com/my/developer/application/notifications" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">developer.ebay.com → Application → Notifications</a> and subscribe to the <strong>Marketplace Account Deletion</strong> topic using:
                  </p>
                  <div className="pl-3 space-y-2">
                    <div>
                      <p className="text-[11px] text-slate-500 mb-1">Endpoint URL</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-[11px] text-green-300 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 break-all">
                          {typeof window !== 'undefined' ? `${window.location.origin}/api/ebay/marketplace-deletion` : 'https://<your-domain>/api/ebay/marketplace-deletion'}
                        </code>
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/api/ebay/marketplace-deletion`
                            navigator.clipboard.writeText(url)
                              .then(() => toast.success('Endpoint URL copied'))
                              .catch(() => toast.error('Failed to copy'))
                          }}
                          className="shrink-0 p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                          title="Copy endpoint URL"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Verification token: the same value you set for{' '}
                      <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded">EBAY_VERIFICATION_TOKEN</code>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-300">
                    Step 3 — eBay will validate the endpoint automatically
                  </p>
                  <p className="text-xs text-slate-400 pl-3">
                    After saving, eBay sends a GET request with a <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded text-[11px]">challenge_code</code> to your endpoint.
                    The Netlify function at <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded text-[11px]">/api/ebay/marketplace-deletion</code> responds
                    with the correct SHA-256 hash, completing validation.
                    Once validated, your eBay App ID (Client ID) is activated.
                  </p>
                </div>
              </div>
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
              {/* Import / Export API Keys */}
              <div className="flex-1 flex flex-col gap-2 border border-slate-700 rounded-lg p-3">
                <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  <FileArrowUp className="w-3.5 h-3.5" />
                  Import / Export API Keys
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={showExportWarning ? 'destructive' : 'outline'}
                    onClick={handleExportCSV}
                    className={`gap-1.5 text-xs h-8 ${showExportWarning ? '' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}
                  >
                    <DownloadSimple className="w-3.5 h-3.5" />
                    {showExportWarning ? 'Confirm Export (keys are plaintext)' : 'Export CSV'}
                  </Button>
                  {showExportWarning && (
                    <button
                      onClick={() => setShowExportWarning(false)}
                      className="text-xs text-slate-400 hover:text-slate-200 px-2"
                    >
                      Cancel
                    </button>
                  )}
                  {!showExportWarning && (
                    <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleImportCSV}
                    className="gap-1.5 border-slate-600 text-slate-300 hover:bg-slate-800 text-xs h-8"
                  >
                    <UploadSimple className="w-3.5 h-3.5" />
                    Import CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleImportEnv}
                    className="gap-1.5 border-slate-600 text-slate-300 hover:bg-slate-800 text-xs h-8"
                  >
                    <FileArrowUp className="w-3.5 h-3.5" />
                    Import .env
                  </Button>
                    </>
                  )}
                </div>
                {showExportWarning && (
                  <p className="text-xs text-amber-400 flex items-start gap-1 mt-1">
                    <Warning className="w-3 h-3 mt-0.5 flex-shrink-0" weight="fill" />
                    The CSV file will contain your API keys in plain text. Store it securely and never share it.
                  </p>
                )}
              </div>
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
            <p>Vinylaysis v1.0.0</p>
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
