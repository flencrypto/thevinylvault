import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MarketplaceConfig, getDefaultMarketplaceConfig, validateMarketplaceConfig, isDiscogsConfigured, isEbayConfigured } from '@/lib/marketplace-scanner'
import { testEbayConnection } from '@/lib/marketplace-ebay'
import { testDiscogsConnection } from '@/lib/marketplace-discogs'
import { Info, CheckCircle, Warning, Lightning } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface MarketplaceSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Read Discogs credentials from global settings (localStorage). */
function getGlobalDiscogsCredentials(): { userToken: string; consumerKey: string; consumerSecret: string } {
  if (typeof localStorage === 'undefined') return { userToken: '', consumerKey: '', consumerSecret: '' }
  try {
    return {
      userToken: localStorage.getItem('discogs_personal_token') ?? '',
      consumerKey: localStorage.getItem('discogs_consumer_key') ?? '',
      consumerSecret: localStorage.getItem('discogs_consumer_secret') ?? '',
    }
  } catch {
    return { userToken: '', consumerKey: '', consumerSecret: '' }
  }
}

/** Read eBay credentials from global settings (localStorage). */
function getGlobalEbayCredentials(): { appId: string } {
  if (typeof localStorage === 'undefined') return { appId: '' }
  return {
    appId: localStorage.getItem('ebay_client_id') ?? localStorage.getItem('ebay_app_id') ?? '',
  }
}

export function MarketplaceSettingsDialog({ open, onOpenChange }: MarketplaceSettingsDialogProps) {
  const [config, setConfig] = useKV<MarketplaceConfig>('marketplace-config', getDefaultMarketplaceConfig())
  const [tempConfig, setTempConfig] = useState<MarketplaceConfig>(config || getDefaultMarketplaceConfig())
  const [testingEbay, setTestingEbay] = useState(false)
  const [testingDiscogs, setTestingDiscogs] = useState(false)

  // Track whether global API settings supply credentials for each marketplace.
  const [globalDiscogs, setGlobalDiscogs] = useState({ userToken: '', consumerKey: '', consumerSecret: '' })
  const [globalEbay, setGlobalEbay] = useState({ appId: '' })

  useEffect(() => {
    if (open) {
      setTempConfig(config || getDefaultMarketplaceConfig())

      const discogs = getGlobalDiscogsCredentials()
      const ebay = getGlobalEbayCredentials()
      setGlobalDiscogs(discogs)
      setGlobalEbay(ebay)
    }
  }, [open, config])

  const hasGlobalDiscogs =
    !!globalDiscogs.userToken || (!!globalDiscogs.consumerKey && !!globalDiscogs.consumerSecret)
  const hasGlobalEbay = !!globalEbay.appId

  const validation = validateMarketplaceConfig(tempConfig)

  const handleSave = () => {
    const validation = validateMarketplaceConfig(tempConfig)
    if (!validation.valid) {
      toast.error('Configuration Invalid', {
        description: validation.errors.join(', '),
      })
      return
    }

    setConfig(tempConfig)
    toast.success('Marketplace settings saved')
    onOpenChange(false)
  }

  const updateEbayConfig = (field: string, value: string) => {
    setTempConfig(current => ({
      ...current,
      ebay: {
        appId: current.ebay?.appId || '',
        marketplaceId: current.ebay?.marketplaceId,
        [field]: value,
      },
    }))
  }

  const updateDiscogsConfig = (field: string, value: string) => {
    setTempConfig(current => ({
      ...current,
      discogs: {
        userToken: current.discogs?.userToken,
        consumerKey: current.discogs?.consumerKey,
        consumerSecret: current.discogs?.consumerSecret,
        [field]: value,
      },
    }))
  }

  const toggleSource = (source: 'ebay' | 'discogs', enabled: boolean) => {
    setTempConfig(current => ({
      ...current,
      enabledSources: enabled
        ? [...current.enabledSources, source]
        : current.enabledSources.filter(s => s !== source),
    }))
  }

  const handleTestEbay = async () => {
    const appId = tempConfig.ebay?.appId || globalEbay.appId
    if (!appId) {
      toast.error('Please enter an eBay App ID first')
      return
    }

    setTestingEbay(true)
    const result = await testEbayConnection({ appId, marketplaceId: tempConfig.ebay?.marketplaceId })
    setTestingEbay(false)

    if (result.success) {
      toast.success('eBay Connection Successful', {
        description: result.message,
      })
    } else {
      toast.error('eBay Connection Failed', {
        description: result.message,
      })
    }
  }

  const handleTestDiscogs = async () => {
    const localDiscogs = tempConfig.discogs
    const hasLocalUserToken = !!localDiscogs?.userToken
    const hasLocalConsumerPair = !!localDiscogs?.consumerKey && !!localDiscogs?.consumerSecret
    const hasGlobalUserToken = !!globalDiscogs.userToken
    const hasGlobalConsumerPair = !!globalDiscogs.consumerKey && !!globalDiscogs.consumerSecret

    const discogsToTest = hasLocalUserToken
      ? { userToken: localDiscogs!.userToken }
      : hasLocalConsumerPair
        ? {
            consumerKey: localDiscogs!.consumerKey,
            consumerSecret: localDiscogs!.consumerSecret,
          }
        : hasGlobalUserToken
          ? { userToken: globalDiscogs.userToken }
          : hasGlobalConsumerPair
            ? {
                consumerKey: globalDiscogs.consumerKey,
                consumerSecret: globalDiscogs.consumerSecret,
              }
            : null

    if (!discogsToTest) {
      toast.error('Please enter Discogs credentials first')
      return
    }

    setTestingDiscogs(true)
    const result = await testDiscogsConnection(discogsToTest)
    setTestingDiscogs(false)

    if (result.success) {
      toast.success('Discogs Connection Successful', {
        description: result.message,
      })
    } else {
      toast.error('Discogs Connection Failed', {
        description: result.message,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Real Marketplace Integration</DialogTitle>
          <DialogDescription>
            Connect to live eBay and Discogs APIs for real-time bargain scanning across actual marketplace listings
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-accent/10 border-accent/30">
          <Lightning size={16} className="text-accent" />
          <AlertDescription className="text-sm">
            <span className="font-semibold text-accent-foreground">Live API Integration:</span> This app uses{' '}
            <span className="font-mono text-accent-foreground">real eBay Finding API</span> and{' '}
            <span className="font-mono text-accent-foreground">Discogs Marketplace API</span> to scan thousands of actual live listings.
            Add your API credentials to enable real-time bargain discovery.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="ebay" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ebay">eBay</TabsTrigger>
            <TabsTrigger value="discogs">Discogs</TabsTrigger>
          </TabsList>

          <TabsContent value="ebay" className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Checkbox
                id="ebay-enabled"
                checked={tempConfig.enabledSources.includes('ebay')}
                onCheckedChange={(checked) => toggleSource('ebay', checked as boolean)}
              />
              <Label htmlFor="ebay-enabled" className="font-semibold">
                Enable eBay marketplace scanning
              </Label>
            </div>

            {hasGlobalEbay && !tempConfig.ebay?.appId && (
              <Alert className="bg-green-500/10 border-green-500/30">
                <CheckCircle size={16} weight="fill" className="text-green-400" />
                <AlertDescription className="text-sm">
                  <span className="font-semibold text-green-400">eBay connected via API Settings.</span>{' '}
                  Your eBay credentials are already configured in Settings and will be used automatically. You can optionally override them below.
                </AlertDescription>
              </Alert>
            )}

            {tempConfig.enabledSources.includes('ebay') && (
              <>
                {!hasGlobalEbay && (
                  <Alert>
                    <Info size={16} />
                    <AlertDescription className="text-sm">
                      You need an eBay Developer account to get an App ID. Visit{' '}
                      <a
                        href="https://developer.ebay.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-accent"
                      >
                        developer.ebay.com
                      </a>{' '}
                      to create one.
                    </AlertDescription>
                  </Alert>
                )}

                <Card className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ebay-app-id">App ID (Client ID)</Label>
                    <Input
                      id="ebay-app-id"
                      type="password"
                      placeholder={hasGlobalEbay && !tempConfig.ebay?.appId ? 'Using credentials from Settings' : 'Enter your eBay App ID'}
                      value={tempConfig.ebay?.appId || ''}
                      onChange={(e) => updateEbayConfig('appId', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {hasGlobalEbay && !tempConfig.ebay?.appId
                        ? 'Leave blank to use the eBay credentials from your API Settings.'
                        : 'Your eBay application client ID for Finding API access'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ebay-marketplace">Marketplace</Label>
                    <Input
                      id="ebay-marketplace"
                      placeholder="EBAY-GB (default)"
                      value={tempConfig.ebay?.marketplaceId || ''}
                      onChange={(e) => updateEbayConfig('marketplaceId', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional: EBAY-US, EBAY-GB, EBAY-DE, etc. (defaults to EBAY-US)
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestEbay}
                    disabled={!isEbayConfigured(tempConfig.ebay) || testingEbay}
                    className="w-full gap-2"
                  >
                    <Lightning size={16} />
                    {testingEbay ? 'Testing Connection...' : 'Test eBay Connection'}
                  </Button>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="discogs" className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Checkbox
                id="discogs-enabled"
                checked={tempConfig.enabledSources.includes('discogs')}
                onCheckedChange={(checked) => toggleSource('discogs', checked as boolean)}
              />
              <Label htmlFor="discogs-enabled" className="font-semibold">
                Enable Discogs marketplace scanning
              </Label>
            </div>

            {hasGlobalDiscogs && !tempConfig.discogs?.userToken && !tempConfig.discogs?.consumerKey && (
              <Alert className="bg-green-500/10 border-green-500/30">
                <CheckCircle size={16} weight="fill" className="text-green-400" />
                <AlertDescription className="text-sm">
                  <span className="font-semibold text-green-400">Discogs connected via API Settings.</span>{' '}
                  Your Discogs credentials are already configured in Settings and will be used automatically. You can optionally override them below.
                </AlertDescription>
              </Alert>
            )}

            {tempConfig.enabledSources.includes('discogs') && (
              <>
                {!hasGlobalDiscogs && (
                  <Alert>
                    <Info size={16} />
                    <AlertDescription className="text-sm">
                      Get a Personal Access Token from{' '}
                      <a
                        href="https://www.discogs.com/settings/developers"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-accent"
                      >
                        Discogs Developer Settings
                      </a>
                      . For OAuth apps, use Consumer Key/Secret instead.
                    </AlertDescription>
                  </Alert>
                )}

                <Card className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="discogs-token">Personal Access Token (Recommended)</Label>
                    <Input
                      id="discogs-token"
                      type="password"
                      placeholder={hasGlobalDiscogs && !tempConfig.discogs?.userToken ? 'Using credentials from Settings' : 'Enter your Discogs personal token'}
                      value={tempConfig.discogs?.userToken || ''}
                      onChange={(e) => updateDiscogsConfig('userToken', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {hasGlobalDiscogs && !tempConfig.discogs?.userToken
                        ? 'Leave blank to use the Discogs credentials from your API Settings.'
                        : 'Easiest method - get this from your Discogs account settings'}
                    </p>
                  </div>

                  <div className="text-sm text-muted-foreground text-center">OR</div>

                  <div className="space-y-2">
                    <Label htmlFor="discogs-consumer-key">Consumer Key</Label>
                    <Input
                      id="discogs-consumer-key"
                      type="password"
                      placeholder="OAuth consumer key"
                      value={tempConfig.discogs?.consumerKey || ''}
                      onChange={(e) => updateDiscogsConfig('consumerKey', e.target.value)}
                      disabled={!!tempConfig.discogs?.userToken}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discogs-consumer-secret">Consumer Secret</Label>
                    <Input
                      id="discogs-consumer-secret"
                      type="password"
                      placeholder="OAuth consumer secret"
                      value={tempConfig.discogs?.consumerSecret || ''}
                      onChange={(e) => updateDiscogsConfig('consumerSecret', e.target.value)}
                      disabled={!!tempConfig.discogs?.userToken}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestDiscogs}
                    disabled={!isDiscogsConfigured(tempConfig.discogs) || testingDiscogs}
                    className="w-full gap-2"
                  >
                    <Lightning size={16} />
                    {testingDiscogs ? 'Testing Connection...' : 'Test Discogs Connection'}
                  </Button>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>

        {!validation.valid && (
          <Alert variant="destructive">
            <Warning size={16} />
            <AlertDescription>
              <div className="font-semibold mb-1">Configuration Issues:</div>
              <ul className="list-disc list-inside text-sm">
                {validation.errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {validation.valid && tempConfig.enabledSources.length > 0 && (
          <Alert>
            <CheckCircle size={16} weight="fill" className="text-green-400" />
            <AlertDescription>
              Configuration valid. You can scan {tempConfig.enabledSources.join(' and ')} for bargains.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2 justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!validation.valid}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
