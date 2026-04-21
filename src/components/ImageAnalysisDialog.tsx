import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Sparkle, 
  CheckCircle, 
  Warning, 
  Eye, 
  TextAa, 
  Barcode, 
  Record, 
  FilmStrip,
  Info,
  ShieldCheck
} from '@phosphor-icons/react'
import { ItemImage } from '@/lib/types'
import { 
  ImageAnalysisOutput, 
  analyzeImageComplete,
  DefectType 
} from '@/lib/openai-vision-service'
import { useConfidenceThresholds } from '@/hooks/use-confidence-thresholds'
import { toast } from 'sonner'

interface ImageAnalysisDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: ItemImage[]
  onAnalysisComplete?: (results: Map<string, ImageAnalysisOutput>) => void
}

const DEFECT_ICONS: Record<DefectType, string> = {
  seam_split: '📏',
  ringwear: '⭕',
  staining: '💧',
  creasing: '📄',
  sticker_residue: '🏷️',
  writing_on_sleeve: '✍️',
  scuffs_on_label: '⚡',
  scratches: '〰️',
  spindle_wear: '🎯',
  corner_wear: '📐',
  edge_wear: '📏',
  surface_marks: '✨'
}

const IMAGE_TYPE_LABELS = {
  front_cover: 'Front Cover',
  back_cover: 'Back Cover',
  label: 'Label',
  runout: 'Runout',
  insert: 'Insert',
  spine: 'Spine',
  unknown: 'Unknown'
}

export function ImageAnalysisDialog({ 
  open, 
  onOpenChange, 
  images,
  onAnalysisComplete 
}: ImageAnalysisDialogProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<Map<string, ImageAnalysisOutput>>(new Map())
  const [analysisErrors, setAnalysisErrors] = useState<Array<{ imageId: string; imageType: ItemImage['type']; message: string }>>([])
  const [currentStep, setCurrentStep] = useState('')
  const [showRawOutput, setShowRawOutput] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { checkConfidence: _checkConfidence, getThreshold } = useConfidenceThresholds()

  const handleAnalyze = async () => {
    if (images.length === 0) return

    setIsAnalyzing(true)
    setProgress(0)
    setCurrentStep('Starting analysis...')
    setAnalysisErrors([])
    const analysisResults = new Map<string, ImageAnalysisOutput>()
    const errors: Array<{ imageId: string; imageType: ItemImage['type']; message: string }> = []

    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      setCurrentStep(`Analyzing image ${i + 1} of ${images.length}: ${IMAGE_TYPE_LABELS[image.type]}`)

      try {
        const analysis = await analyzeImageComplete(image.dataUrl, image.type)
        analysisResults.set(image.id, analysis)
      } catch (error) {
        console.error(`Failed to analyze image ${image.id}:`, error)
        const message = error instanceof Error ? error.message : 'Unknown analysis error'
        errors.push({ imageId: image.id, imageType: image.type, message })
      }

      setProgress(((i + 1) / images.length) * 100)
    }

    setCurrentStep('Analysis complete!')
    setResults(analysisResults)
    setAnalysisErrors(errors)
    setIsAnalyzing(false)

    if (analysisResults.size > 0) {
      toast.success('AI analysis completed', {
        description: errors.length > 0
          ? `${analysisResults.size} image${analysisResults.size !== 1 ? 's' : ''} analyzed, ${errors.length} failed.`
          : `${analysisResults.size} image${analysisResults.size !== 1 ? 's' : ''} analyzed successfully.`,
      })
    } else if (errors.length > 0) {
      toast.error('AI analysis failed', {
        description: `Could not analyze ${errors.length} image${errors.length !== 1 ? 's' : ''}.`,
      })
    }
  }

  const handleApplyResults = () => {
    if (onAnalysisComplete) {
      onAnalysisComplete(results)
    }
    onOpenChange(false)
  }

  const getConfidenceColor = (confidence: number) => {
    const threshold = getThreshold('imageClassification') / 100
    if (confidence >= threshold) return 'text-green-500'
    if (confidence >= threshold * 0.8) return 'text-yellow-500'
    return 'text-orange-500'
  }

  const getConfidenceBadge = (confidence: number) => {
    const threshold = getThreshold('imageClassification') / 100
    const meetsThreshold = confidence >= threshold
    
    if (meetsThreshold) {
      return { variant: 'default' as const, label: 'Trusted', icon: <ShieldCheck size={14} weight="fill" /> }
    }
    if (confidence >= threshold * 0.8) {
      return { variant: 'secondary' as const, label: 'Review Needed', icon: <Warning size={14} /> }
    }
    return { variant: 'destructive' as const, label: 'Low Confidence', icon: <Warning size={14} weight="fill" /> }
  }

  const renderAnalysisErrors = (className?: string) => {
    if (analysisErrors.length === 0) return null

    return (
      <Alert variant="destructive" className={className}>
        <Warning size={16} />
        <AlertDescription className="space-y-1">
          <p className="font-medium">Analysis errors detected while analyzing images:</p>
          <ul className="list-disc pl-4 text-xs">
            {analysisErrors.map((entry) => (
              <li key={entry.imageId}>
                {IMAGE_TYPE_LABELS[entry.imageType]}: {entry.message}
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkle size={24} weight="fill" className="text-accent" />
            AI Image Analysis
          </DialogTitle>
          <DialogDescription>
            Analyze {images.length} image{images.length !== 1 ? 's' : ''} using OpenAI vision to extract metadata and detect condition issues
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {!isAnalyzing && results.size === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <Eye size={64} className="text-muted-foreground mb-4" weight="thin" />
              <h3 className="text-lg font-semibold mb-2">Ready to Analyze</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                Click "Start Analysis" to process {images.length} image{images.length !== 1 ? 's' : ''} and extract:
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <TextAa size={20} className="text-accent" />
                  <span>Text & metadata</span>
                </div>
                <div className="flex items-center gap-2">
                  <Barcode size={20} className="text-accent" />
                  <span>Catalog numbers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Record size={20} className="text-accent" />
                  <span>Label information</span>
                </div>
                <div className="flex items-center gap-2">
                  <FilmStrip size={20} className="text-accent" />
                  <span>Condition defects</span>
                </div>
              </div>
              {renderAnalysisErrors('mt-6 w-full max-w-2xl text-left')}
            </div>
          ) : isAnalyzing ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <div className="w-full max-w-md space-y-6">
                <div className="flex items-center justify-center">
                  <Sparkle size={48} weight="fill" className="text-accent animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{currentStep}</span>
                    <span className="font-mono text-accent">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Analyzing images with OpenAI vision models...
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-6 py-4">
                {renderAnalysisErrors()}
                {Array.from(results.entries()).map(([imageId, analysis]) => {
                  const image = images.find(img => img.id === imageId)
                  if (!image) return null

                  const confidenceBadge = getConfidenceBadge(analysis.confidence)

                  return (
                    <Card key={imageId} className="p-6">
                      <div className="flex gap-4 mb-4">
                        <img 
                          src={image.dataUrl} 
                          alt={image.type}
                          className="w-32 h-32 object-cover rounded-lg border border-border"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-lg">
                              {IMAGE_TYPE_LABELS[analysis.imageType]}
                            </h3>
                            <Badge variant={confidenceBadge.variant} className="flex items-center gap-1">
                              {confidenceBadge.icon}
                              {confidenceBadge.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Confidence:</span>
                            <span className={`font-mono font-semibold ${getConfidenceColor(analysis.confidence)}`}>
                              {(analysis.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          {analysis.uncertainties && analysis.uncertainties.length > 0 && (
                            <Alert>
                              <Warning size={16} />
                              <AlertDescription className="text-xs">
                                {analysis.uncertainties.join(', ')}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>

                      {Object.keys(analysis.extractedMetadata).length > 0 && (
                        <>
                          <Separator className="my-4" />
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              <TextAa size={18} className="text-accent" />
                              Extracted Metadata
                            </h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {analysis.extractedMetadata.artistName && (
                                <div>
                                  <span className="text-muted-foreground">Artist:</span>
                                  <p className="font-medium">{analysis.extractedMetadata.artistName}</p>
                                </div>
                              )}
                              {analysis.extractedMetadata.title && (
                                <div>
                                  <span className="text-muted-foreground">Title:</span>
                                  <p className="font-medium">{analysis.extractedMetadata.title}</p>
                                </div>
                              )}
                              {analysis.extractedMetadata.catalogNumber && (
                                <div>
                                  <span className="text-muted-foreground">Catalog Number:</span>
                                  <p className="font-mono font-medium">{analysis.extractedMetadata.catalogNumber}</p>
                                </div>
                              )}
                              {analysis.extractedMetadata.labelName && (
                                <div>
                                  <span className="text-muted-foreground">Label:</span>
                                  <p className="font-medium">{analysis.extractedMetadata.labelName}</p>
                                </div>
                              )}
                              {analysis.extractedMetadata.barcode && (
                                <div>
                                  <span className="text-muted-foreground">Barcode:</span>
                                  <p className="font-mono text-xs">{analysis.extractedMetadata.barcode}</p>
                                </div>
                              )}
                              {analysis.extractedMetadata.matrixRunoutText && (
                                <div>
                                  <span className="text-muted-foreground">Matrix/Runout:</span>
                                  <p className="font-mono text-xs">{analysis.extractedMetadata.matrixRunoutText}</p>
                                </div>
                              )}
                              {analysis.extractedMetadata.sideMarker && (
                                <div>
                                  <span className="text-muted-foreground">Side:</span>
                                  <p className="font-medium">{analysis.extractedMetadata.sideMarker}</p>
                                </div>
                              )}
                            </div>
                            {analysis.extractedMetadata.editionClues && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {analysis.extractedMetadata.editionClues.stereo && (
                                  <Badge variant="outline">STEREO</Badge>
                                )}
                                {analysis.extractedMetadata.editionClues.mono && (
                                  <Badge variant="outline">MONO</Badge>
                                )}
                                {analysis.extractedMetadata.editionClues.promo && (
                                  <Badge variant="outline">PROMO</Badge>
                                )}
                                {analysis.extractedMetadata.editionClues.testPressing && (
                                  <Badge variant="outline">TEST PRESSING</Badge>
                                )}
                                {analysis.extractedMetadata.editionClues.originalPressing && (
                                  <Badge variant="outline">ORIGINAL PRESSING</Badge>
                                )}
                                {analysis.extractedMetadata.editionClues.reissue && (
                                  <Badge variant="outline">REISSUE</Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {analysis.conditionDefects.length > 0 && (
                        <>
                          <Separator className="my-4" />
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              <Warning size={18} className="text-accent" />
                              Condition Issues ({analysis.conditionDefects.length})
                            </h4>
                            <div className="space-y-2">
                              {analysis.conditionDefects.map((defect, idx) => (
                                <div 
                                  key={idx} 
                                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                                >
                                  <span className="text-2xl">{DEFECT_ICONS[defect.type]}</span>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm capitalize">
                                        {defect.type.replace(/_/g, ' ')}
                                      </span>
                                      <Badge 
                                        variant={defect.severity === 'minor' ? 'secondary' : defect.severity === 'moderate' ? 'outline' : 'destructive'}
                                        className="text-xs"
                                      >
                                        {defect.severity}
                                      </Badge>
                                      <span className={`text-xs font-mono ${getConfidenceColor(defect.confidence)}`}>
                                        {(defect.confidence * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {defect.description}
                                    </p>
                                    {defect.location && (
                                      <p className="text-xs text-muted-foreground italic">
                                        Location: {defect.location}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {analysis.notes.length > 0 && (
                        <>
                          <Separator className="my-4" />
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              <Info size={18} className="text-accent" />
                              Analysis Notes
                            </h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {analysis.notes.map((note, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <CheckCircle size={16} className="text-accent mt-0.5 flex-shrink-0" />
                                  <span>{note}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </>
                      )}

                      {analysis.rawAIOutput && (
                        <div className="mt-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowRawOutput(showRawOutput === imageId ? null : imageId)}
                            className="gap-2"
                          >
                            <FilmStrip size={16} />
                            {showRawOutput === imageId ? 'Hide' : 'Show'} Raw Output
                          </Button>
                          {showRawOutput === imageId && (
                            <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-48">
                              {analysis.rawAIOutput}
                            </pre>
                          )}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="gap-2">
          {!isAnalyzing && results.size === 0 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleAnalyze} className="gap-2">
                <Sparkle size={18} weight="fill" />
                Start Analysis
              </Button>
            </>
          ) : !isAnalyzing && results.size > 0 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleApplyResults} className="gap-2">
                <CheckCircle size={18} weight="fill" />
                Apply Results
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
