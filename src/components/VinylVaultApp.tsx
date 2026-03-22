import { useEffect, lazy, Suspense } from 'react'
import { useKV } from '@github/spark/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import {
  Disc,
  Sparkle,
  Eye,
  Cube,
  Code,
  Upload,
  Gear,
  ArrowsLeftRight,
  Binoculars,
  Wrench,
  Robot,
} from '@phosphor-icons/react'
import CollectionView from './CollectionView'
import BargainsView from './BargainsView'
import WatchlistView from './WatchlistView'
import NFTView from './NFTView'
import EbayDeletionChecklist from './ebay/EbayDeletionChecklist'
import NewListingView from './NewListingView'
import SettingsView from './SettingsView'
import MarketplaceComparisonView from './MarketplaceComparisonView'
import DealScannerView from './DealScannerView'
import PWAUpdatePrompt from './PWAUpdatePrompt'
import ValuationAgentWorkflow from './ValuationAgentWorkflow'
import { scanSchedulerService } from '@/lib/scan-scheduler-service'
import { useDeviceDetect } from '@/hooks/use-device-detect'

const SetupView = lazy(() => import('./SetupView'))

type TabValue = 'new-listing' | 'collection' | 'bargains' | 'watchlist' | 'comparison' | 'nfts' | 'deals' | 'ebay-dev' | 'agents' | 'settings' | 'setup'

export default function VinylVaultApp() {
  const [activeTab, setActiveTab] = useKV<TabValue>('vinyl-vault-active-tab', 'new-listing')
  const { isDesktop, isPWA, isIOS, isAndroid } = useDeviceDetect()

  useEffect(() => {
    scanSchedulerService.startScheduler()
    
    return () => {
      scanSchedulerService.stopScheduler()
    }
  }, [])

  const navItems = [
    { value: 'new-listing', icon: Upload, label: 'New' },
    { value: 'collection', icon: Disc, label: 'Collection' },
    { value: 'bargains', icon: Sparkle, label: 'Bargains' },
    { value: 'watchlist', icon: Eye, label: 'Watch' },
    { value: 'comparison', icon: ArrowsLeftRight, label: 'Compare' },
    { value: 'nfts', icon: Cube, label: 'NFTs' },
    { value: 'deals', icon: Binoculars, label: 'Deals' },
    { value: 'ebay-dev', icon: Code, label: 'eBay' },
    { value: 'agents', icon: Robot, label: 'Agents' },
    { value: 'settings', icon: Gear, label: 'Settings' },
    { value: 'setup', icon: Wrench, label: 'Setup' },
  ] as const

  const envLabel = isIOS ? 'iOS' : isAndroid ? 'Android' : 'Web'
  const modeLabel = isPWA ? 'App' : 'Browser'

  const tabContent = (
    <>
      <TabsContent value="new-listing" className="m-0 mt-0">
        <NewListingView />
      </TabsContent>
      <TabsContent value="collection" className="m-0 mt-0">
        <CollectionView />
      </TabsContent>
      <TabsContent value="bargains" className="m-0 mt-0">
        <BargainsView />
      </TabsContent>
      <TabsContent value="watchlist" className="m-0 mt-0">
        <WatchlistView />
      </TabsContent>
      <TabsContent value="comparison" className="m-0 mt-0">
        <MarketplaceComparisonView />
      </TabsContent>
      <TabsContent value="nfts" className="m-0 mt-0">
        <NFTView />
      </TabsContent>
      <TabsContent value="deals" className="m-0 mt-0">
        <DealScannerView />
      </TabsContent>
      <TabsContent value="ebay-dev" className="m-0 mt-0">
        <EbayDeletionChecklist />
      </TabsContent>
      <TabsContent value="agents" className="m-0 mt-0">
        <ValuationAgentWorkflow />
      </TabsContent>
      <TabsContent value="settings" className="m-0 mt-0">
        <SettingsView />
      </TabsContent>
      <TabsContent value="setup" className="m-0 mt-0">
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-slate-950" />}>
          <SetupView onGoToSettings={() => setActiveTab('settings')} />
        </Suspense>
      </TabsContent>
    </>
  )

  if (isDesktop) {
    // Desktop layout: fixed sidebar + full-height content area (single Tabs root)
    return (
      <>
        <Toaster />
        <PWAUpdatePrompt />
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabValue)}
          className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex-row gap-0"
        >
          {/* Sidebar */}
          <aside className="flex flex-col w-56 flex-shrink-0 bg-slate-950/95 border-r border-slate-800 overflow-y-auto">
            {/* Branding */}
            <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
              <div className="w-9 h-9 bg-gradient-to-br from-accent to-accent/60 rounded-xl flex items-center justify-center flex-shrink-0">
                <Disc className="w-5 h-5 text-accent-foreground" weight="bold" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-white leading-tight truncate">VinylVault</h1>
                <p className="text-[10px] text-slate-400 truncate leading-tight">
                  {envLabel} · {modeLabel}
                </p>
              </div>
            </div>

            {/* Nav items */}
            <TabsList className="flex flex-col w-full bg-transparent border-0 p-2 gap-0.5 h-auto">
              {navItems.map(({ value, icon: Icon, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-left data-[state=active]:bg-slate-800/60 data-[state=active]:text-accent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border-0 transition-colors"
                >
                  <Icon className="w-4 h-4 flex-shrink-0" weight="fill" />
                  <span className="text-sm font-medium">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto min-h-0">
            <div className="max-w-6xl w-full mx-auto p-6">
              {tabContent}
            </div>
          </main>
        </Tabs>
      </>
    )
  }

  // Mobile / tablet layout: sticky header + bottom nav
  return (
    <>
      <Toaster />
      <PWAUpdatePrompt />
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-20">
        <div className="max-w-[1800px] mx-auto">
          <header className="sticky top-0 z-40 backdrop-blur-lg bg-slate-950/90 border-b border-slate-800 safe-area-inset-top">
            <div className="px-3 sm:px-4 py-3 sm:py-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-accent to-accent/60 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Disc className="w-5 h-5 sm:w-6 sm:h-6 text-accent-foreground" weight="bold" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl font-bold text-white truncate">VinylVault</h1>
                  <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                    {envLabel} · {modeLabel}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="pb-4">
            <Tabs value={activeTab} className="w-full">
              {tabContent}
            </Tabs>
          </main>

          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 pb-safe-area-inset-bottom">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
              <TabsList className="w-full min-h-[64px] grid grid-cols-11 bg-transparent border-0 p-0 gap-0">
                {navItems.map(({ value, icon: Icon, label }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="flex-col gap-0.5 h-full min-h-[64px] rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-0.5 sm:px-1 touch-manipulation active:scale-95 transition-transform"
                  >
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" weight="fill" />
                    <span className="text-[9px] sm:text-[10px] leading-tight">{label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </nav>
        </div>
      </div>
    </>
  )
}
