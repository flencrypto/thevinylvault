import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { WatchlistItem, BargainCard as BargainCardType } from '@/lib/types'
import { WatchlistCard } from './WatchlistCard'
import { AddWatchlistDialog } from './AddWatchlistDialog'
import { BulkImportWatchlistDialog } from './BulkImportWatchlistDialog'
import { ScanScheduleDialog } from './ScanScheduleDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Eye, 
  Plus, 
  MagnifyingGlass, 
  Lightning,
  Warning,
  Info,
  FileArrowUp,
  CalendarCheck
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { scanMarketplaces, MarketplaceConfig, getDefaultMarketplaceConfig } from '@/lib/marketplace-scanner'
import { analyzeBargain } from '@/lib/bargain-detection-ai'
import { motion, AnimatePresence } from 'framer-motion'

interface ScanSettings {
  autoScanEnabled: boolean
  scanIntervalMinutes: number
  maxResultsPerItem: number
  minBargainScore: number
}

const defaultScanSettings: ScanSettings = {
  autoScanEnabled: false,
  scanIntervalMinutes: 60,
  maxResultsPerItem: 10,
  minBargainScore: 50
}

export default function WatchlistView() {
  const [watchlistItems = [], setWatchlistItems] = useKV<WatchlistItem[]>('watchlist-items', [])
  const [bargains = [], setBargains] = useKV<BargainCardType[]>('bargains', [])
  const [scanSettings = defaultScanSettings, setScanSettings] = useKV<ScanSettings>('watchlist-scan-settings', defaultScanSettings)
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStatus, setScanStatus] = useState('')
  const [lastScanTime, setLastScanTime] = useKV<string | null>('watchlist-last-scan', null)
  const [marketplaceConfig = getDefaultMarketplaceConfig(), setMarketplaceConfig] = useKV<MarketplaceConfig>('marketplace-config', getDefaultMarketplaceConfig())
  
  const [ebayAppId = ''] = useKV<string>('ebay-app-id', '')
  const [discogsToken = ''] = useKV<string>('discogs-user-token', '')

  useEffect(() => {
    const config: MarketplaceConfig = {
      enabledSources: [],
    }
    
    if (ebayAppId) {
      config.enabledSources.push('ebay')
      config.ebay = { appId: ebayAppId }
    }
    
    if (discogsToken) {
      config.enabledSources.push('discogs')
      config.discogs = { userToken: discogsToken }
    }
    
    setMarketplaceConfig(config)
  }, [ebayAppId, discogsToken, setMarketplaceConfig])

  useEffect(() => {
    if (!scanSettings.autoScanEnabled) return
    if (watchlistItems.length === 0) return
    if (marketplaceConfig.enabledSources.length === 0) return
    
    const intervalMs = scanSettings.scanIntervalMinutes * 60 * 1000
    const timerId = setInterval(() => {
      performScan()
    }, intervalMs)
    
    return () => clearInterval(timerId)
  }, [scanSettings.autoScanEnabled, scanSettings.scanIntervalMinutes, watchlistItems.length, marketplaceConfig.enabledSources.length])

  const performScan = async () => {
    if (isScanning) return
    if (watchlistItems.length === 0) return
    
    setIsScanning(true)
    setScanProgress(0)
    setScanStatus('Initializing scan...')
    
    try {
      const totalItems = watchlistItems.length
      let processedItems = 0
      let newBargainsFound = 0

      const discogsConfig = discogsToken ? { userToken: discogsToken } : undefined
      
      for (const watchItem of watchlistItems) {
        setScanStatus(`Scanning: ${watchItem.artistName || watchItem.searchQuery || 'Item'}...`)
        
        try {
          const listings = await scanMarketplaces(
            [watchItem],
            marketplaceConfig,
            {
              maxResults: scanSettings.maxResultsPerItem,
              maxPrice: watchItem.targetPrice,
            }
          )
          
          for (const listing of listings) {
            const analysis = await analyzeBargain({ 
              listing,
              discogsConfig,
              useDiscogsPricing: !!discogsToken,
            })
            
            if (analysis.bargainScore >= scanSettings.minBargainScore) {
              const existingBargain = bargains.find(b => b.listing.externalId === listing.externalId)
              
              if (!existingBargain) {
                const newBargain: BargainCardType = {
                  id: `bargain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  listing,
                  watchlistItemId: watchItem.id,
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
              }
            }
          }
          
          setWatchlistItems(current =>
            (current || []).map(item =>
              item.id === watchItem.id
                ? { ...item, lastScannedAt: new Date().toISOString() }
                : item
            )
          )
        } catch (error) {
          console.error(`Error scanning watchlist item ${watchItem.id}:`, error)
        }
        
        processedItems++
        setScanProgress((processedItems / totalItems) * 100)
      }
      
      setScanStatus('Scan complete!')
      setLastScanTime(new Date().toISOString())
      
      if (newBargainsFound > 0) {
        toast.success(`Found ${newBargainsFound} new bargain${newBargainsFound !== 1 ? 's' : ''}!`, {
          description: 'Check the Bargains tab to view them'
        })
      } else {
        toast.info('Scan complete', {
          description: 'No new bargains found this time'
        })
      }
      
    } catch (error) {
      console.error('Scan error:', error)
      toast.error('Scan failed', {
        description: error instanceof Error ? error.message : 'An error occurred'
      })
      setScanStatus('Scan failed')
    } finally {
      setIsScanning(false)
      setTimeout(() => {
        setScanProgress(0)
        setScanStatus('')
      }, 3000)
    }
  }

  const handleManualScan = async () => {
    if (watchlistItems.length === 0) {
      toast.error('No watchlist items', {
        description: 'Add items to your watchlist first'
      })
      return
    }
    
    if (marketplaceConfig.enabledSources.length === 0) {
      toast.error('No marketplaces configured', {
        description: 'Configure eBay or Discogs in Settings'
      })
      return
    }
    
    await performScan()
  }

  const handleDeleteWatchlistItem = (id: string) => {
    setWatchlistItems(current => (current || []).filter(item => item.id !== id))
    toast.success('Watchlist item removed')
  }

  const handleToggleNotifications = (id: string) => {
    setWatchlistItems(current =>
      (current || []).map(item =>
        item.id === id ? { ...item, notifyOnMatch: !item.notifyOnMatch } : item
      )
    )
  }

  const handleBulkImport = (items: WatchlistItem[]) => {
    setWatchlistItems(current => [...(current || []), ...items])
  }

  const getLastScanDisplay = () => {
    if (!lastScanTime) return 'Never'
    
    const now = new Date()
    const lastScan = new Date(lastScanTime)
    const diffMs = now.getTime() - lastScan.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  const marketplacesConfigured = marketplaceConfig.enabledSources.length > 0

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="w-7 h-7 text-accent" weight="fill" />
            Watchlist
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {watchlistItems.length} item{watchlistItems.length !== 1 ? 's' : ''} • Last scan: {getLastScanDisplay()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsScheduleDialogOpen(true)}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <CalendarCheck size={16} weight="bold" />
            Schedule
          </Button>
          <Button
            onClick={() => setIsBulkImportOpen(true)}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <FileArrowUp size={16} weight="bold" />
            Bulk Import
          </Button>
          <Button
            onClick={() => setIsDialogOpen(true)}
            size="sm"
            className="gap-2"
          >
            <Plus size={16} weight="bold" />
            Add
          </Button>
        </div>
      </div>

      {!marketplacesConfigured && (
        <Card className="p-4 bg-amber-500/10 border-amber-500/30">
          <div className="flex items-start gap-3">
            <Warning className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" weight="fill" />
            <div>
              <div className="font-semibold text-amber-500">Marketplaces not configured</div>
              <div className="text-sm text-muted-foreground mt-1">
                Configure eBay or Discogs API keys in Settings to enable auto-scanning
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Lightning className="w-5 h-5 text-accent" weight="fill" />
              Auto-Scan Settings
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Automatically scan marketplaces for watchlist matches
            </p>
          </div>
          <Switch
            checked={scanSettings.autoScanEnabled}
            onCheckedChange={(checked) =>
              setScanSettings({ ...scanSettings, autoScanEnabled: checked })
            }
            disabled={!marketplacesConfigured}
          />
        </div>

        {scanSettings.autoScanEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 pt-2 border-t border-border"
          >
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Scan Interval</Label>
                <Select
                  value={scanSettings.scanIntervalMinutes.toString()}
                  onValueChange={(v) =>
                    setScanSettings({ ...scanSettings, scanIntervalMinutes: parseInt(v) })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">Every 15 minutes</SelectItem>
                    <SelectItem value="30">Every 30 minutes</SelectItem>
                    <SelectItem value="60">Every hour</SelectItem>
                    <SelectItem value="180">Every 3 hours</SelectItem>
                    <SelectItem value="360">Every 6 hours</SelectItem>
                    <SelectItem value="720">Every 12 hours</SelectItem>
                    <SelectItem value="1440">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Min Bargain Score</Label>
                <Select
                  value={scanSettings.minBargainScore.toString()}
                  onValueChange={(v) =>
                    setScanSettings({ ...scanSettings, minBargainScore: parseInt(v) })
                  }
                >
                  <SelectTrigger className="h-9">
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

              <div className="space-y-2">
                <Label className="text-xs">Max Results Per Item</Label>
                <Select
                  value={scanSettings.maxResultsPerItem.toString()}
                  onValueChange={(v) =>
                    setScanSettings({ ...scanSettings, maxResultsPerItem: parseInt(v) })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 listings</SelectItem>
                    <SelectItem value="10">10 listings</SelectItem>
                    <SelectItem value="25">25 listings</SelectItem>
                    <SelectItem value="50">50 listings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="p-3 bg-accent/10 border-accent/30">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" weight="fill" />
                <p className="text-xs text-muted-foreground">
                  Auto-scan runs in the background every {scanSettings.scanIntervalMinutes} minutes and automatically adds bargains scoring {scanSettings.minBargainScore}+ to your Bargains tab.
                </p>
              </div>
            </Card>
          </motion.div>
        )}

        <Button
          onClick={handleManualScan}
          disabled={isScanning || !marketplacesConfigured || watchlistItems.length === 0}
          className="w-full gap-2"
          variant="outline"
        >
          <MagnifyingGlass size={16} weight="bold" />
          Scan Now
        </Button>

        {isScanning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{scanStatus}</span>
              <span className="font-mono text-xs">{Math.round(scanProgress)}%</span>
            </div>
            <Progress value={scanProgress} className="h-2" />
          </motion.div>
        )}
      </Card>

      {watchlistItems.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-3">
            <Eye className="w-16 h-16 mx-auto text-muted-foreground" weight="light" />
            <div>
              <h3 className="font-semibold text-lg">No watchlist items</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add artists, releases, or search terms to track marketplace opportunities
              </p>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2 mt-4">
              <Plus size={16} weight="bold" />
              Add First Item
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {watchlistItems.map((item) => (
              <WatchlistCard
                key={item.id}
                watchlistItem={item}
                onDelete={() => handleDeleteWatchlistItem(item.id)}
                onToggleNotifications={() => handleToggleNotifications(item.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AddWatchlistDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onAdd={(newItem) => {
          setWatchlistItems(current => [...(current || []), newItem])
          setIsDialogOpen(false)
          toast.success('Watchlist item added')
        }}
      />

      <BulkImportWatchlistDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        onImport={handleBulkImport}
      />

      <ScanScheduleDialog
        open={isScheduleDialogOpen}
        onOpenChange={setIsScheduleDialogOpen}
      />
    </div>
  )
}
