import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ItemImage, MediaGrade, SleeveGrade } from '@/lib/types'
import { ImageUpload } from '@/components/ImageUpload'
import { analyzeConditionFromImages } from '@/lib/condition-grading-ai'
import { Sparkle, CheckCircle, Warning, Eye, Record, Package } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface ConditionResult {
  mediaGrade?: MediaGrade
  sleeveGrade?: SleeveGrade
  defects: Array<{
    type: 'media' | 'sleeve'
    severity: 'minor' | 'moderate' | 'major'
    description: string
    location?: string
  }>
  confidence: number
  reasoning: string
}

interface ConditionGradingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (result: ConditionResult, images: ItemImage[]) => void
  existingImages?: ItemImage[]
}

export function ConditionGradingDialog({
  open,
  onOpenChange,
  onApply,
  existingImages = []
}: ConditionGradingDialogProps) {
  const [images, setImages] = useState<ItemImage[]>(existingImages)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ConditionResult | null>(null)

  const handleAnalyze = async () => {
    if (images.length === 0) {
      toast.error('Please upload at least one image')
      return
    }

    setIsAnalyzing(true)
    setProgress(0)
    setResult(null)

    try {
      setProgress(20)
      toast.info('Analyzing images for condition grading...')

      const analysisResult = await analyzeConditionFromImages(images)
      
      setProgress(100)
      setResult(analysisResult)

      if (analysisResult.confidence > 0.6) {
        toast.success('Condition analysis complete')
      } else {
        toast.warning('Low confidence analysis. Consider adding clearer images.')
      }
    } catch (error) {
      console.error('Condition analysis failed:', error)
      toast.error('Analysis failed. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleApply = () => {
    if (!result) return
    onApply(result, images)
    handleReset()
    onOpenChange(false)
  }

  const handleReset = () => {
    setImages(existingImages)
    setResult(null)
    setProgress(0)
  }

  const getGradeColor = (grade?: string) => {
    if (!grade) return 'bg-muted'
    if (['M', 'NM'].includes(grade)) return 'bg-green-500/20 text-green-500 border-green-500/30'
    if (['EX', 'VG+'].includes(grade)) return 'bg-blue-500/20 text-blue-500 border-blue-500/30'
    if (['VG', 'G'].includes(grade)) return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
    return 'bg-red-500/20 text-red-500 border-red-500/30'
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'minor': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'moderate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'major': return 'bg-red-500/20 text-red-400 border-red-500/30'
      default: return 'bg-muted'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.75) return 'text-green-500'
    if (confidence >= 0.5) return 'text-yellow-500'
    return 'text-orange-500'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye size={24} weight="fill" className="text-accent" />
            AI Condition Grading & Defect Detection
          </DialogTitle>
          <DialogDescription>
            Upload clear photos of your vinyl and sleeve for automated condition assessment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3">Upload Condition Photos</h3>
            <ImageUpload images={images} onImagesChange={setImages} maxImages={8} />
            <p className="text-xs text-muted-foreground mt-2">
              For best results: Include close-ups of the media surface, labels, and sleeve (front, back, spine). Ensure good lighting and focus.
            </p>
          </div>

          {isAnalyzing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Analyzing condition...</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <Separator />
              
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle size={18} className="text-accent" />
                  Analysis Results
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Record size={24} className="text-muted-foreground" />
                      <div>
                        <div className="text-xs text-muted-foreground">Media Grade</div>
                        <div className={`text-2xl font-bold font-mono ${result.mediaGrade ? '' : 'text-muted-foreground'}`}>
                          {result.mediaGrade || 'N/A'}
                        </div>
                      </div>
                    </div>
                    {result.mediaGrade && (
                      <Badge variant="outline" className={`${getGradeColor(result.mediaGrade)}`}>
                        {result.mediaGrade === 'M' && 'Mint'}
                        {result.mediaGrade === 'NM' && 'Near Mint'}
                        {result.mediaGrade === 'EX' && 'Excellent'}
                        {result.mediaGrade === 'VG+' && 'Very Good Plus'}
                        {result.mediaGrade === 'VG' && 'Very Good'}
                        {result.mediaGrade === 'G' && 'Good'}
                        {result.mediaGrade === 'F' && 'Fair'}
                        {result.mediaGrade === 'P' && 'Poor'}
                      </Badge>
                    )}
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Package size={24} className="text-muted-foreground" />
                      <div>
                        <div className="text-xs text-muted-foreground">Sleeve Grade</div>
                        <div className={`text-2xl font-bold font-mono ${result.sleeveGrade ? '' : 'text-muted-foreground'}`}>
                          {result.sleeveGrade || 'N/A'}
                        </div>
                      </div>
                    </div>
                    {result.sleeveGrade && (
                      <Badge variant="outline" className={`${getGradeColor(result.sleeveGrade)}`}>
                        {result.sleeveGrade === 'M' && 'Mint'}
                        {result.sleeveGrade === 'NM' && 'Near Mint'}
                        {result.sleeveGrade === 'EX' && 'Excellent'}
                        {result.sleeveGrade === 'VG+' && 'Very Good Plus'}
                        {result.sleeveGrade === 'VG' && 'Very Good'}
                        {result.sleeveGrade === 'G' && 'Good'}
                        {result.sleeveGrade === 'F' && 'Fair'}
                        {result.sleeveGrade === 'P' && 'Poor'}
                      </Badge>
                    )}
                  </Card>
                </div>

                <div className="bg-card border border-border rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Confidence Score</h4>
                    <span className={`text-xl font-bold font-mono ${getConfidenceColor(result.confidence)}`}>
                      {Math.round(result.confidence * 100)}%
                    </span>
                  </div>
                  <Progress value={result.confidence * 100} className="mb-2" />
                  <p className="text-xs text-muted-foreground">{result.reasoning}</p>
                </div>

                {result.defects.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Detected Defects ({result.defects.length})</h4>
                    <div className="space-y-2">
                      {result.defects.map((defect, idx) => (
                        <Card key={idx} className="p-3">
                          <div className="flex items-start gap-3">
                            <Badge 
                              variant="outline" 
                              className={`mt-0.5 ${getSeverityColor(defect.severity)}`}
                            >
                              {defect.severity}
                            </Badge>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="text-xs">
                                  {defect.type === 'media' ? 'Media' : 'Sleeve'}
                                </Badge>
                                {defect.location && (
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {defect.location}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm">{defect.description}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {result.defects.length === 0 && (
                  <Alert>
                    <CheckCircle size={16} className="text-green-500" />
                    <AlertDescription>
                      No significant defects detected in the analyzed images.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleReset()
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <div className="flex gap-3">
              {!result ? (
                <Button
                  onClick={handleAnalyze}
                  disabled={images.length === 0 || isAnalyzing}
                  className="gap-2"
                >
                  <Sparkle size={18} />
                  Analyze Condition
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleReset}>
                    Start Over
                  </Button>
                  <Button
                    onClick={handleApply}
                    className="gap-2"
                  >
                    Apply Grades
                    <CheckCircle size={18} />
                  </Button>
                </>
              )}
            </div>
          </div>

          {result && (
            <Alert variant="default" className="bg-muted/50">
              <Warning size={16} className="text-yellow-500" />
              <AlertDescription className="text-xs">
                AI grading is a helpful assessment tool but should not replace expert manual grading. Always verify grades against Goldmine standards and your own inspection.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
