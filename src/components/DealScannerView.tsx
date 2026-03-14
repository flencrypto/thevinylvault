import { useState, useMemo, useEffect, useCallback } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Binoculars, Play, Stop, Lightning, ArrowsClockwise, TrendUp, CurrencyGbp, Storefront } from '@phosphor-icons/react'
import { dealScannerService, type Deal, type ScanConfig } from '@/lib/deal-scanner-service'
import { dealFinderService } from '@/lib/deal-finder-service'
import { telegramService } from '@/lib/telegram-service'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

type SourceFilter = 'all' | 'eBay' | 'Discogs' | 'Web Scraper'

interface StoredDeal extends Deal {
  id: string
  foundAt: string
  recommendation: 'PASS' | 'MARGINAL' | 'GOOD DEAL' | 'QUICK FLIP'
}

const DEFAULT_SCAN_CONFIG: ScanConfig = {
  enabled: false,
  intervalMinutes: 5,
  minRoi: 30,
  minProfit: 3,
  maxPrice: 100,
  minCondition: 'VG+',
}

function getRecommendation(deal: Deal): StoredDeal['recommendation'] {
  const metrics = dealFinderService.calculateMetrics(
    deal.buyPrice,
    deal.marketValue,
    deal.condition,
  )
  return metrics.recommendation
}

function getRecommendationColor(rec: StoredDeal['recommendation']): string {
  switch (rec) {
    case 'PASS':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'MARGINAL':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'GOOD DEAL':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'QUICK FLIP':
      return 'bg-amber-400/20 text-amber-300 border-amber-400/30'
  }
}

export default function DealScannerView() {
  const [deals, setDeals] = useKV<StoredDeal[]>('vinyl-vault-deals', [])
  const [scanConfig, setScanConfig] = useKV<ScanConfig>('vinyl-vault-deal-scanner-config', DEFAULT_SCAN_CONFIG)

  const [isScanning, setIsScanning] = useState(false)
  const [autoScanActive, setAutoScanActive] = useState(dealScannerService.isRunning)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [minRoiFilter, setMinRoiFilter] = useState(0)
  const [alertCount, setAlertCount] = useState(0)

  const config = scanConfig || DEFAULT_SCAN_CONFIG

  const handleScanNow = useCallback(async () => {
    setIsScanning(true)
    toast('Scanning marketplaces for deals...', { icon: '🔍' })
    try {
      const notified = await dealScannerService.scanNow()
      setAlertCount((c) => c + notified)

      const lastRun = localStorage.getItem('deal_scanner_last_run')
      toast.success(`Scan complete! ${notified} alert${notified !== 1 ? 's' : ''} sent.`, {
        description: lastRun ? `Last scan: ${new Date(lastRun).toLocaleTimeString()}` : undefined,
      })
    } catch (err) {
      toast.error('Scan failed', { description: String(err) })
    } finally {
      setIsScanning(false)
    }
  }, [])

  const toggleAutoScan = useCallback(() => {
    if (autoScanActive) {
      dealScannerService.stop()
      setAutoScanActive(false)
      toast('Auto-scan stopped')
    } else {
      const updated = { ...config, enabled: true }
      setScanConfig(updated)
      localStorage.setItem('auto_buy_config', JSON.stringify(updated))
      dealScannerService.start(config.intervalMinutes)
      setAutoScanActive(true)
      toast.success('Auto-scan started', {
        description: `Scanning every ${config.intervalMinutes} minute${config.intervalMinutes !== 1 ? 's' : ''}`,
      })
    }
  }, [autoScanActive, config, setScanConfig])

  const handleIntervalChange = useCallback((value: string) => {
    const minutes = parseInt(value, 10)
    const updated = { ...config, intervalMinutes: minutes }
    setScanConfig(updated)
    localStorage.setItem('auto_buy_config', JSON.stringify(updated))
    if (autoScanActive) {
      dealScannerService.stop()
      dealScannerService.start(minutes)
    }
    toast(`Scan interval set to ${minutes} minute${minutes !== 1 ? 's' : ''}`)
  }, [config, setScanConfig, autoScanActive])

  const handleTestTelegram = useCallback(async () => {
    try {
      await telegramService.testConnection()
      toast.success('Test notification sent!')
    } catch (err) {
      toast.error('Telegram test failed', { description: String(err) })
    }
  }, [])

  // Sync auto-scan state on mount
  useEffect(() => {
    setAutoScanActive(dealScannerService.isRunning)
  }, [])

  const filteredDeals = useMemo(() => {
    if (!deals) return []
    let filtered = [...deals]

    if (sourceFilter !== 'all') {
      filtered = filtered.filter((d) => {
        const src = d.source.toLowerCase()
        switch (sourceFilter) {
          case 'eBay':
            return src.includes('ebay')
          case 'Discogs':
            return src.includes('discogs')
          case 'Web Scraper':
            return src.includes('scraper')
          default:
            return true
        }
      })
    }

    if (minRoiFilter > 0) {
      filtered = filtered.filter((d) => d.roi >= minRoiFilter)
    }

    return filtered.sort((a, b) => b.roi - a.roi)
  }, [deals, sourceFilter, minRoiFilter])

  const stats = useMemo(() => {
    const all = deals || []
    const totalDeals = all.length
    const avgRoi = totalDeals > 0
      ? (all.reduce((sum, d) => sum + d.roi, 0) / totalDeals).toFixed(1)
      : '0'
    const bestDeal = totalDeals > 0
      ? all.reduce((best, d) => (d.roi > best.roi ? d : best), all[0])
      : null
    return { totalDeals, avgRoi, bestDeal }
  }, [deals])

  return (
    <div className="p-3 sm:p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Binoculars className="w-6 h-6 sm:w-7 sm:h-7 text-accent" weight="fill" />
            Deal Scanner
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Scan marketplaces for undervalued vinyl — find deals before anyone else
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Storefront size={14} />
              Total Deals
            </div>
            <div className="text-lg sm:text-xl font-bold text-white">{stats.totalDeals}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <ArrowsClockwise size={14} className={autoScanActive ? 'animate-spin' : ''} />
              Active Scans
            </div>
            <div className="text-lg sm:text-xl font-bold text-white">
              {autoScanActive ? '1' : '0'}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <TrendUp size={14} />
              Avg ROI
            </div>
            <div className="text-lg sm:text-xl font-bold text-white">{stats.avgRoi}%</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Lightning size={14} />
              Best Deal
            </div>
            <div className="text-lg sm:text-xl font-bold text-white truncate">
              {stats.bestDeal ? `${stats.bestDeal.roi}% ROI` : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm text-slate-300">Scan Controls</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleScanNow}
              disabled={isScanning}
              className="gap-1.5 text-xs"
            >
              <ArrowsClockwise size={14} className={isScanning ? 'animate-spin' : ''} />
              {isScanning ? 'Scanning...' : 'Scan Now'}
            </Button>
            <Button
              variant={autoScanActive ? 'destructive' : 'outline'}
              size="sm"
              onClick={toggleAutoScan}
              className="gap-1.5 border-slate-700 text-xs"
            >
              {autoScanActive ? <Stop size={14} weight="fill" /> : <Play size={14} weight="fill" />}
              {autoScanActive ? 'Stop Auto-Scan' : 'Start Auto-Scan'}
            </Button>
            <Select
              value={String(config.intervalMinutes)}
              onValueChange={handleIntervalChange}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs border-slate-700">
                <SelectValue placeholder="Interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Every 1 min</SelectItem>
                <SelectItem value="5">Every 5 min</SelectItem>
                <SelectItem value="15">Every 15 min</SelectItem>
                <SelectItem value="30">Every 30 min</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Source Filter</label>
              <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
                <SelectTrigger className="h-8 text-xs border-slate-700">
                  <Storefront size={14} className="mr-1 flex-shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="eBay">eBay</SelectItem>
                  <SelectItem value="Discogs">Discogs</SelectItem>
                  <SelectItem value="Web Scraper">Web Scraper</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                Minimum ROI: {minRoiFilter}%
              </label>
              <Slider
                value={[minRoiFilter]}
                onValueChange={([v]) => setMinRoiFilter(v)}
                min={0}
                max={200}
                step={5}
                className="mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Telegram Alert Status */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${telegramService.isConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-slate-400">
              Telegram {telegramService.isConfigured ? 'Connected' : 'Not Configured'}
            </span>
            {alertCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                {alertCount} alert{alertCount !== 1 ? 's' : ''} sent
              </Badge>
            )}
          </div>
          {telegramService.isConfigured && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestTelegram}
              className="gap-1.5 text-xs border-slate-700"
            >
              <Lightning size={14} />
              Test Notification
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Deal Cards */}
      {filteredDeals.length === 0 && (deals || []).length > 0 && (
        <Card className="p-12 bg-slate-900/50 border-slate-800">
          <div className="text-center space-y-3">
            <Binoculars className="w-12 h-12 mx-auto text-muted-foreground" weight="light" />
            <div>
              <h3 className="font-semibold text-lg text-white">No matching deals</h3>
              <p className="text-sm text-slate-400 mt-1">
                Try adjusting your source filter or lowering the minimum ROI
              </p>
            </div>
          </div>
        </Card>
      )}

      {(deals || []).length === 0 && (
        <Card className="p-12 bg-slate-900/50 border-slate-800">
          <div className="text-center space-y-3">
            <Binoculars className="w-16 h-16 mx-auto text-muted-foreground" weight="light" />
            <div>
              <h3 className="font-semibold text-lg text-white">No deals found yet</h3>
              <p className="text-sm text-slate-400 mt-1">
                Hit "Scan Now" or enable auto-scan to discover undervalued vinyl across marketplaces
              </p>
            </div>
          </div>
        </Card>
      )}

      <AnimatePresence mode="popLayout">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredDeals.map((deal) => {
            const rec = deal.recommendation || getRecommendation(deal)
            const recColor = getRecommendationColor(rec)

            return (
              <motion.div
                key={deal.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm text-white truncate">{deal.artist}</h4>
                        <p className="text-xs text-slate-400 truncate">{deal.title}</p>
                      </div>
                      <Badge className={`text-[10px] px-1.5 shrink-0 border ${recColor}`}>
                        {rec}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Storefront size={12} />
                      <span>{deal.source}</span>
                      {deal.condition && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span>{deal.condition}</span>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Buy Price</span>
                        <span className="text-white font-medium">
                          <CurrencyGbp size={11} className="inline -mt-0.5" />
                          {deal.buyPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Est. Value</span>
                        <span className="text-white font-medium">
                          <CurrencyGbp size={11} className="inline -mt-0.5" />
                          {deal.marketValue.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">ROI</span>
                        <span className={`font-bold ${deal.roi >= 50 ? 'text-green-400' : deal.roi >= 30 ? 'text-yellow-400' : 'text-slate-300'}`}>
                          {deal.roi.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Net Profit</span>
                        <span className={`font-bold ${deal.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          <CurrencyGbp size={11} className="inline -mt-0.5" />
                          {deal.netProfit.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {deal.url && (
                      <a
                        href={deal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-xs text-accent hover:underline mt-1"
                      >
                        View Listing →
                      </a>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </AnimatePresence>
    </div>
  )
}
