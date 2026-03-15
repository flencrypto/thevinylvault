import { useState, useMemo, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { CollectionItem, ItemStatus, Format, MediaGrade, TrendAlert } from '@/lib/types'
import { ItemCard } from '@/components/ItemCard'
import { AddItemDialog } from '@/components/AddItemDialog'
import { ItemDetailDialog } from '@/components/ItemDetailDialog'
import { ExportGradedItemsDialog } from '@/components/ExportGradedItemsDialog'
import { MarketTrendsWidget } from '@/components/MarketTrendsWidget'
import { TrendAlertsDialog } from '@/components/TrendAlertsDialog'
import { BatchPressingIdentificationDialog } from '@/components/BatchPressingIdentificationDialog'
import { MoodAnalysisDialog } from '@/components/MoodAnalysisDialog'
import { QuantumAnalyticsDialog } from '@/components/QuantumAnalyticsDialog'
import { BlockchainAuthDialog } from '@/components/BlockchainAuthDialog'
import { VRPreviewDialog } from '@/components/VRPreviewDialog'
import QuickActionsBar from '@/components/QuickActionsBar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, MagnifyingGlass, FunnelSimple, SortAscending, Disc, Export, Bell, TrendUp, TrendDown, Lightning, Sparkle, MusicNote, Atom, ShieldCheck, VirtualReality } from '@phosphor-icons/react'
import { calculateCollectionValue, formatCurrency } from '@/lib/helpers'
import { TrendIndicator } from './TrendIndicator'
import { generateTrendAlerts, getTrendAlertSummary } from '@/lib/trend-monitoring'
import { toast } from 'sonner'
import { BarcodeScanResult } from './BarcodeScannerWidget'

type SortOption = 'recent' | 'artist' | 'year' | 'value' | 'grade'

export default function CollectionView() {
  const [items, setItems] = useKV<CollectionItem[]>('vinyl-vault-collection', [])
  const [trendAlerts, setTrendAlerts] = useKV<TrendAlert[]>('vinyl-vault-trend-alerts', [])
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [alertsDialogOpen, setAlertsDialogOpen] = useState(false)
  const [batchIdentifyDialogOpen, setBatchIdentifyDialogOpen] = useState(false)
  const [moodAnalysisDialogOpen, setMoodAnalysisDialogOpen] = useState(false)
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false)
  const [blockchainAuthDialogOpen, setBlockchainAuthDialogOpen] = useState(false)
  const [vrPreviewDialogOpen, setVrPreviewDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('all')
  const [formatFilter, setFormatFilter] = useState<Format | 'all'>('all')
  const [gradeFilter, setGradeFilter] = useState<MediaGrade | 'all'>('all')
  const [sortBy, setSortBy] = useState<SortOption>('recent')

  useEffect(() => {
    const newAlerts = generateTrendAlerts(items || [], trendAlerts || [])
    if (newAlerts.length > 0) {
      setTrendAlerts((current) => [...newAlerts, ...(current || [])])
      
      newAlerts.forEach(alert => {
        if (alert.severity === 'critical' || alert.severity === 'high') {
          const icon = alert.changeAmount > 0 ? '📈' : '📉'
          toast(alert.message, {
            icon,
            duration: 5000,
          })
        }
      })
    }
  }, [items])

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
    
    let risingCount = 0
    let fallingCount = 0
    let totalTrendPercent = 0
    let itemsWithTrends = 0

    itemsArray.forEach(item => {
      if (item.priceHistory && item.priceHistory.length >= 2) {
        const sortedHistory = [...item.priceHistory].sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
        const oldest = sortedHistory[0].estimatedValue
        const newest = sortedHistory[sortedHistory.length - 1].estimatedValue
        const change = newest - oldest
        const changePercent = (change / oldest) * 100

        if (change > 0) risingCount++
        else if (change < 0) fallingCount++

        totalTrendPercent += changePercent
        itemsWithTrends++
      }
    })

    const avgTrend = itemsWithTrends > 0 ? totalTrendPercent / itemsWithTrends : 0
    
    return {
      totalItems: itemsArray.length,
      ownedItems: ownedItems.length,
      totalValue,
      averageValue: itemsArray.length > 0 ? totalValue / itemsArray.length : 0,
      risingCount,
      fallingCount,
      avgTrend,
      itemsWithTrends,
    }
  }, [items])

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (statusFilter !== 'all') count++
    if (formatFilter !== 'all') count++
    if (gradeFilter !== 'all') count++
    return count
  }, [statusFilter, formatFilter, gradeFilter])

  const alertSummary = useMemo(() => {
    return getTrendAlertSummary(trendAlerts || [])
  }, [trendAlerts])

  const handleMarkAlertAsRead = (alertId: string) => {
    setTrendAlerts((current) =>
      (current || []).map((alert) =>
        alert.id === alertId ? { ...alert, read: true } : alert
      )
    )
  }

  const handleDismissAlert = (alertId: string) => {
    setTrendAlerts((current) =>
      (current || []).map((alert) =>
        alert.id === alertId ? { ...alert, dismissed: true } : alert
      )
    )
  }

  const handleDismissAllAlerts = () => {
    setTrendAlerts((current) =>
      (current || []).map((alert) => ({ ...alert, dismissed: true }))
    )
  }

  const handleViewItemFromAlert = (itemId: string) => {
    const item = items?.find((i) => i.id === itemId)
    if (item) {
      setSelectedItem(item)
      setDetailDialogOpen(true)
      setAlertsDialogOpen(false)
    }
  }

  const handleBarcodeScanned = (result: BarcodeScanResult) => {
    toast.success(`Barcode scanned! Opening add dialog...`)
    setAddDialogOpen(true)
  }

  const handleBatchIdentificationComplete = (results: any[]) => {
    const matchedResults = results.filter(r => r.bestMatch)
    
    setItems((current) => 
      (current || []).map(item => {
        const result = results.find(r => r.itemId === item.id)
        if (result?.bestMatch) {
          return {
            ...item,
            pressingId: result.bestMatch.id,
            updatedAt: new Date().toISOString(),
          }
        }
        return item
      })
    )

    toast.success(`Batch identification complete`, {
      description: `Matched ${matchedResults.length} of ${results.length} items`,
    })
  }

  return (
    <div className="pb-6 space-y-0">
      <QuickActionsBar onBarcodeScanned={handleBarcodeScanned} />
      
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-3 sm:p-4 bg-gradient-to-br from-card to-card/50 border-border">
            <div className="text-xs sm:text-sm text-muted-foreground mb-1">Total Items</div>
            <div className="text-2xl sm:text-3xl font-bold">{stats.totalItems}</div>
          </Card>
        
        <Card className="p-3 sm:p-4 bg-gradient-to-br from-card to-card/50 border-border">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">In Collection</div>
          <div className="text-2xl sm:text-3xl font-bold text-accent">{stats.ownedItems}</div>
        </Card>
        
        <Card className="p-3 sm:p-4 bg-gradient-to-br from-card to-card/50 border-border">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">Total Value</div>
          <div className="text-xl sm:text-3xl font-bold">{formatCurrency(stats.totalValue)}</div>
          {stats.avgTrend !== 0 && stats.itemsWithTrends > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <TrendIndicator value={stats.avgTrend} showIcon showValue size="sm" />
              <span className="text-[10px] sm:text-xs text-muted-foreground">avg. trend</span>
            </div>
          )}
        </Card>
        
        <Card className="p-3 sm:p-4 bg-gradient-to-br from-card to-card/50 border-border">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">Market Trends</div>
          <div className="flex items-center gap-2 sm:gap-4 mt-2">
            <div className="flex items-center gap-1">
              <TrendIndicator value={10} showIcon={false} className="text-green-500" />
              <span className="text-lg sm:text-2xl font-bold text-green-500">{stats.risingCount}</span>
            </div>
            <div className="text-muted-foreground">|</div>
            <div className="flex items-center gap-1">
              <TrendIndicator value={-10} showIcon={false} className="text-red-500" />
              <span className="text-lg sm:text-2xl font-bold text-red-500">{stats.fallingCount}</span>
            </div>
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">
            rising / falling values
          </div>
        </Card>
      </div>

      {alertSummary.unread > 0 && (
        <Alert className="border-accent/50 bg-accent/10">
          <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-accent" weight="fill" />
          <AlertDescription className="ml-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">
                  {alertSummary.unread} new trend {alertSummary.unread === 1 ? 'alert' : 'alerts'}
                </span>
                {alertSummary.critical > 0 && (
                  <Badge variant="outline" className="bg-red-500/20 text-red-500 border-red-500/30 text-xs">
                    <Lightning size={10} weight="fill" className="mr-1" />
                    {alertSummary.critical} Critical
                  </Badge>
                )}
                {alertSummary.gains > 0 && (
                  <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                    <TrendUp size={10} weight="bold" className="mr-1" />
                    {alertSummary.gains} Gains
                  </Badge>
                )}
                {alertSummary.losses > 0 && (
                  <Badge variant="outline" className="bg-red-500/20 text-red-500 border-red-500/30 text-xs">
                    <TrendDown size={10} weight="bold" className="mr-1" />
                    {alertSummary.losses} Losses
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAlertsDialogOpen(true)}
                className="gap-1.5 shrink-0 text-xs"
              >
                View Alerts
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Search by artist, title, or catalog number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px] h-10">
              <SortAscending className="mr-2" size={16} />
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
            className="gap-1.5 flex-1 sm:flex-none h-10"
            disabled={(items || []).filter(item => item.condition?.mediaGrade && item.condition?.sleeveGrade).length === 0}
          >
            <Export size={18} />
            <span>Export</span>
          </Button>

          <Button 
            variant="outline" 
            onClick={() => setBatchIdentifyDialogOpen(true)} 
            className="gap-1.5 flex-1 sm:flex-none h-10 bg-gradient-to-r from-accent/10 to-accent/5 border-accent/30 hover:border-accent/50"
            disabled={(items || []).filter(item => !item.pressingId).length === 0}
          >
            <Sparkle size={18} weight="fill" />
            <span>Batch ID</span>
          </Button>

          <Button 
            variant="outline" 
            onClick={() => setMoodAnalysisDialogOpen(true)} 
            className="gap-1.5 flex-1 sm:flex-none h-10"
            disabled={(items || []).length === 0}
          >
            <MusicNote size={18} />
            <span>Mood Analysis</span>
          </Button>

          <Button 
            variant="outline" 
            onClick={() => setAnalyticsDialogOpen(true)} 
            className="gap-1.5 flex-1 sm:flex-none h-10"
            disabled={(items || []).length === 0}
          >
            <Atom size={18} />
            <span>Analytics</span>
          </Button>

          <Button 
            variant="outline" 
            onClick={() => setBlockchainAuthDialogOpen(true)} 
            className="gap-1.5 flex-1 sm:flex-none h-10"
            disabled={(items || []).length === 0}
          >
            <ShieldCheck size={18} />
            <span>Blockchain Certificate</span>
          </Button>

          <Button 
            variant="outline" 
            onClick={() => setVrPreviewDialogOpen(true)} 
            className="gap-1.5 flex-1 sm:flex-none h-10"
          >
            <VirtualReality size={18} />
            <span>VR Preview</span>
          </Button>

          <Button 
            variant="outline" 
            onClick={() => setAlertsDialogOpen(true)} 
            className="gap-1.5 relative flex-1 sm:flex-none h-10"
          >
            <Bell size={18} weight={alertSummary.unread > 0 ? 'fill' : 'regular'} />
            <span>Alerts</span>
            {alertSummary.unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-accent-foreground rounded-full text-xs flex items-center justify-center font-bold">
              {alertSummary.unread > 9 ? '9+' : alertSummary.unread}
            </span>
          )}
        </Button>

        <Button onClick={() => setAddDialogOpen(true)} className="gap-1.5 flex-1 sm:flex-none h-10">
          <Plus size={18} weight="bold" />
          <span>Add Item</span>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3 sm:items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FunnelSimple size={16} />
          <span>Filters:</span>
        </div>

        <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={(value: ItemStatus | 'all') => setStatusFilter(value)}>
            <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
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
            <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
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
            <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
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
        </div>

        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('all')
              setFormatFilter('all')
              setGradeFilter('all')
            }}
            className="gap-1.5 text-xs w-full sm:w-auto"
          >
            Clear {activeFiltersCount} {activeFiltersCount === 1 ? 'filter' : 'filters'}
          </Button>
        )}
      </div>

      {(items || []).length > 0 && stats.itemsWithTrends > 0 && (
        <MarketTrendsWidget items={items || []} />
      )}

      {filteredAndSortedItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {filteredAndSortedItems.map((item) => (
            <ItemCard key={item.id} item={item} onClick={() => handleItemClick(item)} />
          ))}
        </div>
      ) : (items || []).length === 0 ? (
        <Card className="p-8 sm:p-12 text-center border-dashed">
          <Disc size={48} className="sm:w-16 sm:h-16 mx-auto mb-4 text-muted-foreground opacity-50" weight="thin" />
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Start Your Collection</h3>
          <p className="text-sm sm:text-base text-muted-foreground mb-6">
            Add your first vinyl record to begin tracking your collection
          </p>
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <Plus size={18} weight="bold" />
            Add First Item
          </Button>
        </Card>
      ) : (
        <Card className="p-8 sm:p-12 text-center border-dashed">
          <div className="text-3xl sm:text-4xl mb-4">🔍</div>
          <h3 className="text-lg sm:text-xl font-semibold mb-2">No Results Found</h3>
          <p className="text-sm sm:text-base text-muted-foreground mb-6">
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

      <TrendAlertsDialog
        open={alertsDialogOpen}
        onOpenChange={setAlertsDialogOpen}
        alerts={trendAlerts || []}
        onMarkAsRead={handleMarkAlertAsRead}
        onDismiss={handleDismissAlert}
        onDismissAll={handleDismissAllAlerts}
        onViewItem={handleViewItemFromAlert}
      />

      <BatchPressingIdentificationDialog
        open={batchIdentifyDialogOpen}
        onOpenChange={setBatchIdentifyDialogOpen}
        items={(items || []).filter(item => !item.pressingId)}
        onComplete={handleBatchIdentificationComplete}
      />
      <MoodAnalysisDialog
        open={moodAnalysisDialogOpen}
        onOpenChange={setMoodAnalysisDialogOpen}
      />
      <QuantumAnalyticsDialog
        open={analyticsDialogOpen}
        onOpenChange={setAnalyticsDialogOpen}
      />
      <BlockchainAuthDialog
        open={blockchainAuthDialogOpen}
        onOpenChange={setBlockchainAuthDialogOpen}
      />
      <VRPreviewDialog
        open={vrPreviewDialogOpen}
        onOpenChange={setVrPreviewDialogOpen}
      />
    </div>
    </div>
    </div>
  )
}
