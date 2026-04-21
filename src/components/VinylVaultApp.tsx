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
import PWAUpdatePrompt from './PWAUpdatePrompt'
import { scanSchedulerService } from '@/lib/scan-scheduler-service'
import { useDeviceDetect } from '@/hooks/use-device-detect'
import AppLayout from './layout/AppLayout'
import type { TabValue } from '@/lib/types'

// Code-split every top-level tab view. Only the active tab is mounted
// (Tabs renders one TabsContent at a time), so this reduces the initial
// JS bundle significantly without any behavior change.
const NewListingView = lazy(() => import('./NewListingView'))
const CollectionView = lazy(() => import('./CollectionView'))
const BargainsView = lazy(() => import('./BargainsView'))
const WatchlistView = lazy(() => import('./WatchlistView'))
const MarketplaceComparisonView = lazy(() => import('./MarketplaceComparisonView'))
const NFTView = lazy(() => import('./NFTView'))
const DealScannerView = lazy(() => import('./DealScannerView'))
const EbayDeletionChecklist = lazy(() => import('./ebay/EbayDeletionChecklist'))
const ValuationAgentWorkflow = lazy(() => import('./ValuationAgentWorkflow'))
const SettingsView = lazy(() => import('./SettingsView'))
const SetupView = lazy(() => import('./SetupView'))

const TabFallback = () => (
  <div
    role="status"
    aria-live="polite"
    aria-label="Loading view"
    className="flex items-center justify-center min-h-[60vh] bg-slate-950"
  />
)

export default function VinylasisApp() {
  const [activeTab, setActiveTab] = useKV<TabValue>('vinyl-vault-active-tab', 'new-listing')
  const { isPWA, isIOS, isAndroid } = useDeviceDetect()

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

  return (
    <>
      <Toaster />
      <PWAUpdatePrompt />
      <AppLayout
        navItems={navItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        envLabel={envLabel}
        modeLabel={modeLabel}
      >
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabValue)}
          className="w-full"
        >
          <Suspense fallback={<TabFallback />}>
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
              <SetupView onGoToSettings={() => setActiveTab('settings')} />
            </TabsContent>
          </Suspense>
        </Tabs>
      </AppLayout>
    </>
  )
}
