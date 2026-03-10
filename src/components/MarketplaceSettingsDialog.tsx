import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MarketplaceConfig, getDefaultMarketplaceConfig, validateMarketplaceConfig } from '@/lib/marketplace-scanner'
import { Info, CheckCircle, Warning } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface MarketplaceSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MarketplaceSettingsDialog({ open, onOpenChange }: MarketplaceSettingsDialogProps) {
  const [config, setConfig] = useKV<MarketplaceConfig>('marketplace-config', getDefaultMarketplaceConfig())
  const [tempConfig, setTempConfig] = useState<MarketplaceConfig>(config || getDefaultMarketplaceConfig())

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Marketplace Integration Settings</DialogTitle>
          <DialogDescription>
            Configure API credentials to scan eBay and Discogs for bargains
          </DialogDescription>
        </DialogHeader>

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

            {tempConfig.enabledSources.includes('ebay') && (
              <>
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

                <Card className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ebay-app-id">App ID (Client ID)</Label>
                    <Input
                      id="ebay-app-id"
                      type="password"
                      placeholder="Enter your eBay App ID"
                      value={tempConfig.ebay?.appId || ''}
                      onChange={(e) => updateEbayConfig('appId', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Your eBay application client ID for Finding API access
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

            {tempConfig.enabledSources.includes('discogs') && (
              <>
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

                <Card className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="discogs-token">Personal Access Token (Recommended)</Label>
                    <Input
                      id="discogs-token"
                      type="password"
                      placeholder="Enter your Discogs personal token"
                      value={tempConfig.discogs?.userToken || ''}
                      onChange={(e) => updateDiscogsConfig('userToken', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Easiest method - get this from your Discogs account settings
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
