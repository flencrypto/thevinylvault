import { useState, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { BargainCard as BargainCardType } from '@/lib/types'
import { BargainCard } from './BargainCard'
import { MarketplaceScanDialog } from './MarketplaceScanDialog'
import { ScanScheduleDialog } from './ScanScheduleDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Sparkle, MagnifyingGlass, SortAscending, Funnel, Plus, Eye, EyeSlash, Clock } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type SortOption = 'score' | 'price' | 'upside' | 'recent'
type FilterView = 'all' | 'unviewed' | 'viewed'

export default function BargainsView() {
  const [bargains, setBargains] = useKV<BargainCardType[]>('bargains', [])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('score')
  const [filterView, setFilterView] = useState<FilterView>('all')
  const [minScore, setMinScore] = useState<number>(0)
  const [isScanDialogOpen, setIsScanDialogOpen] = useState(false)
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false)

  const filteredAndSortedBargains = useMemo(() => {
    if (!bargains) return []
    
    let filtered = [...bargains]

    if (filterView === 'unviewed') {
      filtered = filtered.filter(b => !b.viewed)
    } else if (filterView === 'viewed') {
      filtered = filtered.filter(b => b.viewed)
    }

    if (minScore > 0) {
      filtered = filtered.filter(b => b.bargainScore >= minScore)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(b =>
        b.listing.title.toLowerCase().includes(query) ||
        b.matchedRelease?.artistName.toLowerCase().includes(query) ||
        b.matchedRelease?.releaseTitle.toLowerCase().includes(query) ||
        b.listing.seller.toLowerCase().includes(query)
      )
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return b.bargainScore - a.bargainScore
        case 'price':
          return a.listing.price - b.listing.price
        case 'upside':
          return (b.estimatedUpside || 0) - (a.estimatedUpside || 0)
        case 'recent':
          return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        default:
          return 0
      }
    })

    return filtered
  }, [bargains, searchQuery, sortBy, filterView, minScore])

  const handleViewBargain = (id: string) => {
    setBargains(current =>
      (current || []).map(b => b.id === id ? { ...b, viewed: true } : b)
    )
  }

  const handleDeleteBargain = (id: string) => {
    setBargains(current => (current || []).filter(b => b.id !== id))
  }

  const handleMarkViewed = (id: string) => {
    setBargains(current =>
      (current || []).map(b => b.id === id ? { ...b, viewed: !b.viewed } : b)
    )
  }

  const handleMarkAllViewed = () => {
    setBargains(current => (current || []).map(b => ({ ...b, viewed: true })))
  }

  const unviewedCount = (bargains || []).filter(b => !b.viewed).length
  const highScoreCount = filteredAndSortedBargains.filter(b => b.bargainScore >= 70).length

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkle className="w-7 h-7 text-accent" weight="fill" />
            Bargains
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {(bargains || []).length} total • {unviewedCount} unviewed
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsScheduleDialogOpen(true)}
            className="gap-2 border-slate-700"
          >
            <Clock size={16} />
            Schedules
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsScanDialogOpen(true)}
            className="gap-2"
          >
            <MagnifyingGlass size={16} weight="bold" />
            Scan Markets
          </Button>
          {unviewedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllViewed}
              className="gap-2"
            >
              <Eye size={16} />
              Mark All Viewed
            </Button>
          )}
        </div>
      </div>

      {highScoreCount > 0 && (
        <Card className="p-4 bg-accent/10 border-accent/30">
          <div className="flex items-center gap-3">
            <Sparkle className="w-6 h-6 text-accent" weight="fill" />
            <div>
              <div className="font-semibold text-accent">Hot Bargains!</div>
              <div className="text-sm text-muted-foreground">
                {highScoreCount} high-score bargain{highScoreCount !== 1 ? 's' : ''} (70+ score)
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search bargains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Tabs value={filterView} onValueChange={(v) => setFilterView(v as FilterView)} className="flex-shrink-0">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="all" className="text-xs">
                All
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                  {(bargains || []).length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="unviewed" className="text-xs">
                <EyeSlash size={14} weight="fill" className="mr-1" />
                New
                {unviewedCount > 0 && (
                  <Badge variant="default" className="ml-1 text-[10px] px-1.5 bg-accent">
                    {unviewedCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="viewed" className="text-xs">
                <Eye size={14} weight="fill" className="mr-1" />
                Viewed
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SortAscending size={14} className="mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Best Score</SelectItem>
                <SelectItem value="upside">Best Upside</SelectItem>
                <SelectItem value="price">Lowest Price</SelectItem>
                <SelectItem value="recent">Most Recent</SelectItem>
              </SelectContent>
            </Select>

            <Select value={minScore.toString()} onValueChange={(v) => setMinScore(Number(v))}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <Funnel size={14} className="mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All Scores</SelectItem>
                <SelectItem value="40">Score 40+</SelectItem>
                <SelectItem value="60">Score 60+</SelectItem>
                <SelectItem value="70">Score 70+</SelectItem>
                <SelectItem value="80">Score 80+</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filteredAndSortedBargains.length === 0 && (bargains || []).length > 0 && (
        <Card className="p-12">
          <div className="text-center space-y-3">
            <MagnifyingGlass className="w-12 h-12 mx-auto text-muted-foreground" weight="light" />
            <div>
              <h3 className="font-semibold text-lg">No matching bargains</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your filters or search terms
              </p>
            </div>
          </div>
        </Card>
      )}

      {(bargains || []).length === 0 && (
        <Card className="p-12">
          <div className="text-center space-y-3">
            <Sparkle className="w-16 h-16 mx-auto text-muted-foreground" weight="light" />
            <div>
              <h3 className="font-semibold text-lg">No bargains yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Bargains will appear here when the marketplace scanner finds interesting deals
              </p>
            </div>
          </div>
        </Card>
      )}

      <AnimatePresence mode="popLayout">
        <div className="space-y-4">
          {filteredAndSortedBargains.map((bargain) => (
            <BargainCard
              key={bargain.id}
              bargain={bargain}
              onView={() => handleViewBargain(bargain.id)}
              onDelete={() => handleDeleteBargain(bargain.id)}
              onMarkViewed={() => handleMarkViewed(bargain.id)}
            />
          ))}
        </div>
      </AnimatePresence>

      <MarketplaceScanDialog
        open={isScanDialogOpen}
        onOpenChange={setIsScanDialogOpen}
      />
      <ScanScheduleDialog
        open={isScheduleDialogOpen}
        onOpenChange={setIsScheduleDialogOpen}
      />
    </div>
  )
}
