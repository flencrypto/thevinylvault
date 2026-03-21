import { useState, useRef } from 'react'
import { useKV } from '@github/spark/hooks'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { ItemImage, ImageType, CollectionItem, ImageAnalysisResult } from '@/lib/types'
import { 
  Camera, 
  Trash, 
  CheckCircle, 
  Sparkle, 
  CircleNotch, 
  Stack,
  Plus,
  Disc,
  ArrowRight,
  Image as ImageIcon,
  FloppyDisk
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { classifyImage } from '@/lib/openai-vision-service'
import { analyzeVinylImage } from '@/lib/image-analysis-ai'
import { identifyPressing, ScoredPressingCandidate } from '@/lib/pressing-identification-ai'
import { analyzeConditionFromImages, ConditionAnalysisResult } from '@/lib/condition-grading-ai'
import { DragDropImageZone } from '@/components/DragDropImageZone'

interface BatchAnalysisResult {
  pressing: ScoredPressingCandidate[]
  condition: ConditionAnalysisResult
  images: ImageAnalysisResult[]
}

interface RecordBatch {
  id: string
  images: ItemImage[]
  status: 'capturing' | 'analyzing' | 'complete' | 'error'
  analysisResult?: BatchAnalysisResult
  createdAt: string
}

interface BatchPhotoCaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BatchPhotoCaptureDialog({ open, onOpenChange }: BatchPhotoCaptureDialogProps) {
  const [apiKeys] = useKV<{ openaiKey?: string, imgbbKey?: string }>('vinyl-vault-api-keys', {})
  const [, setItems] = useKV<CollectionItem[]>('vinyl-vault-collection', [])
  
  const [batches, setBatches] = useState<RecordBatch[]>([])
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const startNewBatch = () => {
    const newBatchId = `batch-${Date.now()}`
    const newBatch: RecordBatch = {
      id: newBatchId,
      images: [],
      status: 'capturing',
      createdAt: new Date().toISOString()
    }
    setBatches(prev => [...prev, newBatch])
    setCurrentBatchId(newBatchId)
    toast.success('New record batch started', {
      description: 'Start capturing photos for this record'
    })
  }

  const capturePhoto = () => {
    if (!currentBatchId) {
      startNewBatch()
      setTimeout(() => cameraInputRef.current?.click(), 100)
    } else {
      cameraInputRef.current?.click()
    }
  }

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !currentBatchId) return

    const file = files[0]
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type')
      return
    }

    const dataUrl = await fileToDataUrl(file)
    
    const newImage: ItemImage = {
      // eslint-disable-next-line react-hooks/purity
      id: `img-${Date.now()}`,
      type: 'front_cover',
      dataUrl,
      mimeType: file.type,
      uploadedAt: new Date().toISOString()
    }

    setBatches(prev => prev.map(batch => 
      batch.id === currentBatchId
        ? { ...batch, images: [...batch.images, newImage] }
        : batch
    ))

    if (apiKeys?.openaiKey) {
      autoDetectImageType(currentBatchId, newImage)
    }

    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
    }

    toast.success('Photo captured', {
      description: 'Add more photos or start a new record'
    })
  }

  const handleFilesDropped = async (files: File[]) => {
    if (!currentBatchId) {
      startNewBatch()
      setTimeout(() => processDroppedFiles(files), 100)
    } else {
      await processDroppedFiles(files)
    }
  }

  const processDroppedFiles = async (files: File[]) => {
    if (!currentBatchId) return

    const validImages: ItemImage[] = []
    
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue

      const dataUrl = await fileToDataUrl(file)
      
      const newImage: ItemImage = {
        // eslint-disable-next-line react-hooks/purity
        id: `img-${Date.now()}-${Math.random()}`,
        type: 'front_cover',
        dataUrl,
        mimeType: file.type,
        uploadedAt: new Date().toISOString()
      }

      validImages.push(newImage)
    }

    if (validImages.length === 0) {
      toast.error('No valid image files found')
      return
    }

    setBatches(prev => prev.map(batch => 
      batch.id === currentBatchId
        ? { ...batch, images: [...batch.images, ...validImages] }
        : batch
    ))

    if (apiKeys?.openaiKey) {
      for (const img of validImages) {
        autoDetectImageType(currentBatchId, img)
      }
    }

    toast.success(`Added ${validImages.length} image${validImages.length !== 1 ? 's' : ''}`, {
      description: 'Add more photos or start a new record'
    })
  }

  const autoDetectImageType = async (batchId: string, image: ItemImage) => {
    if (!apiKeys?.openaiKey) return

    try {
      const result = await classifyImage(image.dataUrl)
      
      setBatches(prev => prev.map(batch => {
        if (batch.id !== batchId) return batch
        
        return {
          ...batch,
          images: batch.images.map(img =>
            img.id === image.id
              ? { ...img, type: result.imageType as ImageType }
              : img
          )
        }
      }))
    } catch (error) {
      console.error('Auto-detection failed:', error)
    }
  }

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (batchId: string, imageId: string) => {
    setBatches(prev => prev.map(batch => {
      if (batch.id !== batchId) return batch
      return {
        ...batch,
        images: batch.images.filter(img => img.id !== imageId)
      }
    }))
  }

  const removeBatch = (batchId: string) => {
    setBatches(prev => prev.filter(batch => batch.id !== batchId))
    if (currentBatchId === batchId) {
      setCurrentBatchId(null)
    }
  }

  const processAllBatches = async () => {
    if (!apiKeys?.openaiKey) {
      toast.error('OpenAI API key required', {
        description: 'Please configure your API key in Settings'
      })
      return
    }

    const batchesToProcess = batches.filter(b => b.status === 'capturing' && b.images.length > 0)
    
    if (batchesToProcess.length === 0) {
      toast.info('No batches to process')
      return
    }

    setIsProcessing(true)
    setProcessingProgress(0)

    let processedCount = 0
    const totalBatches = batchesToProcess.length

    for (const batch of batchesToProcess) {
      try {
        setBatches(prev => prev.map(b => 
          b.id === batch.id ? { ...b, status: 'analyzing' } : b
        ))

        const imageAnalysisResults = await Promise.all(
          batch.images.map(img => analyzeVinylImage(img.dataUrl, img.type))
        )

        const pressingResult = await identifyPressing({
          imageAnalysis: imageAnalysisResults,
          manualHints: {}
        })

        const conditionResult = await analyzeConditionFromImages(batch.images)

        const analysisResult = {
          pressing: pressingResult,
          condition: conditionResult,
          images: imageAnalysisResults
        }

        setBatches(prev => prev.map(b => 
          b.id === batch.id 
            ? { ...b, status: 'complete', analysisResult } 
            : b
        ))

        processedCount++
        setProcessingProgress((processedCount / totalBatches) * 100)

      } catch (error) {
        console.error(`Failed to process batch ${batch.id}:`, error)
        setBatches(prev => prev.map(b => 
          b.id === batch.id ? { ...b, status: 'error' } : b
        ))
        toast.error(`Failed to process batch`, {
          description: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    setIsProcessing(false)
    setProcessingProgress(0)

    toast.success(`Processed ${processedCount} record batch${processedCount !== 1 ? 'es' : ''}`, {
      description: 'Review results and save to collection'
    })
  }

  const saveToCollection = async (batch: RecordBatch) => {
    if (!batch.analysisResult) {
      toast.error('No analysis data available')
      return
    }

    try {
      const { pressing, condition } = batch.analysisResult

      const topCandidate = pressing[0]
      
      const newItem: CollectionItem = {
        id: `item-${Date.now()}`,
        collectionId: 'default',
        artistName: topCandidate?.artistName || 'Unknown Artist',
        releaseTitle: topCandidate?.releaseTitle || 'Unknown Title',
        year: topCandidate?.year || new Date().getFullYear(),
        country: topCandidate?.country || '',
        format: topCandidate?.format || 'LP',
        catalogNumber: topCandidate?.catalogNumber,
        purchaseCurrency: 'GBP',
        sourceType: 'unknown',
        quantity: 1,
        condition: {
          mediaGrade: condition.mediaGrade || 'VG+',
          sleeveGrade: condition.sleeveGrade || 'VG+',
          gradingStandard: 'Goldmine',
          gradingNotes: condition.reasoning,
          gradedAt: new Date().toISOString()
        },
        notes: condition.reasoning,
        images: batch.images.map(img => img.dataUrl),
        status: 'owned',
        storageLocation: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      setItems((currentItems) => [...(currentItems || []), newItem])

      removeBatch(batch.id)

      toast.success('Added to collection', {
        description: `${newItem.artistName} - ${newItem.releaseTitle}`
      })
    } catch (error) {
      toast.error('Failed to save to collection', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  const currentBatch = batches.find(b => b.id === currentBatchId)
  const completedBatches = batches.filter(b => b.status === 'complete')
  const totalPhotos = batches.reduce((sum, b) => sum + b.images.length, 0)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stack size={24} weight="fill" className="text-accent" />
              Bulk Photo Capture
            </DialogTitle>
            <DialogDescription>
              Capture photos for multiple records in one session. Take photos of each record, then process all at once.
            </DialogDescription>
          </DialogHeader>

          <DragDropImageZone 
            onFilesSelected={handleFilesDropped}
            maxFiles={100}
            currentFileCount={totalPhotos}
            disabled={isProcessing}
            showUploadPrompt={false}
            className="flex-1 overflow-hidden"
          >
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
                {!apiKeys?.openaiKey && (
                  <Card className="border-amber-500/50 bg-amber-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <Sparkle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" weight="fill" />
                      <div>
                        <h4 className="text-sm font-semibold text-amber-500 mb-1">AI Features Disabled</h4>
                        <p className="text-xs text-muted-foreground">
                          Configure your OpenAI API key in Settings to enable automatic image type detection and batch analysis.
                        </p>
                      </div>
                    </div>
                  </Card>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent">{batches.length}</div>
                      <div className="text-xs text-muted-foreground">Record Batches</div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent">{totalPhotos}</div>
                      <div className="text-xs text-muted-foreground">Total Photos</div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500">{completedBatches.length}</div>
                      <div className="text-xs text-muted-foreground">Analyzed</div>
                    </div>
                  </Card>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button onClick={capturePhoto} className="gap-2 flex-1 sm:flex-initial">
                    <Camera size={18} weight="fill" />
                    {currentBatchId ? 'Capture Photo' : 'Start First Record'}
                  </Button>
                  {currentBatchId && currentBatch && currentBatch.images.length > 0 && (
                    <Button onClick={startNewBatch} variant="secondary" className="gap-2 flex-1 sm:flex-initial">
                      <Plus size={18} weight="bold" />
                      New Record
                    </Button>
                  )}
                  {batches.length > 0 && (
                    <Button 
                      onClick={processAllBatches} 
                      variant="default"
                      disabled={isProcessing || batches.filter(b => b.status === 'capturing' && b.images.length > 0).length === 0}
                      className="gap-2 flex-1 sm:flex-initial bg-accent hover:bg-accent/90"
                    >
                      <Sparkle size={18} weight="fill" />
                      {isProcessing ? 'Processing...' : 'Analyze All'}
                    </Button>
                  )}
                </div>

                {isProcessing && (
                  <Card className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Processing batches...</span>
                        <span className="font-semibold">{Math.round(processingProgress)}%</span>
                      </div>
                      <Progress value={processingProgress} />
                    </div>
                  </Card>
                )}

                {batches.length === 0 && (
                  <Card className="border-dashed">
                    <div className="p-12 text-center">
                      <Stack size={48} className="mx-auto mb-4 text-muted-foreground" weight="thin" />
                      <p className="text-sm text-muted-foreground mb-4">
                        No batches yet. Start capturing photos for your first record.
                      </p>
                      <Button onClick={capturePhoto} className="gap-2">
                        <Camera size={18} weight="fill" />
                        Start Capturing
                      </Button>
                    </div>
                  </Card>
                )}

                {batches.map((batch, batchIndex) => (
                  <Card key={batch.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Disc size={20} className="text-accent" weight="fill" />
                        <div>
                          <h4 className="font-semibold text-sm">Record #{batchIndex + 1}</h4>
                          <p className="text-xs text-muted-foreground">
                            {batch.images.length} photo{batch.images.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {batch.status === 'capturing' && (
                          <Badge variant="secondary" className="gap-1">
                            <Camera size={12} />
                            Capturing
                          </Badge>
                        )}
                        {batch.status === 'analyzing' && (
                          <Badge className="gap-1 bg-blue-600">
                            <CircleNotch size={12} className="animate-spin" />
                            Analyzing
                          </Badge>
                        )}
                        {batch.status === 'complete' && (
                          <Badge className="gap-1 bg-green-600">
                            <CheckCircle size={12} weight="fill" />
                            Complete
                          </Badge>
                        )}
                        {batch.status === 'error' && (
                          <Badge variant="destructive" className="gap-1">
                            Error
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBatch(batch.id)}
                          className="h-7 w-7 p-0"
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    </div>

                    {batch.images.length > 0 ? (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {batch.images.map((image) => (
                          <div key={image.id} className="relative group">
                            <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                              <img
                                src={image.dataUrl}
                                alt={image.type}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <Badge className="absolute bottom-1 left-1 text-[8px] px-1 py-0 h-auto">
                              {image.type.split('_')[0]}
                            </Badge>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeImage(batch.id, image.id)}
                              className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash size={12} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 border-2 border-dashed rounded-lg">
                        <ImageIcon size={32} className="mx-auto mb-2 text-muted-foreground" weight="thin" />
                        <p className="text-xs text-muted-foreground">No photos yet</p>
                      </div>
                    )}

                    {batch.status === 'complete' && batch.analysisResult && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        <div className="text-sm">
                          <div className="font-semibold text-accent">
                            {batch.analysisResult.pressing[0]?.artistName || 'Unknown Artist'}
                          </div>
                          <div className="text-muted-foreground">
                            {batch.analysisResult.pressing[0]?.releaseTitle || 'Unknown Title'}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => saveToCollection(batch)}
                            className="gap-2 flex-1"
                          >
                            <FloppyDisk size={14} weight="fill" />
                            Save to Collection
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="gap-2"
                          >
                            <ArrowRight size={14} />
                            Create Listing
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </DragDropImageZone>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoCapture}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
