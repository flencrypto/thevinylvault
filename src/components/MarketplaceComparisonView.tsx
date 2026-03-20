import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  MagnifyingGlass, 
  TrendUp, 
  TrendDown, 
  Minus,
  ArrowsLeftRight,
  ShoppingCart,
  Disc,
  Camera,
  Barcode,
  SortAscending,
  Funnel
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface MarketplaceListing {
  id: string
  marketplace: 'ebay' | 'discogs'
  title: string
  price: number
  currency: string
  condition: string
  url: string
  seller: string
  location: string
  shipping: number
  listedDate: string
  imageUrl?: string
  pressing?: string
  format?: string
}

interface ComparisonResult {
  id: string
  searchQuery: string
  artist: string
  album: string
  ebayListings: MarketplaceListing[]
  discogsListings: MarketplaceListing[]
  lowestEbay?: number
  lowestDiscogs?: number
  priceDifference?: number
  percentDifference?: number
  bestDeal?: 'ebay' | 'discogs'
  averageEbay?: number
  averageDiscogs?: number
  timestamp: string
}

type SortOption = 'price-diff' | 'percent-diff' | 'lowest-price' | 'recent'
type FilterOption = 'all' | 'ebay-cheaper' | 'discogs-cheaper' | 'significant-diff'

export default function MarketplaceComparisonView() {
  const [comparisons, setComparisons] = useKV<ComparisonResult[]>('marketplace-comparisons', [])
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [selectedComparison, setSelectedComparison] = useState<ComparisonResult | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('price-diff')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')

  const searchMarketplaces = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query')
      return
    }

    setIsSearching(true)
    try {
      const [ebayResults, discogsResults] = await Promise.all([
        searchEbay(searchQuery),
        searchDiscogs(searchQuery),
      ])

      const comparison = analyzeComparison(searchQuery, ebayResults, discogsResults)
      
      setComparisons(current => [comparison, ...(current || [])])
      setSelectedComparison(comparison)
      toast.success(`Found ${ebayResults.length + discogsResults.length} listings across both marketplaces`)
    } catch (error) {
      console.error('Marketplace search error:', error)
      toast.error('Failed to search marketplaces')
    } finally {
      setIsSearching(false)
    }
  }

  const searchEbay = async (query: string): Promise<MarketplaceListing[]> => {
    await new Promise(resolve => setTimeout(resolve, 800))
    
    const mockResults: MarketplaceListing[] = [
      {
        id: `ebay-${Date.now()}-1`,
        marketplace: 'ebay',
        title: `${query} - Original Pressing LP Vinyl`,
        price: 45.99,
        currency: 'GBP',
        condition: 'VG+',
        url: 'https://ebay.com/itm/123456',
        seller: 'vinyl_collector_uk',
        location: 'London, UK',
        shipping: 4.50,
        listedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        pressing: 'UK 1st Press',
        format: 'LP'
      },
      {
        id: `ebay-${Date.now()}-2`,
        marketplace: 'ebay',
        title: `${query} Vinyl Record LP`,
        price: 52.00,
        currency: 'GBP',
        condition: 'NM',
        url: 'https://ebay.com/itm/234567',
        seller: 'music_memories',
        location: 'Manchester, UK',
        shipping: 5.00,
        listedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        pressing: 'UK Press',
        format: 'LP'
      },
      {
        id: `ebay-${Date.now()}-3`,
        marketplace: 'ebay',
        title: `${query} - Rare Original LP`,
        price: 38.50,
        currency: 'GBP',
        condition: 'VG',
        url: 'https://ebay.com/itm/345678',
        seller: 'records_unlimited',
        location: 'Birmingham, UK',
        shipping: 3.95,
        listedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        pressing: '2nd Press',
        format: 'LP'
      }
    ]
    
    return mockResults
  }

  const searchDiscogs = async (query: string): Promise<MarketplaceListing[]> => {
    await new Promise(resolve => setTimeout(resolve, 800))
    
    const mockResults: MarketplaceListing[] = [
      {
        id: `discogs-${Date.now()}-1`,
        marketplace: 'discogs',
        title: `${query} (LP, Album)`,
        price: 42.00,
        currency: 'GBP',
        condition: 'VG+',
        url: 'https://discogs.com/sell/item/123456',
        seller: 'RecordShop123',
        location: 'UK',
        shipping: 4.00,
        listedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        pressing: 'UK Original',
        format: 'LP, Album'
      },
      {
        id: `discogs-${Date.now()}-2`,
        marketplace: 'discogs',
        title: `${query} - Original UK Press`,
        price: 48.50,
        currency: 'GBP',
        condition: 'NM',
        url: 'https://discogs.com/sell/item/234567',
        seller: 'VinylVault_UK',
        location: 'London, UK',
        shipping: 3.50,
        listedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        pressing: '1st UK',
        format: 'LP, Album'
      },
      {
        id: `discogs-${Date.now()}-3`,
        marketplace: 'discogs',
        title: `${query}`,
        price: 55.00,
        currency: 'GBP',
        condition: 'M',
        url: 'https://discogs.com/sell/item/345678',
        seller: 'PristineVinyl',
        location: 'UK',
        shipping: 5.00,
        listedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        pressing: 'UK 1st',
        format: 'LP, Album'
      }
    ]
    
    return mockResults
  }

  const analyzeComparison = (
    query: string,
    ebayListings: MarketplaceListing[],
    discogsListings: MarketplaceListing[]
  ): ComparisonResult => {
    const ebayPrices = ebayListings.map(l => l.price + l.shipping)
    const discogsPrices = discogsListings.map(l => l.price + l.shipping)

    const lowestEbay = ebayPrices.length > 0 ? Math.min(...ebayPrices) : undefined
    const lowestDiscogs = discogsPrices.length > 0 ? Math.min(...discogsPrices) : undefined
    
    const averageEbay = ebayPrices.length > 0 
      ? ebayPrices.reduce((a, b) => a + b, 0) / ebayPrices.length 
      : undefined
    
    const averageDiscogs = discogsPrices.length > 0 
      ? discogsPrices.reduce((a, b) => a + b, 0) / discogsPrices.length 
      : undefined

    let priceDifference: number | undefined
    let percentDifference: number | undefined
    let bestDeal: 'ebay' | 'discogs' | undefined

    if (lowestEbay !== undefined && lowestDiscogs !== undefined) {
      priceDifference = Math.abs(lowestEbay - lowestDiscogs)
      percentDifference = ((priceDifference / Math.max(lowestEbay, lowestDiscogs)) * 100)
      bestDeal = lowestEbay < lowestDiscogs ? 'ebay' : 'discogs'
    }

    const parts = query.split(/[-–]/g).map(p => p.trim())
    
    return {
      id: `comparison-${Date.now()}`,
      searchQuery: query,
      artist: parts[0] || query,
      album: parts[1] || '',
      ebayListings,
      discogsListings,
      lowestEbay,
      lowestDiscogs,
      priceDifference,
      percentDifference,
      bestDeal,
      averageEbay,
      averageDiscogs,
      timestamp: new Date().toISOString()
    }
  }

  const formatCurrency = (amount: number, currency: string = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return '1 day ago'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 14) return '1 week ago'
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const getPriceTrend = (comparison: ComparisonResult) => {
    if (!comparison.lowestEbay || !comparison.lowestDiscogs) return null
    
    if (comparison.lowestEbay < comparison.lowestDiscogs) {
      return {
        icon: TrendDown,
        color: 'text-green-400',
        bgColor: 'bg-green-950/50',
        label: 'eBay Cheaper'
      }
    } else if (comparison.lowestDiscogs < comparison.lowestEbay) {
      return {
        icon: TrendUp,
        color: 'text-blue-400',
        bgColor: 'bg-blue-950/50',
        label: 'Discogs Cheaper'
      }
    } else {
      return {
        icon: Minus,
        color: 'text-slate-400',
        bgColor: 'bg-slate-800/50',
        label: 'Same Price'
      }
    }
  }

  const filteredComparisons = (comparisons || []).filter(comp => {
    if (filterBy === 'all') return true
    if (filterBy === 'ebay-cheaper') return comp.bestDeal === 'ebay'
    if (filterBy === 'discogs-cheaper') return comp.bestDeal === 'discogs'
    if (filterBy === 'significant-diff') return (comp.percentDifference || 0) > 10
    return true
  })

  const sortedComparisons = [...filteredComparisons].sort((a, b) => {
    if (sortBy === 'price-diff') {
      return (b.priceDifference || 0) - (a.priceDifference || 0)
    }
    if (sortBy === 'percent-diff') {
      return (b.percentDifference || 0) - (a.percentDifference || 0)
    }
    if (sortBy === 'lowest-price') {
      const aLowest = Math.min(a.lowestEbay || Infinity, a.lowestDiscogs || Infinity)
      const bLowest = Math.min(b.lowestEbay || Infinity, b.lowestDiscogs || Infinity)
      return aLowest - bLowest
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-6 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
              <ArrowsLeftRight className="w-7 h-7 text-white" weight="bold" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Price Comparison</h2>
              <p className="text-sm text-muted-foreground">Compare prices across eBay & Discogs</p>
            </div>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-4">
              <div className="flex gap-2">
                <Input
                  id="comparison-search"
                  placeholder="Artist - Album (e.g., Pink Floyd - Dark Side of the Moon)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchMarketplaces()}
                  className="flex-1"
                />
                <Button 
                  onClick={searchMarketplaces} 
                  disabled={isSearching}
                  className="gap-2"
                >
                  <MagnifyingGlass weight="bold" />
                  {isSearching ? 'Searching...' : 'Compare'}
                </Button>
              </div>

              <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <SortAscending className="w-4 h-4 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price-diff">Price Difference</SelectItem>
                      <SelectItem value="percent-diff">% Difference</SelectItem>
                      <SelectItem value="lowest-price">Lowest Price</SelectItem>
                      <SelectItem value="recent">Most Recent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Funnel className="w-4 h-4 text-muted-foreground" />
                  <Select value={filterBy} onValueChange={(v) => setFilterBy(v as FilterOption)}>
                    <SelectTrigger className="w-44 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Comparisons</SelectItem>
                      <SelectItem value="ebay-cheaper">eBay Cheaper</SelectItem>
                      <SelectItem value="discogs-cheaper">Discogs Cheaper</SelectItem>
                      <SelectItem value="significant-diff">&gt;10% Difference</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {sortedComparisons.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowsLeftRight className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Comparisons Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Search for a record to compare prices across eBay and Discogs
              </p>
              <p className="text-xs text-muted-foreground">
                Try: "The Beatles - Abbey Road" or "Miles Davis - Kind of Blue"
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedComparisons.map((comparison) => {
              const trend = getPriceTrend(comparison)
              const isSelected = selectedComparison?.id === comparison.id

              return (
                <Card
                  key={comparison.id}
                  className={`bg-card border-border transition-all cursor-pointer ${
                    isSelected ? 'ring-2 ring-accent' : ''
                  }`}
                  onClick={() => setSelectedComparison(isSelected ? null : comparison)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-bold text-foreground truncate">
                          {comparison.artist}
                        </CardTitle>
                        {comparison.album && (
                          <p className="text-sm text-muted-foreground truncate">{comparison.album}</p>
                        )}
                      </div>
                      {trend && (
                        <Badge variant="outline" className={`${trend.bgColor} ${trend.color} border-0 gap-1 whitespace-nowrap`}>
                          <trend.icon className="w-3 h-3" weight="bold" />
                          {trend.label}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                            <span className="text-[10px] font-bold text-white">e</span>
                          </div>
                          <span className="text-xs text-muted-foreground">eBay</span>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-lg font-bold text-foreground">
                            {comparison.lowestEbay ? formatCurrency(comparison.lowestEbay) : '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {comparison.ebayListings.length} listing{comparison.ebayListings.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-700 rounded flex items-center justify-center">
                            <Disc className="w-3 h-3 text-white" weight="fill" />
                          </div>
                          <span className="text-xs text-muted-foreground">Discogs</span>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-lg font-bold text-foreground">
                            {comparison.lowestDiscogs ? formatCurrency(comparison.lowestDiscogs) : '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {comparison.discogsListings.length} listing{comparison.discogsListings.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    {comparison.priceDifference !== undefined && (
                      <div className="pt-3 border-t border-border">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Price Difference</span>
                          <div className="text-right">
                            <p className="text-sm font-bold text-accent">
                              {formatCurrency(comparison.priceDifference)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {comparison.percentDifference?.toFixed(1)}% difference
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {isSelected && (
                      <div className="pt-3 border-t border-border space-y-4">
                        <Tabs defaultValue="ebay" className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="ebay">
                              eBay ({comparison.ebayListings.length})
                            </TabsTrigger>
                            <TabsTrigger value="discogs">
                              Discogs ({comparison.discogsListings.length})
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="ebay" className="space-y-2 mt-4">
                            <ScrollArea className="h-[300px]">
                              <div className="space-y-2 pr-4">
                                {comparison.ebayListings.map((listing) => (
                                  <Card key={listing.id} className="bg-muted/30 border-border">
                                    <CardContent className="p-3 space-y-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-medium text-foreground line-clamp-2 flex-1">
                                          {listing.title}
                                        </p>
                                        <Badge variant="outline" className="shrink-0">
                                          {listing.condition}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">{listing.seller}</span>
                                        <span className="font-bold text-foreground">
                                          {formatCurrency(listing.price + listing.shipping)}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>{listing.location}</span>
                                        <span>{formatDate(listing.listedDate)}</span>
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full gap-2"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          window.open(listing.url, '_blank')
                                        }}
                                      >
                                        <ShoppingCart className="w-4 h-4" />
                                        View on eBay
                                      </Button>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </ScrollArea>
                          </TabsContent>

                          <TabsContent value="discogs" className="space-y-2 mt-4">
                            <ScrollArea className="h-[300px]">
                              <div className="space-y-2 pr-4">
                                {comparison.discogsListings.map((listing) => (
                                  <Card key={listing.id} className="bg-muted/30 border-border">
                                    <CardContent className="p-3 space-y-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-medium text-foreground line-clamp-2 flex-1">
                                          {listing.title}
                                        </p>
                                        <Badge variant="outline" className="shrink-0">
                                          {listing.condition}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">{listing.seller}</span>
                                        <span className="font-bold text-foreground">
                                          {formatCurrency(listing.price + listing.shipping)}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>{listing.location}</span>
                                        <span>{formatDate(listing.listedDate)}</span>
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full gap-2"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          window.open(listing.url, '_blank')
                                        }}
                                      >
                                        <ShoppingCart className="w-4 h-4" />
                                        View on Discogs
                                      </Button>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </ScrollArea>
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
