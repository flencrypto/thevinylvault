import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import { MagnifyingGlass, Sparkle, Warning, Info, CircleNotch } from '@phosphor-icons/react'
import { useKV } from '@github/spark/hooks'
import { MarketplaceConfig, getDefaultMarketplaceConfig, searchAllMarketplaces } from '@/lib/marketplace-scanner'
import { analyzeBargain } from '@/lib/bargain-detection-ai'
import { BargainCard as BargainCardType } from '@/lib/types'
import { toast } from 'sonner'

interface MarketplaceScanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MarketplaceScanDialog({ open, onOpenChange }: MarketplaceScanDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [minScore, setMinScore] = useState<number>(50)
  const [maxResults, setMaxResults] = useState<number>(50)
  const [includeEbay, setIncludeEbay] = useState(true)
  const [includeDiscogs, setIncludeDiscogs] = useState(true)
  
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStatus, setScanStatus] = useState('')
  const [foundCount, setFoundCount] = useState(0)
  
  const [ebayAppId = ''] = useKV<string>('ebay-app-id', '')
  const [discogsToken = ''] = useKV<string>('discogs-user-token', '')
  const [bargains = [], setBargains] = useKV<BargainCardType[]>('bargains', [])
  const [marketplaceConfig = getDefaultMarketplaceConfig()] = useKV<MarketplaceConfig>('marketplace-config', getDefaultMarketplaceConfig())

  const canScan = searchQuery.trim().length > 0 && (
    (includeEbay && ebayAppId) || (includeDiscogs && discogsToken)
  )

  const handleScan = async () => {
    if (!canScan) return

    setIsScanning(true)
    setScanProgress(0)
    setScanStatus('Initializing scan...')
    setFoundCount(0)

    try {
      const enabledSources: Array<'ebay' | 'discogs'> = []
      const config: MarketplaceConfig = {
        enabledSources: [],
      }

      if (includeEbay && ebayAppId) {
        enabledSources.push('ebay')
        config.ebay = { appId: ebayAppId }
      }

      if (includeDiscogs && discogsToken) {
        enabledSources.push('discogs')
        config.discogs = { userToken: discogsToken }
      }

      config.enabledSources = enabledSources

      setScanStatus(`Searching ${enabledSources.join(' and ')}...`)
      setScanProgress(20)

      const listings = await searchAllMarketplaces(
        searchQuery,
        config,
        {
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
          maxResults,
        }
      )

      setScanProgress(60)
      setScanStatus(`Analyzing ${listings.length} listings...`)

      const discogsConfig = discogsToken ? { userToken: discogsToken } : undefined
      let newBargainsFound = 0

      for (let i = 0; i < listings.length; i++) {
        const listing = listings[i]
        
        try {
          const analysis = await analyzeBargain({ 
            listing,
            discogsConfig,
            useDiscogsPricing: !!discogsToken,
          })

          if (analysis.bargainScore >= minScore) {
            const existingBargain = bargains.find(b => b.listing.externalId === listing.externalId)

            if (!existingBargain) {
              const newBargain: BargainCardType = {
                id: `bargain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                listing,
                bargainScore: analysis.bargainScore,
                estimatedValue: analysis.estimatedValue,
                estimatedUpside: analysis.estimatedUpside,
                signals: analysis.signals,
                matchedRelease: analysis.matchedRelease,
                viewed: false,
                savedAt: new Date().toISOString(),
              }

              setBargains(current => [newBargain, ...(current || [])])
              newBargainsFound++
              setFoundCount(newBargainsFound)
            }
          }
        } catch (error) {
          console.error(`Failed to analyze listing ${listing.id}:`, error)
        }

        setScanProgress(60 + ((i + 1) / listings.length) * 40)
      }

      setScanStatus('Scan complete!')
      setScanProgress(100)

      if (newBargainsFound > 0) {
        toast.success(`Found ${newBargainsFound} bargain${newBargainsFound !== 1 ? 's' : ''}!`, {
          description: 'Check the Bargains tab to view them'
        })
      } else {
        toast.info('Scan complete', {
          description: `Analyzed ${listings.length} listings but found no bargains matching your criteria`
        })
      }

      setTimeout(() => {
        onOpenChange(false)
        setSearchQuery('')
        setMaxPrice('')
        setScanProgress(0)
        setScanStatus('')
        setFoundCount(0)
      }, 2000)

    } catch (error) {
      console.error('Scan error:', error)
      toast.error('Scan failed', {
        description: error instanceof Error ? error.message : 'An error occurred'
      })
      setScanStatus('Scan failed')
    } finally {
      setIsScanning(false)
    }
  }

  const marketplacesAvailable = (includeEbay && ebayAppId) || (includeDiscogs && discogsToken)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MagnifyingGlass className="w-6 h-6 text-accent" weight="fill" />
            Scan Marketplaces
          </DialogTitle>
          <DialogDescription>
            Search eBay and Discogs for bargains based on your criteria
          </DialogDescription>
        </DialogHeader>

        {!marketplacesAvailable && (
          <Card className="p-4 bg-amber-500/10 border-amber-500/30">
            <div className="flex items-start gap-3">
              <Warning className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" weight="fill" />
              <div>
                <div className="font-semibold text-amber-500">No marketplaces configured</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Configure eBay or Discogs API keys in Settings to enable scanning
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search-query">Search Query</Label>
            <Input
              id="search-query"
              placeholder="e.g. Pink Floyd Dark Side vinyl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isScanning}
            />
            <p className="text-xs text-muted-foreground">
              Artist name, album title, or keywords
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="max-price">Max Price (optional)</Label>
              <Input
                id="max-price"
                type="number"
                placeholder="100"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                disabled={isScanning}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-results">Max Results</Label>
              <Select
                value={maxResults.toString()}
                onValueChange={(v) => setMaxResults(parseInt(v))}
                disabled={isScanning}
              >
                <SelectTrigger id="max-results">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 listings</SelectItem>
                  <SelectItem value="50">50 listings</SelectItem>
                  <SelectItem value="100">100 listings</SelectItem>
                  <SelectItem value="200">200 listings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min-score">Minimum Bargain Score</Label>
            <Select
              value={minScore.toString()}
              onValueChange={(v) => setMinScore(parseInt(v))}
              disabled={isScanning}
            >
              <SelectTrigger id="min-score">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30+ (Show all)</SelectItem>
                <SelectItem value="50">50+ (Good deals)</SelectItem>
                <SelectItem value="60">60+ (Great deals)</SelectItem>
                <SelectItem value="70">70+ (Excellent deals)</SelectItem>
                <SelectItem value="80">80+ (Amazing deals only)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="p-3">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Marketplaces</Label>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="include-ebay" className="text-sm cursor-pointer">
                    eBay
                  </Label>
                  {!ebayAppId && (
                    <Badge variant="outline" className="text-xs">Not configured</Badge>
                  )}
                </div>
                <Switch
                  id="include-ebay"
                  checked={includeEbay}
                  onCheckedChange={setIncludeEbay}
                  disabled={!ebayAppId || isScanning}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="include-discogs" className="text-sm cursor-pointer">
                    Discogs
                  </Label>
                  {!discogsToken && (
                    <Badge variant="outline" className="text-xs">Not configured</Badge>
                  )}
                </div>
                <Switch
                  id="include-discogs"
                  checked={includeDiscogs}
                  onCheckedChange={setIncludeDiscogs}
                  disabled={!discogsToken || isScanning}
                />
              </div>
            </div>
          </Card>

          {isScanning && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{scanStatus}</span>
                <span className="font-mono text-xs">{Math.round(scanProgress)}%</span>
              </div>
              <Progress value={scanProgress} className="h-2" />
              {foundCount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Sparkle className="w-4 h-4 text-accent" weight="fill" />
                  <span className="text-accent font-semibold">{foundCount} bargain{foundCount !== 1 ? 's' : ''} found!</span>
                </div>
              )}
            </Card>
          )}

          <Card className="p-3 bg-accent/10 border-accent/30">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" weight="fill" />
              <p className="text-xs text-muted-foreground">
                Marketplace scanning uses AI to analyze listings and identify undervalued records. 
                Results will be saved to your Bargains tab with detailed scoring.
              </p>
            </div>
          </Card>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isScanning}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleScan}
            disabled={!canScan || isScanning}
            className="flex-1 gap-2"
          >
            {isScanning ? (
              <>
                <CircleNotch className="w-4 h-4 animate-spin" weight="bold" />
                Scanning...
              </>
            ) : (
              <>
                <MagnifyingGlass className="w-4 h-4" weight="bold" />
                Scan Now
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
