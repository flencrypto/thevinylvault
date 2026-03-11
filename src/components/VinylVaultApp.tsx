import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Disc,
  Sparkle,
  Eye,
  Cube,
  Code,
  Upload,
} from '@phosphor-icons/react'
import CollectionView from './CollectionView'
import BargainsView from './BargainsView'
import WatchlistView from './WatchlistView'
import NFTView from './NFTView'
import EbayDeletionChecklist from './ebay/EbayDeletionChecklist'
import NewListingView from './NewListingView'

type TabValue = 'new-listing' | 'collection' | 'bargains' | 'watchlist' | 'nfts' | 'ebay-dev'

export default function VinylVaultApp() {
  const [activeTab, setActiveTab] = useKV<TabValue>('vinyl-vault-active-tab', 'new-listing')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-[1800px] mx-auto">
        <header className="sticky top-0 z-50 backdrop-blur-lg bg-slate-950/80 border-b border-slate-800">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-accent to-accent/60 rounded-lg flex items-center justify-center">
                  <Disc className="w-6 h-6 text-accent-foreground" weight="bold" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">VinylVault</h1>
                  <p className="text-sm text-slate-400">Professional Record Management</p>
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
              <TabsList className="w-full grid grid-cols-6 bg-slate-900/50 border border-slate-800">
                <TabsTrigger value="new-listing" className="data-[state=active]:bg-slate-800">
                  <Upload className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">New Listing</span>
                </TabsTrigger>
                <TabsTrigger value="collection" className="data-[state=active]:bg-slate-800">
                  <Disc className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Collection</span>
                </TabsTrigger>
                <TabsTrigger value="bargains" className="data-[state=active]:bg-slate-800">
                  <Sparkle className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Bargains</span>
                </TabsTrigger>
                <TabsTrigger value="watchlist" className="data-[state=active]:bg-slate-800">
                  <Eye className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Watchlist</span>
                </TabsTrigger>
                <TabsTrigger value="nfts" className="data-[state=active]:bg-slate-800">
                  <Cube className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">NFTs</span>
                </TabsTrigger>
                <TabsTrigger value="ebay-dev" className="data-[state=active]:bg-slate-800">
                  <Code className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">eBay Dev</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </header>

        <main>
          <Tabs value={activeTab} className="w-full">
            <TabsContent value="new-listing" className="m-0">
              <NewListingView />
            </TabsContent>
            <TabsContent value="collection" className="m-0">
              <CollectionView />
            </TabsContent>
            <TabsContent value="bargains" className="m-0">
              <BargainsView />
            </TabsContent>
            <TabsContent value="watchlist" className="m-0">
              <WatchlistView />
            </TabsContent>
            <TabsContent value="nfts" className="m-0">
              <NFTView />
            </TabsContent>
            <TabsContent value="ebay-dev" className="m-0">
              <EbayDeletionChecklist />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
