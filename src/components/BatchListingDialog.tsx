import { useState } from 'react'
import { CollectionItem, ListingDraft } from '@/lib/types'
import { generateListingCopy, generateSEOKeywords, suggestListingPrice } from '@/lib/listing-ai'
import { generatePriceEstimate } from '@/lib/helpers'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Sparkle, CheckCircle, Warning, Clock, X, Storefront } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface BatchListingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CollectionItem[]
  onSave: (drafts: ListingDraft[]) => void
}

interface BatchListingResult {
  item: CollectionItem
  draft: ListingDraft | null
  status: 'pending' | 'processing' | 'complete' | 'error'
  error?: string
}

export function BatchListingDialog({ open, onOpenChange, items, onSave }: BatchListingDialogProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<BatchListingResult[]>([])
  const [progress, setProgress] = useState(0)
  const [channel, setChannel] = useState<'ebay' | 'discogs' | 'shopify'>('ebay')

  const handleStartGeneration = async () => {
    setIsRunning(true)
    setProgress(0)

    const initialResults: BatchListingResult[] = items.map(item => ({
      item,
      draft: null,
      status: 'pending',
    }))

    setResults(initialResults)

    const completedDrafts: ListingDraft[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      setResults(prev => prev.map((r, idx) =>
        idx === i ? { ...r, status: 'processing' } : r
      ))

      try {
        const keywords = await generateSEOKeywords(item, channel)
        const { title, subtitle, description } = await generateListingCopy(item, channel, keywords)
        const estimate = generatePriceEstimate(item)
        const suggestedPrice = suggestListingPrice(estimate, item.condition.mediaGrade)

        const draft: ListingDraft = {
          id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          itemId: item.id,
          title,
          subtitle,
          description,
          price: suggestedPrice,
          currency: item.purchaseCurrency,
          conditionSummary: `${item.condition.mediaGrade}/${item.condition.sleeveGrade}`,
          seoKeywords: keywords,
          generatedByAi: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        completedDrafts.push(draft)

        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, draft, status: 'complete' } : r
        ))
      } catch (error) {
        setResults(prev => prev.map((r, idx) =>
          idx === i ? {
            ...r,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          } : r
        ))
      }

      setProgress(((i + 1) / items.length) * 100)

      if (i < items.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800))
      }
    }

    setIsRunning(false)

    if (completedDrafts.length > 0) {
      toast.success(`Generated ${completedDrafts.length} listings`)
    }
  }

  const handleSaveAll = () => {
    const completedDrafts = results
      .filter(r => r.status === 'complete' && r.draft)
      .map(r => r.draft!)

    onSave(completedDrafts)
    toast.success(`Saved ${completedDrafts.length} listing drafts`)
    onOpenChange(false)

    setTimeout(() => {
      setResults([])
      setProgress(0)
    }, 300)
  }

  const completedCount = results.filter(r => r.status === 'complete').length
  const errorCount = results.filter(r => r.status === 'error').length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/20 rounded-lg">
                <Sparkle size={24} className="text-accent" weight="fill" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Bulk Listing Generation</DialogTitle>
                <DialogDescription>
                  Generate AI-powered listings for {items.length} items
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          {results.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
              <div className="p-4 bg-accent/10 rounded-full">
                <Storefront size={48} className="text-accent" weight="duotone" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">
                  Ready to generate {items.length} listings
                </h3>
                <p className="text-muted-foreground text-sm max-w-md mb-6">
                  AI will create SEO-optimized titles, descriptions, and pricing for each item. 
                  This process may take several minutes.
                </p>

                <div className="max-w-xs mx-auto mb-6">
                  <Label htmlFor="channel" className="text-left block mb-2">
                    Target Marketplace
                  </Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                    <SelectTrigger id="channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ebay">eBay</SelectItem>
                      <SelectItem value="discogs">Discogs</SelectItem>
                      <SelectItem value="shopify">Shopify</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleStartGeneration}
                  className="gap-2"
                  size="lg"
                >
                  <Sparkle size={20} weight="fill" />
                  Generate All Listings
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="gap-2">
                      <CheckCircle size={16} weight="fill" className="text-green-500" />
                      {completedCount} Complete
                    </Badge>
                    {errorCount > 0 && (
                      <Badge variant="outline" className="gap-2">
                        <Warning size={16} weight="fill" className="text-destructive" />
                        {errorCount} Errors
                      </Badge>
                    )}
                    {isRunning && (
                      <Badge variant="outline" className="gap-2">
                        <Clock size={16} weight="fill" className="text-accent" />
                        Generating...
                      </Badge>
                    )}
                  </div>
                  <Badge className="gap-2">
                    <Storefront size={16} weight="fill" />
                    {channel.toUpperCase()}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {completedCount + errorCount} of {items.length} items processed
                    </span>
                    <span className="font-mono">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </div>

              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-3 pr-4">
                  {results.map((result, idx) => (
                    <div
                      key={result.item.id}
                      className={`p-4 border rounded-lg transition-all ${
                        result.status === 'processing'
                          ? 'border-accent bg-accent/5'
                          : result.status === 'complete'
                          ? 'border-border bg-card'
                          : result.status === 'error'
                          ? 'border-destructive/50 bg-destructive/5'
                          : 'border-border bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-muted-foreground">
                              #{(idx + 1).toString().padStart(3, '0')}
                            </span>
                            {result.status === 'complete' && (
                              <CheckCircle size={16} weight="fill" className="text-green-500 flex-shrink-0" />
                            )}
                            {result.status === 'processing' && (
                              <Clock size={16} weight="fill" className="text-accent animate-pulse flex-shrink-0" />
                            )}
                            {result.status === 'error' && (
                              <X size={16} weight="bold" className="text-destructive flex-shrink-0" />
                            )}
                          </div>
                          <h4 className="font-semibold truncate">
                            {result.item.artistName} - {result.item.releaseTitle}
                          </h4>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span>{result.item.format}</span>
                            <span>•</span>
                            <span>{result.item.year}</span>
                          </div>
                          {result.status === 'error' && result.error && (
                            <p className="text-xs text-destructive mt-2">{result.error}</p>
                          )}
                          {result.draft && (
                            <div className="mt-2 space-y-1">
                              <p className="text-sm font-medium line-clamp-1">{result.draft.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">{result.draft.description}</p>
                            </div>
                          )}
                        </div>

                        {result.draft && (
                          <div className="text-right flex-shrink-0">
                            <div className="font-mono text-lg font-bold">
                              £{result.draft.price.toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {result.draft.conditionSummary}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {isRunning ? 'Generation in progress...' : results.length > 0 ? 'Generation complete' : 'Ready to start'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isRunning}
            >
              Cancel
            </Button>
            {completedCount > 0 && !isRunning && (
              <Button
                onClick={handleSaveAll}
                className="gap-2"
              >
                <CheckCircle size={18} weight="fill" />
                Save {completedCount} Listings
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
