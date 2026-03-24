import { useEffect, lazy, Suspense } from 'react'
import { useKV } from '@github/spark/hooks'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import {
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
  Disc,
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
import DesktopSidebar from './layout/DesktopSidebar'
import MobileHeader from './layout/MobileHeader'
import MobileBottomNav from './layout/MobileBottomNav'

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
      <TabsContent value="new-listing" className="m-0 p-0">
        <NewListingView />
      </TabsContent>
      <TabsContent value="collection" className="m-0 p-0">
        <CollectionView />
      </TabsContent>
      <TabsContent value="bargains" className="m-0 p-0">
        <BargainsView />
      </TabsContent>
      <TabsContent value="watchlist" className="m-0 p-0">
        <WatchlistView />
      </TabsContent>
      <TabsContent value="comparison" className="m-0 p-0">
        <MarketplaceComparisonView />
      </TabsContent>
      <TabsContent value="nfts" className="m-0 p-0">
        <NFTView />
      </TabsContent>
      <TabsContent value="deals" className="m-0 p-0">
        <DealScannerView />
      </TabsContent>
      <TabsContent value="ebay-dev" className="m-0 p-0">
        <EbayDeletionChecklist />
      </TabsContent>
      <TabsContent value="agents" className="m-0 p-0">
        <ValuationAgentWorkflow />
      </TabsContent>
      <TabsContent value="settings" className="m-0 p-0">
        <SettingsView />
      </TabsContent>
      <TabsContent value="setup" className="m-0 p-0">
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-slate-950" />}>
          <SetupView onGoToSettings={() => setActiveTab('settings')} />
        </Suspense>
      </TabsContent>
    </>
  )

  if (isDesktop) {
    // Desktop layout: fixed sidebar nav + full-height scrollable content
    return (
      <>
        <Toaster />
        <PWAUpdatePrompt />
        <div className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <DesktopSidebar
            navItems={navItems}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            envLabel={envLabel}
            modeLabel={modeLabel}
          />

          {/* Main content */}
          <main className="flex-1 min-w-0 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
              {tabContent}
            </Tabs>
          </main>
        </div>
      </>
    )
  }

  // Mobile / tablet layout: flex column with header, scrollable content, and bottom nav
  return (
    <>
      <Toaster />
      <PWAUpdatePrompt />
      <div className="flex flex-col h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
        <MobileHeader envLabel={envLabel} modeLabel={modeLabel} />

        <main className="flex-1 overflow-y-auto min-h-0">
          <Tabs value={activeTab} className="w-full">
            {tabContent}
          </Tabs>
        </main>

        <MobileBottomNav navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </>
  )
}
