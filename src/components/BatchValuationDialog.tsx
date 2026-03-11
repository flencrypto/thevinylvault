import { useState } from 'react'
import { CollectionItem } from '@/lib/types'
import { generateDetailedValuation, DetailedPriceEstimate } from '@/lib/valuation-service'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChartLine, DownloadSimple, X, CheckCircle, Warning, Clock } from '@phosphor-icons/react'
import { formatCurrency } from '@/lib/helpers'

interface BatchValuationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CollectionItem[]
}

interface BatchValuationResult {
  item: CollectionItem
  valuation: DetailedPriceEstimate | null
  status: 'pending' | 'processing' | 'complete' | 'error'
  error?: string
}

export function BatchValuationDialog({ open, onOpenChange, items }: BatchValuationDialogProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<BatchValuationResult[]>([])
  const [progress, setProgress] = useState(0)

  const handleStartValuation = async () => {
    setIsRunning(true)
    setProgress(0)

    const initialResults: BatchValuationResult[] = items.map(item => ({
      item,
      valuation: null,
      status: 'pending',
    }))

    setResults(initialResults)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      setResults(prev => prev.map((r, idx) =>
        idx === i ? { ...r, status: 'processing' } : r
      ))

      try {
        const valuation = await generateDetailedValuation(item)

        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, valuation, status: 'complete' } : r
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
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    setIsRunning(false)
  }

  const handleExportCSV = () => {
    const headers = [
      'Artist',
      'Title',
      'Format',
      'Year',
      'Country',
      'Catalog Number',
      'Media Grade',
      'Sleeve Grade',
      'Estimate Low',
      'Estimate Mid',
      'Estimate High',
      'Currency',
      'Confidence Score',
      'Comparable Sales Count',
      'Market Trend',
      'Recommended Price',
      'Status',
    ]

    const rows = results
      .filter(r => r.status === 'complete' && r.valuation)
      .map(r => {
        const { item, valuation } = r
        const v = valuation!
        return [
          escapeCSV(item.artistName),
          escapeCSV(item.releaseTitle),
          escapeCSV(item.format),
          item.year.toString(),
          escapeCSV(item.country),
          escapeCSV(item.catalogNumber || ''),
          item.condition.mediaGrade,
          item.condition.sleeveGrade,
          v.estimateLow.toFixed(2),
          v.estimateMid.toFixed(2),
          v.estimateHigh.toFixed(2),
          v.currency,
          v.confidenceScore.toFixed(2),
          v.comparableSalesCount.toString(),
          v.marketTrend || 'N/A',
          v.sellerRecommendedPrice?.toFixed(2) || '',
          item.status,
        ]
      })

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `collection-valuation-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const escapeCSV = (value: string): string => {
    if (!value) return ''
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const completedCount = results.filter(r => r.status === 'complete').length
  const errorCount = results.filter(r => r.status === 'error').length
  const totalValue = results
    .filter(r => r.valuation)
    .reduce((sum, r) => sum + (r.valuation?.estimateMid || 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/20 rounded-lg">
                <ChartLine size={24} className="text-accent" weight="bold" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Batch Valuation</DialogTitle>
                <DialogDescription>
                  Value {items.length} items from your collection
                </DialogDescription>
              </div>
            </div>
            {!isRunning && results.length > 0 && completedCount > 0 && (
              <Button
                onClick={handleExportCSV}
                className="gap-2"
                variant="outline"
              >
                <DownloadSimple size={18} weight="bold" />
                Export CSV
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          {results.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
              <div className="p-4 bg-accent/10 rounded-full">
                <ChartLine size={48} className="text-accent" weight="duotone" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">
                  Ready to value {items.length} items
                </h3>
                <p className="text-muted-foreground text-sm max-w-md mb-6">
                  This will fetch market comparables and generate valuations for your entire collection. 
                  The process may take several minutes depending on collection size.
                </p>
                <Button
                  onClick={handleStartValuation}
                  className="gap-2"
                  size="lg"
                >
                  <ChartLine size={20} weight="bold" />
                  Start Batch Valuation
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
                        Processing...
                      </Badge>
                    )}
                  </div>
                  {completedCount > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Total Est. Value:</span>{' '}
                      <span className="font-mono font-semibold text-lg">
                        {formatCurrency(totalValue, 'GBP')}
                      </span>
                    </div>
                  )}
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
                            <span>•</span>
                            <span>
                              {result.item.condition.mediaGrade}/{result.item.condition.sleeveGrade}
                            </span>
                          </div>
                          {result.status === 'error' && result.error && (
                            <p className="text-xs text-destructive mt-2">{result.error}</p>
                          )}
                        </div>

                        {result.valuation && (
                          <div className="text-right flex-shrink-0">
                            <div className="font-mono text-lg font-bold">
                              {formatCurrency(result.valuation.estimateMid, result.valuation.currency)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatCurrency(result.valuation.estimateLow, result.valuation.currency)} -{' '}
                              {formatCurrency(result.valuation.estimateHigh, result.valuation.currency)}
                            </div>
                            <div className="flex items-center gap-1 justify-end mt-1">
                              <Badge variant="outline" className="text-xs">
                                {(result.valuation.confidenceScore * 100).toFixed(0)}% confidence
                              </Badge>
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
            {isRunning ? 'Valuation in progress...' : results.length > 0 ? 'Valuation complete' : 'Ready to start'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isRunning}
            >
              {results.length > 0 ? 'Close' : 'Cancel'}
            </Button>
            {results.length > 0 && !isRunning && (
              <Button
                onClick={handleStartValuation}
                variant="outline"
                className="gap-2"
              >
                Run Again
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
