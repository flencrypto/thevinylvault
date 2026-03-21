import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { useConfidenceThresholds } from '@/hooks/use-confidence-thresholds'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { CollectionItem } from '@/lib/types'
import { identifyPressing, ScoredPressingCandidate } from '@/lib/pressing-identification-ai'
import { Lightning, CheckCircle, Warning, Disc, Sparkle, Clock, Pause, Play, Database } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface BatchIdentificationResult {
  itemId: string
  item: CollectionItem
  status: 'pending' | 'processing' | 'success' | 'failed' | 'skipped'
  candidates?: ScoredPressingCandidate[]
  bestMatch?: ScoredPressingCandidate
  error?: string
  processedAt?: string
}

interface BatchPressingIdentificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CollectionItem[]
  onComplete?: (results: BatchIdentificationResult[]) => void
}

export function BatchPressingIdentificationDialog({
  open,
  onOpenChange,
  items,
  onComplete,
}: BatchPressingIdentificationDialogProps) {
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [results, setResults] = useState<BatchIdentificationResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [processedCount, setProcessedCount] = useState(0)
  const [apiKeys] = useKV<{ discogsUserToken?: string }>('vinyl-vault-api-keys', {})
  const { thresholds } = useConfidenceThresholds()

  useEffect(() => {
    if (open && items.length > 0) {
      const unidentifiedItems = items.filter(item => !item.pressingId)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedItemIds(unidentifiedItems.map(item => item.id))
      setResults(unidentifiedItems.map(item => ({
        itemId: item.id,
        item,
        status: 'pending' as const,
      })))
      setCurrentIndex(0)
      setProcessedCount(0)
    }
  }, [open, items])

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const toggleAllItems = () => {
    if (selectedItemIds.length === items.length) {
      setSelectedItemIds([])
    } else {
      setSelectedItemIds(items.map(item => item.id))
    }
  }

  const processNextItem = async () => {
    if (isPaused || currentIndex >= results.length) {
      return
    }

    const result = results[currentIndex]
    
    if (!selectedItemIds.includes(result.itemId)) {
      setResults(prev => prev.map((r, idx) => 
        idx === currentIndex ? { ...r, status: 'skipped' as const } : r
      ))
      setCurrentIndex(prev => prev + 1)
      setProcessedCount(prev => prev + 1)
      return
    }

    setResults(prev => prev.map((r, idx) => 
      idx === currentIndex ? { ...r, status: 'processing' as const } : r
    ))

    try {
      const item = result.item
      
      const hints = {
        artist: item.artistName || undefined,
        title: item.releaseTitle || undefined,
        catalogNumber: item.catalogNumber || undefined,
        country: item.country || undefined,
        year: item.year || undefined,
        format: item.format || undefined,
      }

      const [apiKeys] = await Promise.all([
        spark.kv.get<{ discogsUserToken?: string }>('vinyl-vault-api-keys')
      ])

      const candidates = await identifyPressing({
        manualHints: hints,
        discogsSearchEnabled: !!apiKeys?.discogsUserToken,
        discogsApiToken: apiKeys?.discogsUserToken,
      })

      const bestMatch = candidates.length > 0 && 
        candidates[0].totalScore >= thresholds.pressingIdentification
        ? candidates[0]
        : undefined

      setResults(prev => prev.map((r, idx) => 
        idx === currentIndex ? {
          ...r,
          status: 'success' as const,
          candidates,
          bestMatch,
          processedAt: new Date().toISOString(),
        } : r
      ))

      if (bestMatch) {
        toast.success(`Found match for ${item.artistName} - ${item.releaseTitle}`, {
          description: `${Math.round(bestMatch.totalScore * 100)}% confidence${bestMatch.discogsId ? ' (Discogs verified)' : ''}`,
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      setResults(prev => prev.map((r, idx) => 
        idx === currentIndex ? {
          ...r,
          status: 'failed' as const,
          error: errorMessage,
          processedAt: new Date().toISOString(),
        } : r
      ))

      toast.error(`Failed to identify: ${result.item.artistName} - ${result.item.releaseTitle}`)
    }

    setCurrentIndex(prev => prev + 1)
    setProcessedCount(prev => prev + 1)
  }

  const startProcessing = () => {
    setIsProcessing(true)
    setIsPaused(false)
  }

  const pauseProcessing = () => {
    setIsPaused(true)
  }

  const resumeProcessing = () => {
    setIsPaused(false)
  }

  const handleComplete = () => {
    if (onComplete) {
      onComplete(results)
    }
    onOpenChange(false)
    toast.success('Batch identification complete', {
      description: `Processed ${processedCount} items`,
    })
  }

  useEffect(() => {
    if (isProcessing && !isPaused && currentIndex < results.length) {
      const timer = setTimeout(() => {
        processNextItem()
      }, 1000)
      return () => clearTimeout(timer)
    }

    if (isProcessing && currentIndex >= results.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsProcessing(false)
      toast.success('All items processed', {
        description: `Completed ${processedCount} identifications`,
      })
    }
  }, [isProcessing, isPaused, currentIndex])

  const stats = {
    total: results.length,
    pending: results.filter(r => r.status === 'pending').length,
    processing: results.filter(r => r.status === 'processing').length,
    success: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    matched: results.filter(r => r.bestMatch).length,
  }

  const progress = results.length > 0 ? (processedCount / results.length) * 100 : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightning className="text-accent" weight="fill" />
            Batch Pressing Identification
          </DialogTitle>
          <DialogDescription>
            Automatically identify pressings for multiple records using AI analysis
          </DialogDescription>
        </DialogHeader>

        {apiKeys?.discogsUserToken ? (
          <Alert className="bg-accent/10 border-accent">
            <Database className="text-accent" weight="fill" />
            <AlertDescription>
              <span className="font-semibold">Discogs database integration enabled.</span> Batch identification will use real Discogs data for enhanced accuracy and pressing verification.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <Database className="text-muted-foreground" />
            <AlertDescription>
              Discogs database integration not configured. Add your Discogs Personal Access Token in Settings for real database matching and higher accuracy.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Card>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Disc className="text-muted-foreground" size={24} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Matched</p>
                  <p className="text-2xl font-bold text-green-600">{stats.matched}</p>
                </div>
                <CheckCircle className="text-green-600" size={24} weight="fill" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
                </div>
                <Clock className="text-blue-600" size={24} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                </div>
                <Warning className="text-red-600" size={24} weight="fill" />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Progress: {processedCount} / {results.length}
              </span>
              <span className="text-sm font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {!isProcessing && processedCount === 0 && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm">
                {selectedItemIds.length} items selected
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={toggleAllItems}
              >
                {selectedItemIds.length === items.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          )}

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-2">
              {results.map((result) => (
                <Card 
                  key={result.itemId}
                  className={`
                    ${result.status === 'processing' ? 'border-accent' : ''}
                    ${result.status === 'success' && result.bestMatch ? 'border-green-600/50 bg-green-50/50 dark:bg-green-950/20' : ''}
                    ${result.status === 'failed' ? 'border-red-600/50 bg-red-50/50 dark:bg-red-950/20' : ''}
                  `}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      {!isProcessing && processedCount === 0 && (
                        <Checkbox
                          checked={selectedItemIds.includes(result.itemId)}
                          onCheckedChange={() => toggleItemSelection(result.itemId)}
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {result.item.artistName} - {result.item.releaseTitle}
                          </p>
                          <Badge variant={
                            result.status === 'pending' ? 'secondary' :
                            result.status === 'processing' ? 'default' :
                            result.status === 'success' ? 'default' :
                            result.status === 'failed' ? 'destructive' :
                            'outline'
                          }>
                            {result.status}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{result.item.format}</span>
                          <span>•</span>
                          <span>{result.item.year}</span>
                          {result.item.catalogNumber && (
                            <>
                              <span>•</span>
                              <span>{result.item.catalogNumber}</span>
                            </>
                          )}
                        </div>

                        {result.bestMatch && (
                          <div className="mt-2 p-3 bg-background rounded border border-green-600/20">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Sparkle className="text-accent" size={14} weight="fill" />
                                <span className="text-sm font-medium">
                                  {result.bestMatch.pressingName}
                                </span>
                              </div>
                              <Badge variant="outline" className="text-green-600">
                                {Math.round(result.bestMatch.totalScore * 100)}% match
                              </Badge>
                            </div>
                            
                            {result.bestMatch.discogsId && (
                              <div className="space-y-1 mb-2">
                                <div className="flex items-center gap-2 text-xs">
                                  <Badge variant="secondary" className="text-xs">
                                    Discogs Verified
                                  </Badge>
                                  <span className="text-muted-foreground font-mono">
                                    ID: {result.bestMatch.discogsId}
                                  </span>
                                </div>
                                {result.bestMatch.discogsVariant && (
                                  <p className="text-xs text-muted-foreground">
                                    Variant: {result.bestMatch.discogsVariant}
                                  </p>
                                )}
                              </div>
                            )}

                            {result.bestMatch.matchedIdentifiers && result.bestMatch.matchedIdentifiers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {result.bestMatch.matchedIdentifiers.slice(0, 3).map((id, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs font-mono">
                                    {id}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {result.bestMatch.discogsUrl && (
                              <a 
                                href={result.bestMatch.discogsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-accent hover:underline flex items-center gap-1"
                              >
                                View full details on Discogs →
                              </a>
                            )}
                          </div>
                        )}

                        {result.status === 'success' && !result.bestMatch && result.candidates && result.candidates.length > 0 && (
                          <Alert className="mt-2">
                            <AlertDescription className="text-xs">
                              Found {result.candidates.length} candidates, but no high-confidence match
                            </AlertDescription>
                          </Alert>
                        )}

                        {result.error && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertDescription className="text-xs">
                              {result.error}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>

                      {result.status === 'processing' && (
                        <Lightning className="text-accent animate-pulse" weight="fill" />
                      )}
                      {result.status === 'success' && result.bestMatch && (
                        <CheckCircle className="text-green-600" weight="fill" />
                      )}
                      {result.status === 'failed' && (
                        <Warning className="text-destructive" weight="fill" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            {!isProcessing && processedCount === 0 && (
              <Button
                onClick={startProcessing}
                disabled={selectedItemIds.length === 0}
                className="flex-1"
              >
                <Play weight="fill" />
                Start Batch Identification
              </Button>
            )}

            {isProcessing && !isPaused && (
              <Button
                onClick={pauseProcessing}
                variant="outline"
                className="flex-1"
              >
                <Pause weight="fill" />
                Pause
              </Button>
            )}

            {isProcessing && isPaused && (
              <Button
                onClick={resumeProcessing}
                className="flex-1"
              >
                <Play weight="fill" />
                Resume
              </Button>
            )}

            {processedCount === results.length && processedCount > 0 && (
              <Button
                onClick={handleComplete}
                className="flex-1"
              >
                <CheckCircle weight="fill" />
                Complete
              </Button>
            )}
          </div>

          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
