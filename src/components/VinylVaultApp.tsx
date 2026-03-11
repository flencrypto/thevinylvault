import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Disc,
  Sparkle,
  Eye,
  Cube,
  Code,
  Upload,
  Gear,
  ArrowsLeftRight,
} from '@phosphor-icons/react'
import CollectionView from './CollectionView'
import BargainsView from './BargainsView'
import WatchlistView from './WatchlistView'
import NFTView from './NFTView'
import EbayDeletionChecklist from './ebay/EbayDeletionChecklist'
import NewListingView from './NewListingView'
import SettingsView from './SettingsView'
import MarketplaceComparisonView from './MarketplaceComparisonView'
import { scanSchedulerService } from '@/lib/scan-scheduler-service'

type TabValue = 'new-listing' | 'collection' | 'bargains' | 'watchlist' | 'comparison' | 'nfts' | 'ebay-dev' | 'settings'

export default function VinylVaultApp() {
  const [activeTab, setActiveTab] = useKV<TabValue>('vinyl-vault-active-tab', 'new-listing')

  useEffect(() => {
    scanSchedulerService.startScheduler()
    
    return () => {
      scanSchedulerService.stopScheduler()
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-20">
      <div className="max-w-[1800px] mx-auto">
        <header className="sticky top-0 z-40 backdrop-blur-lg bg-slate-950/90 border-b border-slate-800">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-accent to-accent/60 rounded-xl flex items-center justify-center">
                <Disc className="w-6 h-6 text-accent-foreground" weight="bold" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">VinylVault</h1>
                <p className="text-xs text-slate-400">Record Management</p>
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
            <TabsContent value="ebay-dev" className="m-0 mt-0">
              <EbayDeletionChecklist />
            </TabsContent>
            <TabsContent value="settings" className="m-0 mt-0">
              <SettingsView />
            </TabsContent>
          </Tabs>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 safe-area-inset-bottom">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
            <TabsList className="w-full h-16 grid grid-cols-8 bg-transparent border-0 p-0 gap-0">
              <TabsTrigger 
                value="new-listing" 
                className="flex-col gap-1 h-full rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-1"
              >
                <Upload className="w-5 h-5" weight="fill" />
                <span className="text-[10px] leading-tight">New</span>
              </TabsTrigger>
              <TabsTrigger 
                value="collection" 
                className="flex-col gap-1 h-full rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-1"
              >
                <Disc className="w-5 h-5" weight="fill" />
                <span className="text-[10px] leading-tight">Collection</span>
              </TabsTrigger>
              <TabsTrigger 
                value="bargains" 
                className="flex-col gap-1 h-full rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-1"
              >
                <Sparkle className="w-5 h-5" weight="fill" />
                <span className="text-[10px] leading-tight">Bargains</span>
              </TabsTrigger>
              <TabsTrigger 
                value="watchlist" 
                className="flex-col gap-1 h-full rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-1"
              >
                <Eye className="w-5 h-5" weight="fill" />
                <span className="text-[10px] leading-tight">Watch</span>
              </TabsTrigger>
              <TabsTrigger 
                value="comparison" 
                className="flex-col gap-1 h-full rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-1"
              >
                <ArrowsLeftRight className="w-5 h-5" weight="fill" />
                <span className="text-[10px] leading-tight">Compare</span>
              </TabsTrigger>
              <TabsTrigger 
                value="nfts" 
                className="flex-col gap-1 h-full rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-1"
              >
                <Cube className="w-5 h-5" weight="fill" />
                <span className="text-[10px] leading-tight">NFTs</span>
              </TabsTrigger>
              <TabsTrigger 
                value="ebay-dev" 
                className="flex-col gap-1 h-full rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-1"
              >
                <Code className="w-5 h-5" weight="fill" />
                <span className="text-[10px] leading-tight">eBay</span>
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="flex-col gap-1 h-full rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-1"
              >
                <Gear className="w-5 h-5" weight="fill" />
                <span className="text-[10px] leading-tight">Settings</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </nav>
      </div>
    </div>
  )
}
