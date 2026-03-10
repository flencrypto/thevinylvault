import { useState, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { CollectionItem, CollectionStats } from '@/lib/types'
import { calculateCollectionValue, formatCurrency } from '@/lib/helpers'
import { StatCard } from '@/components/StatCard'
import { ItemCard } from '@/components/ItemCard'
import { AddItemDialog } from '@/components/AddItemDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { Plus, Record, TrendUp, Package, ChartLine, MagnifyingGlass } from '@phosphor-icons/react'

function App() {
  const [items, setItems] = useKV<CollectionItem[]>('collection-items', [])
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const safeItems = items || []

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

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Record size={32} weight="fill" className="text-accent" />
              <div>
                <h1 className="text-2xl font-bold">VinylVault</h1>
                <p className="text-sm text-muted-foreground">Collection Management System</p>
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
                <div className="grid grid-cols-1 gap-4">
                  {filteredItems.map(item => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onClick={() => {}}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <AddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddItem}
      />
    </div>
  )
}

export default App