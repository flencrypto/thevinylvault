import { useState, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { CollectionItem, ItemStatus, Format, MediaGrade } from '@/lib/types'
import { ItemCard } from '@/components/ItemCard'
import { AddItemDialog } from '@/components/AddItemDialog'
import { ItemDetailDialog } from '@/components/ItemDetailDialog'
import { ExportGradedItemsDialog } from '@/components/ExportGradedItemsDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, MagnifyingGlass, FunnelSimple, SortAscending, Disc, Export } from '@phosphor-icons/react'
import { calculateCollectionValue, formatCurrency } from '@/lib/helpers'

type SortOption = 'recent' | 'artist' | 'year' | 'value' | 'grade'

export default function CollectionView() {
  const [items, setItems] = useKV<CollectionItem[]>('vinyl-vault-collection', [])
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('all')
  const [formatFilter, setFormatFilter] = useState<Format | 'all'>('all')
  const [gradeFilter, setGradeFilter] = useState<MediaGrade | 'all'>('all')
  const [sortBy, setSortBy] = useState<SortOption>('recent')

  const handleAddItem = (newItem: CollectionItem) => {
    setItems((current) => [newItem, ...(current || [])])
  }

  const handleUpdateItem = (updatedItem: CollectionItem) => {
    setItems((current) =>
      (current || []).map((item) => (item.id === updatedItem.id ? updatedItem : item))
    )
  }

  const handleDeleteItem = (itemId: string) => {
    setItems((current) => (current || []).filter((item) => item.id !== itemId))
  }

  const handleItemClick = (item: CollectionItem) => {
    setSelectedItem(item)
    setDetailDialogOpen(true)
  }

  const filteredAndSortedItems = useMemo(() => {
    let result = [...(items || [])]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (item) =>
          item.artistName.toLowerCase().includes(query) ||
          item.releaseTitle.toLowerCase().includes(query) ||
          item.catalogNumber?.toLowerCase().includes(query)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((item) => item.status === statusFilter)
    }

    if (formatFilter !== 'all') {
      result = result.filter((item) => item.format === formatFilter)
    }

    if (gradeFilter !== 'all') {
      result = result.filter((item) => item.condition.mediaGrade === gradeFilter)
    }

    switch (sortBy) {
      case 'artist':
        result.sort((a, b) => a.artistName.localeCompare(b.artistName))
        break
      case 'year':
        result.sort((a, b) => b.year - a.year)
        break
      case 'value':
        result.sort((a, b) => {
          const aValue = calculateCollectionValue([a])
          const bValue = calculateCollectionValue([b])
          return bValue - aValue
        })
        break
      case 'grade':
        result.sort((a, b) => {
          const gradeOrder = ['M', 'NM', 'EX', 'VG+', 'VG', 'G', 'F', 'P']
          return gradeOrder.indexOf(a.condition.mediaGrade) - gradeOrder.indexOf(b.condition.mediaGrade)
        })
        break
      case 'recent':
      default:
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
    }

    return result
  }, [items, searchQuery, statusFilter, formatFilter, gradeFilter, sortBy])

  const stats = useMemo(() => {
    const itemsArray = items || []
    const totalValue = calculateCollectionValue(itemsArray)
    const ownedItems = itemsArray.filter((item) => item.status === 'owned')
    
    return {
      totalItems: itemsArray.length,
      ownedItems: ownedItems.length,
      totalValue,
      averageValue: itemsArray.length > 0 ? totalValue / itemsArray.length : 0,
    }
  }, [items])

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (statusFilter !== 'all') count++
    if (formatFilter !== 'all') count++
    if (gradeFilter !== 'all') count++
    return count
  }, [statusFilter, formatFilter, gradeFilter])

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-card to-card/50 border-border">
          <div className="text-sm text-muted-foreground mb-1">Total Items</div>
          <div className="text-3xl font-bold">{stats.totalItems}</div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-card to-card/50 border-border">
          <div className="text-sm text-muted-foreground mb-1">In Collection</div>
          <div className="text-3xl font-bold text-accent">{stats.ownedItems}</div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-card to-card/50 border-border">
          <div className="text-sm text-muted-foreground mb-1">Total Value</div>
          <div className="text-3xl font-bold">{formatCurrency(stats.totalValue)}</div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-card to-card/50 border-border">
          <div className="text-sm text-muted-foreground mb-1">Avg. Value</div>
          <div className="text-3xl font-bold">{formatCurrency(stats.averageValue)}</div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search by artist, title, or catalog number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SortAscending className="mr-2" size={18} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="artist">Artist A-Z</SelectItem>
            <SelectItem value="year">Year (Newest)</SelectItem>
            <SelectItem value="value">Value (Highest)</SelectItem>
            <SelectItem value="grade">Grade (Best)</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          variant="outline" 
          onClick={() => setExportDialogOpen(true)} 
          className="gap-2"
          disabled={(items || []).filter(item => item.condition?.mediaGrade && item.condition?.sleeveGrade).length === 0}
        >
          <Export size={20} />
          <span className="hidden sm:inline">Export</span>
        </Button>

        <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
          <Plus size={20} weight="bold" />
          Add Item
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FunnelSimple size={18} />
          <span>Filters:</span>
        </div>

        <Select value={statusFilter} onValueChange={(value: ItemStatus | 'all') => setStatusFilter(value)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="owned">In Collection</SelectItem>
            <SelectItem value="for_sale">For Sale</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="traded">Traded</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={formatFilter} onValueChange={(value: Format | 'all') => setFormatFilter(value)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Formats</SelectItem>
            <SelectItem value="LP">12" LP</SelectItem>
            <SelectItem value="7in">7" Single</SelectItem>
            <SelectItem value="12in">12" Single</SelectItem>
            <SelectItem value="EP">EP</SelectItem>
            <SelectItem value="Boxset">Box Set</SelectItem>
          </SelectContent>
        </Select>

        <Select value={gradeFilter} onValueChange={(value: MediaGrade | 'all') => setGradeFilter(value)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            <SelectItem value="M">Mint</SelectItem>
            <SelectItem value="NM">Near Mint</SelectItem>
            <SelectItem value="EX">Excellent</SelectItem>
            <SelectItem value="VG+">Very Good+</SelectItem>
            <SelectItem value="VG">Very Good</SelectItem>
            <SelectItem value="G">Good</SelectItem>
          </SelectContent>
        </Select>

        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('all')
              setFormatFilter('all')
              setGradeFilter('all')
            }}
            className="gap-2"
          >
            Clear {activeFiltersCount} {activeFiltersCount === 1 ? 'filter' : 'filters'}
          </Button>
        )}
      </div>

      {filteredAndSortedItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredAndSortedItems.map((item) => (
            <ItemCard key={item.id} item={item} onClick={() => handleItemClick(item)} />
          ))}
        </div>
      ) : (items || []).length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Disc size={64} className="mx-auto mb-4 text-muted-foreground opacity-50" weight="thin" />
          <h3 className="text-xl font-semibold mb-2">Start Your Collection</h3>
          <p className="text-muted-foreground mb-6">
            Add your first vinyl record to begin tracking your collection
          </p>
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <Plus size={20} weight="bold" />
            Add First Item
          </Button>
        </Card>
      ) : (
        <Card className="p-12 text-center border-dashed">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold mb-2">No Results Found</h3>
          <p className="text-muted-foreground mb-6">
            Try adjusting your search or filters
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery('')
              setStatusFilter('all')
              setFormatFilter('all')
              setGradeFilter('all')
            }}
          >
            Clear All Filters
          </Button>
        </Card>
      )}

      <AddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddItem}
      />

      {selectedItem && (
        <ItemDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          item={selectedItem}
          onUpdate={handleUpdateItem}
          onDelete={handleDeleteItem}
        />
      )}

      <ExportGradedItemsDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        items={items || []}
      />
    </div>
  )
}
