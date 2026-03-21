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

const SetupView = lazy(() => import('./SetupView'))

type TabValue = 'new-listing' | 'collection' | 'bargains' | 'watchlist' | 'comparison' | 'nfts' | 'deals' | 'ebay-dev' | 'agents' | 'settings' | 'setup'

export default function VinylVaultApp() {
  const [activeTab, setActiveTab] = useKV<TabValue>('vinyl-vault-active-tab', 'new-listing')

  useEffect(() => {
    scanSchedulerService.startScheduler()
    
    return () => {
      scanSchedulerService.stopScheduler()
    }
  }, [])

  return (
    <>
    <Toaster />
    <PWAUpdatePrompt />
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-20 md:pb-24">
      <div className="max-w-[1800px] mx-auto">
        <header className="sticky top-0 z-40 backdrop-blur-lg bg-slate-950/90 border-b border-slate-800 safe-area-inset-top">
          <div className="px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-accent to-accent/60 rounded-xl flex items-center justify-center flex-shrink-0">
                <Disc className="w-5 h-5 sm:w-6 sm:h-6 text-accent-foreground" weight="bold" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-bold text-white truncate">VinylVault</h1>
                <p className="text-[10px] sm:text-xs text-slate-400 truncate">Record Management</p>
              </div>
            </div>
          </div>
        </header>

        <main className="pb-4">
          <Tabs value={activeTab} className="w-full">
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
          </Tabs>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 pb-safe-area-inset-bottom">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
            <TabsList className="w-full min-h-[64px] md:h-20 grid grid-cols-11 bg-transparent border-0 p-0 gap-0">
              <TabsTrigger 
                value="new-listing" 
                className="flex-col gap-0.5 sm:gap-1 h-full min-h-[64px] md:min-h-[80px] rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-0.5 sm:px-1 touch-manipulation active:scale-95 transition-transform"
              >
                <Upload className="w-5 h-5 sm:w-6 sm:h-6" weight="fill" />
                <span className="text-[9px] sm:text-[10px] leading-tight">New</span>
              </TabsTrigger>
              <TabsTrigger 
                value="collection" 
                className="flex-col gap-0.5 sm:gap-1 h-full min-h-[64px] md:min-h-[80px] rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-0.5 sm:px-1 touch-manipulation active:scale-95 transition-transform"
              >
                <Disc className="w-5 h-5 sm:w-6 sm:h-6" weight="fill" />
                <span className="text-[9px] sm:text-[10px] leading-tight">Collection</span>
              </TabsTrigger>
              <TabsTrigger 
                value="bargains" 
                className="flex-col gap-0.5 sm:gap-1 h-full min-h-[64px] md:min-h-[80px] rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-0.5 sm:px-1 touch-manipulation active:scale-95 transition-transform"
              >
                <Sparkle className="w-5 h-5 sm:w-6 sm:h-6" weight="fill" />
                <span className="text-[9px] sm:text-[10px] leading-tight">Bargains</span>
              </TabsTrigger>
              <TabsTrigger 
                value="watchlist" 
                className="flex-col gap-0.5 sm:gap-1 h-full min-h-[64px] md:min-h-[80px] rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-0.5 sm:px-1 touch-manipulation active:scale-95 transition-transform"
              >
                <Eye className="w-5 h-5 sm:w-6 sm:h-6" weight="fill" />
                <span className="text-[9px] sm:text-[10px] leading-tight">Watch</span>
              </TabsTrigger>
              <TabsTrigger 
                value="comparison" 
                className="flex-col gap-0.5 sm:gap-1 h-full min-h-[64px] md:min-h-[80px] rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-0.5 sm:px-1 touch-manipulation active:scale-95 transition-transform"
              >
                <ArrowsLeftRight className="w-5 h-5 sm:w-6 sm:h-6" weight="fill" />
                <span className="text-[9px] sm:text-[10px] leading-tight">Compare</span>
              </TabsTrigger>
              <TabsTrigger 
                value="nfts" 
                className="flex-col gap-0.5 sm:gap-1 h-full min-h-[64px] md:min-h-[80px] rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-0.5 sm:px-1 touch-manipulation active:scale-95 transition-transform"
              >
                <Cube className="w-5 h-5 sm:w-6 sm:h-6" weight="fill" />
                <span className="text-[9px] sm:text-[10px] leading-tight">NFTs</span>
              </TabsTrigger>
              <TabsTrigger 
                value="deals" 
                className="flex-col gap-0.5 sm:gap-1 h-full min-h-[64px] md:min-h-[80px] rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-0.5 sm:px-1 touch-manipulation active:scale-95 transition-transform"
              >
                <Binoculars className="w-5 h-5 sm:w-6 sm:h-6" weight="fill" />
                <span className="text-[9px] sm:text-[10px] leading-tight">Deals</span>
              </TabsTrigger>
              <TabsTrigger 
                value="ebay-dev" 
                className="flex-col gap-0.5 sm:gap-1 h-full min-h-[64px] md:min-h-[80px] rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-0.5 sm:px-1 touch-manipulation active:scale-95 transition-transform"
              >
                <Code className="w-5 h-5 sm:w-6 sm:h-6" weight="fill" />
                <span className="text-[9px] sm:text-[10px] leading-tight">eBay</span>
              </TabsTrigger>
              <TabsTrigger 
                value="agents" 
                className="flex-col gap-0.5 sm:gap-1 h-full min-h-[64px] md:min-h-[80px] rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-0.5 sm:px-1 touch-manipulation active:scale-95 transition-transform"
              >
                <Robot className="w-5 h-5 sm:w-6 sm:h-6" weight="fill" />
                <span className="text-[9px] sm:text-[10px] leading-tight">Agents</span>
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="flex-col gap-0.5 sm:gap-1 h-full min-h-[64px] md:min-h-[80px] rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-0.5 sm:px-1 touch-manipulation active:scale-95 transition-transform"
              >
                <Gear className="w-5 h-5 sm:w-6 sm:h-6" weight="fill" />
                <span className="text-[9px] sm:text-[10px] leading-tight">Settings</span>
              </TabsTrigger>
              <TabsTrigger 
                value="setup" 
                className="flex-col gap-0.5 sm:gap-1 h-full min-h-[64px] md:min-h-[80px] rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-0.5 sm:px-1 touch-manipulation active:scale-95 transition-transform"
              >
                <Wrench className="w-5 h-5 sm:w-6 sm:h-6" weight="fill" />
                <span className="text-[9px] sm:text-[10px] leading-tight">Setup</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </nav>
      </div>
    </div>
    </>
  )
}
