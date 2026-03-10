import { useState, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { CollectionItem, CollectionStats, ListingDraft, BargainCard as BargainCardType, WatchlistItem } from '@/lib/types'
import { calculateCollectionValue, formatCurrency } from '@/lib/helpers'
import { StatCard } from '@/components/StatCard'
import { ItemCard } from '@/components/ItemCard'
import { AddItemDialog } from '@/components/AddItemDialog'
import { ListingGenerator } from '@/components/ListingGenerator'
import { ListingDraftCard } from '@/components/ListingDraftCard'
import { BargainCard } from '@/components/BargainCard'
import { WatchlistCard } from '@/components/WatchlistCard'
import { AddWatchlistDialog } from '@/components/AddWatchlistDialog'
import { MarketplaceSettingsDialog } from '@/components/MarketplaceSettingsDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { Plus, Record, TrendUp, Package, ChartLine, MagnifyingGlass, Storefront, Sparkle, Binoculars, Lightning, Gear } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { scanMarketplaces, MarketplaceConfig, getDefaultMarketplaceConfig, validateMarketplaceConfig } from '@/lib/marketplace-scanner'
import { analyzeBargainPotential } from '@/lib/bargain-detection-ai'

type MainView = 'collection' | 'listings' | 'watchlist' | 'bargains'

function App() {
  const [items, setItems] = useKV<CollectionItem[]>('collection-items', [])
  const [listingDrafts, setListingDrafts] = useKV<ListingDraft[]>('listing-drafts', [])
  const [watchlistItems, setWatchlistItems] = useKV<WatchlistItem[]>('watchlist-items', [])
  const [bargainCards, setBargainCards] = useKV<BargainCardType[]>('bargain-cards', [])
  const [marketplaceConfig] = useKV<MarketplaceConfig>('marketplace-config', getDefaultMarketplaceConfig())
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [listingGenOpen, setListingGenOpen] = useState(false)
  const [watchlistDialogOpen, setWatchlistDialogOpen] = useState(false)
  const [marketplaceSettingsOpen, setMarketplaceSettingsOpen] = useState(false)
  const [selectedItemForListing, setSelectedItemForListing] = useState<CollectionItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [mainView, setMainView] = useState<MainView>('collection')
  const [isScanning, setIsScanning] = useState(false)

  const safeItems = items || []
  const safeDrafts = listingDrafts || []
  const safeWatchlist = watchlistItems || []
  const safeBargains = bargainCards || []

  const stats: CollectionStats = useMemo(() => {
    const totalValue = calculateCollectionValue(safeItems)
    const owned = safeItems.filter(item => item.status === 'owned').length
    const forSale = safeItems.filter(item => item.status === 'for_sale').length
    const recentAdditions = safeItems.filter(item => {
      const daysSinceAdded = (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      return daysSinceAdded <= 30
    }).length

    return {
      totalItems: safeItems.length,
      totalValue,
      currency: 'GBP',
      itemsByStatus: {
        owned,
        for_sale: forSale,
        sold: safeItems.filter(item => item.status === 'sold').length,
        traded: safeItems.filter(item => item.status === 'traded').length,
        archived: safeItems.filter(item => item.status === 'archived').length,
      },
      itemsByFormat: {
        LP: safeItems.filter(item => item.format === 'LP').length,
        '7in': safeItems.filter(item => item.format === '7in').length,
        '12in': safeItems.filter(item => item.format === '12in').length,
        EP: safeItems.filter(item => item.format === 'EP').length,
        Boxset: safeItems.filter(item => item.format === 'Boxset').length,
      },
      recentAdditions,
      averageValue: safeItems.length > 0 ? totalValue / safeItems.length : 0,
    }
  }, [safeItems])

  const filteredItems = useMemo(() => {
    return safeItems.filter(item => {
      const matchesSearch = !searchQuery || 
        item.artistName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.releaseTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.catalogNumber?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' || item.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [safeItems, searchQuery, statusFilter])

  const handleAddItem = (newItem: CollectionItem) => {
    setItems(currentItems => [...(currentItems || []), newItem])
  }

  const handleCreateListing = (item: CollectionItem) => {
    setSelectedItemForListing(item)
    setListingGenOpen(true)
  }

  const handleSaveListingDraft = (draft: ListingDraft) => {
    setListingDrafts(currentDrafts => [...(currentDrafts || []), draft])
  }

  const handleDeleteDraft = (draftId: string) => {
    setListingDrafts(currentDrafts => (currentDrafts || []).filter(d => d.id !== draftId))
    toast.success('Draft deleted')
  }

  const handleAddWatchlistItem = (watchlistItem: WatchlistItem) => {
    setWatchlistItems(currentItems => [...(currentItems || []), watchlistItem])
    toast.success('Added to watchlist')
  }

  const handleDeleteWatchlistItem = (watchlistId: string) => {
    setWatchlistItems(currentItems => (currentItems || []).filter(w => w.id !== watchlistId))
    toast.success('Removed from watchlist')
  }

  const handleToggleWatchlistNotify = (watchlistId: string) => {
    setWatchlistItems(currentItems =>
      (currentItems || []).map(w =>
        w.id === watchlistId ? { ...w, notifyOnMatch: !w.notifyOnMatch } : w
      )
    )
    toast.success('Notification settings updated')
  }

  const handleDeleteBargain = (bargainId: string) => {
    setBargainCards(currentBargains => (currentBargains || []).filter(b => b.id !== bargainId))
    toast.success('Bargain removed')
  }

  const handleMarkBargainViewed = (bargainId: string) => {
    setBargainCards(currentBargains =>
      (currentBargains || []).map(b =>
        b.id === bargainId ? { ...b, viewed: !b.viewed } : b
      )
    )
  }

  const handleViewBargain = (bargainId: string) => {
    setBargainCards(currentBargains =>
      (currentBargains || []).map(b =>
        b.id === bargainId ? { ...b, viewed: true } : b
      )
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <Record size={32} weight="fill" className="text-accent" />
                <div>
                  <h1 className="text-2xl font-bold">VinylVault</h1>
                  <p className="text-sm text-muted-foreground">Collection Management System</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant={mainView === 'collection' ? 'default' : 'outline'}
                  onClick={() => setMainView('collection')}
                  className="gap-2"
                >
                  <Package size={18} />
                  Collection
                </Button>
                <Button 
                  variant={mainView === 'watchlist' ? 'default' : 'outline'}
                  onClick={() => setMainView('watchlist')}
                  className="gap-2"
                >
                  <Binoculars size={18} />
                  Watchlist ({safeWatchlist.length})
                </Button>
                <Button 
                  variant={mainView === 'bargains' ? 'default' : 'outline'}
                  onClick={() => setMainView('bargains')}
                  className="gap-2"
                >
                  <Lightning size={18} weight="fill" />
                  Bargains ({safeBargains.filter(b => !b.viewed).length})
                </Button>
                <Button 
                  variant={mainView === 'listings' ? 'default' : 'outline'}
                  onClick={() => setMainView('listings')}
                  className="gap-2"
                >
                  <Storefront size={18} />
                  Listings ({safeDrafts.length})
                </Button>
              </div>
            </div>
            <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
              <Plus size={20} />
              Add Item
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {mainView === 'collection' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Total Items"
                value={stats.totalItems}
                icon={<Package size={24} />}
                subtitle={`${stats.recentAdditions} added this month`}
              />
              <StatCard
                title="Collection Value"
                value={formatCurrency(stats.totalValue, stats.currency)}
                icon={<TrendUp size={24} />}
                subtitle={`Avg ${formatCurrency(stats.averageValue, stats.currency)} per item`}
                animate
              />
              <StatCard
                title="For Sale"
                value={stats.itemsByStatus.for_sale}
                icon={<ChartLine size={24} />}
                subtitle={`${stats.itemsByStatus.owned} in collection`}
              />
              <StatCard
                title="LPs"
                value={stats.itemsByFormat.LP}
                icon={<Record size={24} />}
                subtitle={`${stats.itemsByFormat['7in']} singles`}
              />
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input
                    placeholder="Search by artist, title, or catalog number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
                <TabsList>
                  <TabsTrigger value="all">All Items ({safeItems.length})</TabsTrigger>
                  <TabsTrigger value="owned">In Collection ({stats.itemsByStatus.owned})</TabsTrigger>
                  <TabsTrigger value="for_sale">For Sale ({stats.itemsByStatus.for_sale})</TabsTrigger>
                  <TabsTrigger value="sold">Sold ({stats.itemsByStatus.sold})</TabsTrigger>
                </TabsList>

                <TabsContent value={statusFilter} className="mt-6">
                  {filteredItems.length === 0 ? (
                    <div className="text-center py-12">
                      <Record size={64} className="text-muted-foreground mx-auto mb-4" weight="thin" />
                      <h3 className="text-lg font-semibold mb-2">
                        {safeItems.length === 0 ? 'No items in collection' : 'No items match your filter'}
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {safeItems.length === 0 
                          ? 'Start building your collection by adding your first vinyl record'
                          : 'Try adjusting your search or filter criteria'}
                      </p>
                      {safeItems.length === 0 && (
                        <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                          <Plus size={20} />
                          Add Your First Item
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredItems.map(item => (
                        <div key={item.id} className="relative group">
                          <ItemCard
                            item={item}
                            onClick={() => {}}
                          />
                          <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              onClick={() => handleCreateListing(item)}
                              className="gap-2"
                            >
                              <Sparkle size={16} />
                              Generate Listing
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </>
        ) : mainView === 'watchlist' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">Watchlist</h2>
                <p className="text-muted-foreground mt-1">
                  Track records you're hunting and get notified of bargains
                </p>
              </div>
              <Button onClick={() => setWatchlistDialogOpen(true)} className="gap-2">
                <Plus size={20} />
                Add Watch
              </Button>
            </div>

            {safeWatchlist.length === 0 ? (
              <div className="bg-card border border-border rounded-lg p-12 text-center">
                <Binoculars size={64} className="text-muted-foreground mx-auto mb-4" weight="thin" />
                <h3 className="text-lg font-semibold mb-2">No watchlist items yet</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  Set up watches for specific artists, releases, or pressings you're looking for
                </p>
                <Button onClick={() => setWatchlistDialogOpen(true)} className="gap-2">
                  <Plus size={20} />
                  Add Your First Watch
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {safeWatchlist.map(watchlistItem => (
                  <WatchlistCard
                    key={watchlistItem.id}
                    watchlist={watchlistItem}
                    onDelete={() => handleDeleteWatchlistItem(watchlistItem.id)}
                    onToggleNotify={() => handleToggleWatchlistNotify(watchlistItem.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : mainView === 'bargains' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">Bargain Hunter</h2>
                <p className="text-muted-foreground mt-1">
                  AI-discovered deals, misdescribed lots, and undervalued listings
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={async () => {
                    const config = marketplaceConfig || getDefaultMarketplaceConfig()
                    const validation = validateMarketplaceConfig(config)
                    if (!validation.valid) {
                      toast.error('Please configure marketplace settings first')
                      setMarketplaceSettingsOpen(true)
                      return
                    }

                    setIsScanning(true)
                    const loadingToast = toast.loading('Scanning marketplaces for bargains...')
                    
                    try {
                      const listings = await scanMarketplaces(safeWatchlist, config, {
                        maxResults: 100,
                      })
                      
                      const newBargains: BargainCardType[] = []
                      
                      for (const listing of listings) {
                        const analysis = await analyzeBargainPotential({ listing, watchlistItems: safeWatchlist })
                        
                        if (analysis.bargainScore >= 40) {
                          const newBargain: BargainCardType = {
                            id: `bargain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            listing,
                            bargainScore: analysis.bargainScore,
                            estimatedValue: analysis.estimatedValue,
                            estimatedUpside: analysis.estimatedUpside,
                            signals: analysis.signals,
                            matchedRelease: analysis.matchedRelease,
                            savedAt: new Date().toISOString(),
                            viewed: false,
                          }
                          newBargains.push(newBargain)
                        }
                      }
                      
                      setBargainCards(currentBargains => [...(currentBargains || []), ...newBargains])
                      toast.success(`Found ${newBargains.length} potential bargains from ${listings.length} listings`, {
                        id: loadingToast,
                      })
                    } catch (error) {
                      console.error('Marketplace scan error:', error)
                      toast.error('Marketplace scan failed', {
                        id: loadingToast,
                        description: error instanceof Error ? error.message : 'Unknown error',
                      })
                    } finally {
                      setIsScanning(false)
                    }
                  }} 
                  className="gap-2"
                  disabled={isScanning}
                >
                  <Lightning size={20} weight="fill" />
                  {isScanning ? 'Scanning...' : 'Scan Market'}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMarketplaceSettingsOpen(true)}
                  title="Marketplace Settings"
                >
                  <Gear size={20} />
                </Button>
              </div>
            </div>

            {safeBargains.length === 0 ? (
              <div className="bg-card border border-border rounded-lg p-12 text-center">
                <Lightning size={64} className="text-muted-foreground mx-auto mb-4" weight="thin" />
                <h3 className="text-lg font-semibold mb-2">No bargains discovered yet</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  Run market scans to find undervalued listings, misdescribed lots, and hidden gems
                </p>
                <Button onClick={async () => {
                  const config = marketplaceConfig || getDefaultMarketplaceConfig()
                  const validation = validateMarketplaceConfig(config)
                  if (!validation.valid) {
                    toast.error('Please configure marketplace settings first')
                    setMarketplaceSettingsOpen(true)
                    return
                  }

                  setIsScanning(true)
                  const loadingToast = toast.loading('Scanning marketplaces for bargains...')
                  
                  try {
                    const listings = await scanMarketplaces(safeWatchlist, config, {
                      maxResults: 100,
                    })
                    
                    const newBargains: BargainCardType[] = []
                    
                    for (const listing of listings) {
                      const analysis = await analyzeBargainPotential({ listing, watchlistItems: safeWatchlist })
                      
                      if (analysis.bargainScore >= 40) {
                        const newBargain: BargainCardType = {
                          id: `bargain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                          listing,
                          bargainScore: analysis.bargainScore,
                          estimatedValue: analysis.estimatedValue,
                          estimatedUpside: analysis.estimatedUpside,
                          signals: analysis.signals,
                          matchedRelease: analysis.matchedRelease,
                          savedAt: new Date().toISOString(),
                          viewed: false,
                        }
                        newBargains.push(newBargain)
                      }
                    }
                    
                    setBargainCards(currentBargains => [...(currentBargains || []), ...newBargains])
                    toast.success(`Found ${newBargains.length} potential bargains from ${listings.length} listings`, {
                      id: loadingToast,
                    })
                  } catch (error) {
                    console.error('Marketplace scan error:', error)
                    toast.error('Marketplace scan failed', {
                      id: loadingToast,
                      description: error instanceof Error ? error.message : 'Unknown error',
                    })
                  } finally {
                    setIsScanning(false)
                  }
                }} className="gap-2" disabled={isScanning}>
                  <Lightning size={20} weight="fill" />
                  {isScanning ? 'Scanning...' : 'Scan Market Now'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {safeBargains
                  .sort((a, b) => b.bargainScore - a.bargainScore)
                  .map(bargain => (
                    <BargainCard
                      key={bargain.id}
                      bargain={bargain}
                      onView={() => handleViewBargain(bargain.id)}
                      onDelete={() => handleDeleteBargain(bargain.id)}
                      onMarkViewed={() => handleMarkBargainViewed(bargain.id)}
                    />
                  ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">Listing Drafts</h2>
                <p className="text-muted-foreground mt-1">
                  AI-generated marketplace listings ready to publish
                </p>
              </div>
              {safeItems.length > 0 && (
                <Button onClick={() => setMainView('collection')} variant="outline" className="gap-2">
                  <Package size={18} />
                  Back to Collection
                </Button>
              )}
            </div>

            {safeDrafts.length === 0 ? (
              <div className="bg-card border border-border rounded-lg p-12 text-center">
                <Storefront size={64} className="text-muted-foreground mx-auto mb-4" weight="thin" />
                <h3 className="text-lg font-semibold mb-2">No listing drafts yet</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  Generate marketplace-ready listings from your collection items using AI-powered SEO optimization
                </p>
                {safeItems.length > 0 && (
                  <Button onClick={() => setMainView('collection')} className="gap-2">
                    <Sparkle size={20} />
                    Browse Collection
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {safeDrafts.map(draft => (
                  <ListingDraftCard
                    key={draft.id}
                    draft={draft}
                    onDelete={() => handleDeleteDraft(draft.id)}
                    onCopy={() => {
                      navigator.clipboard.writeText(draft.description)
                      toast.success('Description copied to clipboard')
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <AddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddItem}
      />

      <AddWatchlistDialog
        open={watchlistDialogOpen}
        onOpenChange={setWatchlistDialogOpen}
        onAdd={handleAddWatchlistItem}
        collectionId="default"
      />

      <ListingGenerator
        open={listingGenOpen}
        onOpenChange={setListingGenOpen}
        item={selectedItemForListing}
        onSave={handleSaveListingDraft}
      />

      <MarketplaceSettingsDialog
        open={marketplaceSettingsOpen}
        onOpenChange={setMarketplaceSettingsOpen}
      />
    </div>
  )
}

export default App