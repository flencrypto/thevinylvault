import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ImageUpload } from '@/components/ImageUpload'
import { BatchPhotoCaptureDialog } from '@/components/BatchPhotoCaptureDialog'
import BatchRecordUploadDialog from '@/components/BatchRecordUploadDialog'
import BarcodeScannerWidget, { BarcodeScanResult } from '@/components/BarcodeScannerWidget'
import { ItemImage, Format, MediaGrade, SleeveGrade } from '@/lib/types'
import {
  Upload,
  Sparkle,
  Trophy,
  CheckCircle,
  Warning,
  Info,
  Image as ImageIcon,
  CircleNotch,
  Disc,
  Plus,
  ChartLine,
  Stack,
  Files
} from '@phosphor-icons/react'
import { analyzeVinylImage } from '@/lib/image-analysis-ai'
import { identifyPressing } from '@/lib/pressing-identification-ai'
import { analyzeConditionFromImages, suggestGradingNotes } from '@/lib/condition-grading-ai'
import { generateListingCopy, generateSEOKeywords, suggestListingPrice } from '@/lib/listing-ai'
import { generatePriceEstimate } from '@/lib/helpers'
import { toast } from 'sonner'
import { ListingPreviewDialog } from './ListingPreviewDialog'
import DynamicPricingDialog from './DynamicPricingDialog'
import ABTestingDialog from './ABTestingDialog'
import { CollectionItem } from '@/lib/types'
import { ABTest } from '@/lib/ab-testing-types'
import { useKV } from '@github/spark/hooks'
import { AutoPricingRecommendation } from '@/lib/dynamic-pricing-ai'

const LISTING_DRAFT_KEY = 'vinyl-vault-listing-draft'

type AnalysisStep = 'idle' | 'analyzing_images' | 'identifying_pressing' | 'grading_condition' | 'generating_listing' | 'complete'

interface AnalysisResult {
  artistName: string
  releaseTitle: string
  year: number
  country: string
  format: Format
  catalogNumber?: string
  pressingSuggestions?: string[]
  confidence: number
}

interface ConditionResult {
  mediaGrade: MediaGrade
  sleeveGrade: SleeveGrade
  gradingNotes: string
  aiConfidence: number
}

interface ListingContent {
  title: string
  description: string
  highlights: string[]
  conditionSummary: string
  suggestedPrice: number
}

interface ManualData {
  artistName: string
  releaseTitle: string
  year: number
  country: string
  format: Format
  catalogNumber: string
  mediaGrade: MediaGrade
  sleeveGrade: SleeveGrade
  notes: string
}

interface ListingDraft {
  images: ItemImage[]
  analysisStep: AnalysisStep
  analysisResult: AnalysisResult | null
  conditionResult: ConditionResult | null
  listingContent: ListingContent | null
  manualOverride: boolean
  manualData: ManualData
  savedAt: string
}

const DEFAULT_MANUAL_DATA: ManualData = {
  artistName: '',
  releaseTitle: '',
  year: new Date().getFullYear(),
  country: '',
  format: 'LP' as Format,
  catalogNumber: '',
  mediaGrade: 'VG+' as MediaGrade,
  sleeveGrade: 'VG+' as SleeveGrade,
  notes: ''
}

/** Returns true when any manual-form field has been changed from the blank default. */
function hasManualData(data: ManualData | undefined): boolean {
  if (!data) return false
  return (
    !!data.artistName ||
    !!data.releaseTitle ||
    !!data.catalogNumber ||
    !!data.country ||
    !!data.notes ||
    data.year !== DEFAULT_MANUAL_DATA.year ||
    data.format !== DEFAULT_MANUAL_DATA.format ||
    data.mediaGrade !== DEFAULT_MANUAL_DATA.mediaGrade ||
    data.sleeveGrade !== DEFAULT_MANUAL_DATA.sleeveGrade
  )
}

function loadListingDraft(): ListingDraft | null {
  try {
    const saved = localStorage.getItem(LISTING_DRAFT_KEY)
    if (!saved) return null
    const draft = JSON.parse(saved) as ListingDraft
    // Only restore if there is meaningful data to recover
    if (!draft.images?.length && !draft.analysisResult && !hasManualData(draft.manualData)) return null
    return draft
  } catch {
    return null
  }
}

function saveListingDraft(draft: Omit<ListingDraft, 'savedAt'>) {
  const payload: ListingDraft = { ...draft, savedAt: new Date().toISOString() }
  try {
    localStorage.setItem(LISTING_DRAFT_KEY, JSON.stringify(payload))
  } catch {
    // Quota exceeded — retry without image data so at least metadata is saved
    try {
      localStorage.setItem(LISTING_DRAFT_KEY, JSON.stringify({ ...payload, images: [] }))
    } catch {
      // Storage fully unavailable — silently ignore
    }
  }
}

function clearListingDraft() {
  try {
    localStorage.removeItem(LISTING_DRAFT_KEY)
  } catch {
    // Ignore
  }
}

export default function NewListingView() {
  const [, setItems] = useKV<CollectionItem[]>('vinyl-vault-collection', [])
  const [abTests] = useKV<ABTest[]>('vinyl-vault-ab-tests', [])
  const [autoOptimize] = useKV<boolean>('vinyl-vault-auto-optimize-titles', false)
  
  const [images, setImages] = useState<ItemImage[]>([])
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [conditionResult, setConditionResult] = useState<ConditionResult | null>(null)
  const [listingContent, setListingContent] = useState<ListingContent | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showPricingDialog, setShowPricingDialog] = useState(false)
  const [showABTestDialog, setShowABTestDialog] = useState(false)
  const [showBatchCapture, setShowBatchCapture] = useState(false)
  const [showBatchUpload, setShowBatchUpload] = useState(false)
  const [pricingRecommendation, setPricingRecommendation] = useState<AutoPricingRecommendation | null>(null)
  const [usedPatternOptimization, setUsedPatternOptimization] = useState(false)
  
  const [manualOverride, setManualOverride] = useState(false)
  const [manualData, setManualData] = useState<ManualData>(DEFAULT_MANUAL_DATA)

  // Track whether this is the initial mount so the draft-save effect doesn't
  // immediately overwrite the draft with blank state before we've had a chance
  // to restore it.
  const draftRestoredRef = useRef(false)

  // Restore draft on mount
  useEffect(() => {
    const draft = loadListingDraft()
    if (draft) {
      if (draft.images?.length) setImages(draft.images)
      if (draft.analysisStep && draft.analysisStep !== 'idle') setAnalysisStep(draft.analysisStep)
      if (draft.analysisResult) setAnalysisResult(draft.analysisResult)
      if (draft.conditionResult) setConditionResult(draft.conditionResult)
      if (draft.listingContent) setListingContent(draft.listingContent)
      if (draft.manualOverride !== undefined) setManualOverride(draft.manualOverride)
      if (draft.manualData) setManualData(draft.manualData)
      toast.info('Draft restored', {
        description: `Saved ${new Date(draft.savedAt).toLocaleTimeString()}`
      })
    }
    draftRestoredRef.current = true
  }, [])

  // Persist draft whenever relevant state changes (skip the very first render
  // before the restore effect has run).
  useEffect(() => {
    if (!draftRestoredRef.current) return
    if (images.length === 0 && analysisStep === 'idle' && !analysisResult && !hasManualData(manualData)) {
      clearListingDraft()
      return
    }
    saveListingDraft({ images, analysisStep, analysisResult, conditionResult, listingContent, manualOverride, manualData })
  }, [images, analysisStep, analysisResult, conditionResult, listingContent, manualOverride, manualData])

  const handleAnalyze = async () => {
    if (images.length === 0) {
      toast.error('Please upload at least one image')
      return
    }

    try {
      setAnalysisStep('analyzing_images')
      const imageAnalysisResults = await Promise.all(
        images.map(img => analyzeVinylImage(img.dataUrl, img.type))
      )
      
      setAnalysisStep('identifying_pressing')
      const [pressingCandidates, conditionAnalysis] = await Promise.all([
        identifyPressing({
          imageAnalysis: imageAnalysisResults,
          discogsSearchEnabled: false
        }),
        analyzeConditionFromImages(images),
      ])
      
      const bestCandidate = pressingCandidates[0]
      
      if (!bestCandidate) {
        throw new Error('No pressing candidates found')
      }
      
      setAnalysisResult({
        artistName: bestCandidate.artistName || 'Unknown Artist',
        releaseTitle: bestCandidate.releaseTitle || 'Unknown Release',
        year: bestCandidate.year || new Date().getFullYear(),
        country: bestCandidate.country || 'Unknown',
        format: bestCandidate.format || 'LP',
        catalogNumber: bestCandidate.catalogNumber,
        pressingSuggestions: bestCandidate.evidenceSnippets,
        confidence: bestCandidate.confidence
      })
      
      setAnalysisStep('grading_condition')
      const gradingNotes = await suggestGradingNotes(conditionAnalysis.defects)
      
      setConditionResult({
        mediaGrade: conditionAnalysis.mediaGrade || 'VG+',
        sleeveGrade: conditionAnalysis.sleeveGrade || 'VG',
        gradingNotes: gradingNotes,
        aiConfidence: conditionAnalysis.confidence
      })
      
      setAnalysisStep('generating_listing')
      
      const tempItem: CollectionItem = {
        id: `temp-${Date.now()}`,
        collectionId: 'temp',
        artistName: bestCandidate.artistName || 'Unknown Artist',
        releaseTitle: bestCandidate.releaseTitle || 'Unknown Release',
        format: bestCandidate.format || 'LP',
        year: bestCandidate.year || new Date().getFullYear(),
        country: bestCandidate.country || 'Unknown',
        catalogNumber: bestCandidate.catalogNumber,
        purchaseCurrency: 'USD',
        sourceType: 'unknown',
        quantity: 1,
        status: 'owned',
        condition: {
          mediaGrade: conditionAnalysis.mediaGrade || 'VG+',
          sleeveGrade: conditionAnalysis.sleeveGrade || 'VG',
          gradingStandard: 'Goldmine',
          gradingNotes: gradingNotes,
          gradedAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      const keywords = await generateSEOKeywords(tempItem, 'ebay')
      const listingCopy = await generateListingCopy(tempItem, 'ebay', keywords, {
        autoOptimizeEnabled: autoOptimize,
        completedABTests: (abTests || []).filter(t => t.status === 'completed')
      })
      const priceEstimate = generatePriceEstimate(tempItem)
      const suggestedPrice = suggestListingPrice(priceEstimate, tempItem.condition.mediaGrade)
      
      setListingContent({
        title: listingCopy.title,
        description: listingCopy.description,
        highlights: keywords.slice(0, 5),
        conditionSummary: gradingNotes,
        suggestedPrice
      })
      
      setUsedPatternOptimization(listingCopy.usedPatternOptimization || false)
      
      if (listingCopy.usedPatternOptimization && autoOptimize) {
        toast.success('Title optimized using winning A/B test patterns!', {
          description: 'This title follows your best-performing patterns'
        })
      }
      
      setAnalysisStep('complete')
      
      toast.success('Analysis complete! Review the results below.')
    } catch (error) {
      console.error('Analysis failed:', error)
      toast.error('Analysis failed. Please try again or enter details manually.')
      setAnalysisStep('idle')
    }
  }

  const handleAddToCollection = () => {
    if (!analysisResult || !conditionResult) {
      toast.error('Complete analysis first')
      return
    }

    const newItem: CollectionItem = {
      id: `item-${Date.now()}`,
      collectionId: 'default',
      artistName: analysisResult.artistName,
      releaseTitle: analysisResult.releaseTitle,
      format: analysisResult.format,
      year: analysisResult.year,
      country: analysisResult.country,
      catalogNumber: analysisResult.catalogNumber,
      purchaseCurrency: 'USD',
      sourceType: 'unknown',
      quantity: 1,
      status: 'owned',
      condition: {
        mediaGrade: conditionResult.mediaGrade,
        sleeveGrade: conditionResult.sleeveGrade,
        gradingStandard: 'Goldmine',
        gradingNotes: conditionResult.gradingNotes,
        gradedAt: new Date().toISOString()
      },
      images: images.map(img => img.dataUrl),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setItems((current) => [newItem, ...(current || [])])
    clearListingDraft()
    setShowPreview(true)
  }

  const handleReset = () => {
    clearListingDraft()
    setImages([])
    setAnalysisStep('idle')
    setAnalysisResult(null)
    setConditionResult(null)
    setListingContent(null)
    setManualOverride(false)
    setManualData(DEFAULT_MANUAL_DATA)
    setShowPreview(false)
    setPricingRecommendation(null)
    toast.success('Ready for new listing')
  }

  const handlePriceAccept = (price: number, recommendation: AutoPricingRecommendation) => {
    setPricingRecommendation(recommendation)
    setListingContent(prev => prev ? { ...prev, suggestedPrice: price } : null)
  }

  const handleOpenPricingDialog = () => {
    if (!analysisResult || !conditionResult) {
      toast.error('Complete analysis first to get pricing recommendations')
      return
    }
    setShowPricingDialog(true)
  }

  const isAnalyzing = !['idle', 'complete'].includes(analysisStep)
  const hasResults = analysisStep === 'complete'

  const handleBarcodeScanned = (result: BarcodeScanResult) => {
    setManualData({
      artistName: result.artist,
      releaseTitle: result.title,
      year: result.year,
      country: result.country,
      format: result.format as Format,
      catalogNumber: result.catalogNumber || '',
      mediaGrade: 'VG+',
      sleeveGrade: 'VG+',
      notes: `Scanned via barcode: ${result.barcode}`
    })
    setManualOverride(true)
    toast.success(`Pre-filled with: ${result.artist} - ${result.title}`)
  }

  return (
    <div className="p-6 space-y-6 relative">
      <BarcodeScannerWidget variant="fab" onScanComplete={handleBarcodeScanned} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Upload className="w-7 h-7" weight="bold" />
            New Listing
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload photos for AI-powered record identification and listing creation
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowBatchUpload(true)}
            className="gap-2"
          >
            <Files size={18} weight="fill" />
            Batch Upload
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowBatchCapture(true)}
            className="gap-2"
          >
            <Stack size={18} weight="fill" />
            Bulk Capture
          </Button>
          {hasResults && (
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <Plus className="w-5 h-5" />
              Start New
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Upload Photos
              </h3>
              {images.length > 0 && (
                <Badge variant="secondary">{images.length} image{images.length !== 1 ? 's' : ''}</Badge>
              )}
            </div>
            
            <ImageUpload images={images} onImagesChange={setImages} maxImages={10} />

            {images.length > 0 && !hasResults && (
              <div className="mt-6">
                <Button 
                  onClick={handleAnalyze} 
                  disabled={isAnalyzing}
                  className="w-full gap-2"
                  size="lg"
                >
                  {isAnalyzing ? (
                    <>
                      <CircleNotch className="w-5 h-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkle className="w-5 h-5" weight="fill" />
                      Analyze with AI
                    </>
                  )}
                </Button>
              </div>
            )}
          </Card>

          {isAnalyzing && (
            <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CircleNotch className="w-5 h-5 animate-spin text-primary" />
                AI Analysis in Progress
              </h3>
              <div className="space-y-3">
                <AnalysisStepIndicator 
                  label="Analyzing images"
                  status={analysisStep === 'analyzing_images' ? 'active' : analysisStep !== 'idle' ? 'complete' : 'pending'}
                />
                <AnalysisStepIndicator 
                  label="Identifying pressing"
                  status={analysisStep === 'identifying_pressing' ? 'active' : ['grading_condition', 'generating_listing', 'complete'].includes(analysisStep) ? 'complete' : 'pending'}
                />
                <AnalysisStepIndicator 
                  label="Grading condition"
                  status={analysisStep === 'grading_condition' ? 'active' : ['generating_listing', 'complete'].includes(analysisStep) ? 'complete' : 'pending'}
                />
                <AnalysisStepIndicator 
                  label="Generating listing"
                  status={analysisStep === 'generating_listing' ? 'active' : analysisStep === 'complete' ? 'complete' : 'pending'}
                />
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {hasResults && analysisResult && conditionResult && listingContent && (
            <>
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Disc className="w-5 h-5" />
                    Record Details
                  </h3>
                  <ConfidenceBadge confidence={analysisResult.confidence} />
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Artist</Label>
                    <p className="font-semibold text-lg">{analysisResult.artistName}</p>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Release Title</Label>
                    <p className="font-semibold text-lg">{analysisResult.releaseTitle}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Year</Label>
                      <p className="font-semibold">{analysisResult.year}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Country</Label>
                      <p className="font-semibold">{analysisResult.country}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Format</Label>
                      <p className="font-semibold">{analysisResult.format}</p>
                    </div>
                    {analysisResult.catalogNumber && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Catalog #</Label>
                        <p className="font-semibold font-mono text-sm">{analysisResult.catalogNumber}</p>
                      </div>
                    )}
                  </div>

                  {analysisResult.pressingSuggestions && analysisResult.pressingSuggestions.length > 0 && (
                    <div className="pt-2">
                      <Label className="text-xs text-muted-foreground mb-2 block">Pressing Notes</Label>
                      <div className="text-sm space-y-1">
                        {analysisResult.pressingSuggestions.map((suggestion, idx) => (
                          <p key={idx} className="text-muted-foreground">• {suggestion}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Condition Grading</h3>
                  <ConfidenceBadge confidence={conditionResult.aiConfidence} />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Media Grade</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className="text-lg px-4 py-1">
                        {conditionResult.mediaGrade}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Sleeve Grade</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className="text-lg px-4 py-1">
                        {conditionResult.sleeveGrade}
                      </Badge>
                    </div>
                  </div>
                </div>

                {conditionResult.gradingNotes && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Grading Notes</Label>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {conditionResult.gradingNotes}
                    </p>
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Marketplace Listing</h3>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs text-muted-foreground">Listing Title</Label>
                      <div className="flex items-center gap-2">
                        {usedPatternOptimization && (
                          <Badge variant="secondary" className="gap-1 bg-accent/10 text-accent border-accent/20">
                            <Trophy size={12} weight="fill" />
                            Pattern Optimized
                          </Badge>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setShowABTestDialog(true)}
                          className="gap-1 h-7 text-xs"
                        >
                          <Sparkle className="w-3 h-3" weight="fill" />
                          A/B Test
                        </Button>
                      </div>
                    </div>
                    <p className="font-semibold">{listingContent.title}</p>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Description Preview</Label>
                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-4 max-h-40 overflow-y-auto">
                      {listingContent.description.slice(0, 200)}...
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs text-muted-foreground">Suggested Price</Label>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={handleOpenPricingDialog}
                        className="gap-2 h-7 text-xs"
                      >
                        <ChartLine className="w-3 h-3" weight="bold" />
                        AI Pricing
                      </Button>
                    </div>
                    <p className="text-2xl font-bold text-accent">
                      ${listingContent.suggestedPrice.toFixed(2)}
                    </p>
                    {pricingRecommendation && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Based on {pricingRecommendation.strategy.strategy.replace('_', ' ')} strategy • 
                        {' '}{Math.round(pricingRecommendation.confidence * 100)}% confidence
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <div className="flex gap-3">
                <Button 
                  onClick={handleAddToCollection}
                  className="flex-1 gap-2"
                  size="lg"
                >
                  <CheckCircle className="w-5 h-5" weight="fill" />
                  Add to Collection
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowPreview(true)}
                  className="flex-1 gap-2"
                  size="lg"
                >
                  View Full Listing
                </Button>
              </div>
            </>
          )}

          {!hasResults && !isAnalyzing && images.length === 0 && (
            <Card className="p-12 text-center border-dashed">
              <Disc size={64} className="mx-auto mb-4 text-muted-foreground opacity-50" weight="thin" />
              <h3 className="text-xl font-semibold mb-2">Get Started</h3>
              <p className="text-muted-foreground mb-4">
                Upload photos of your vinyl record to begin AI analysis
              </p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>📸 Front and back cover</p>
                <p>🏷️ Record labels</p>
                <p>🔍 Runout/matrix numbers</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {showPreview && analysisResult && conditionResult && listingContent && (
        <ListingPreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          listingContent={listingContent}
          recordDetails={analysisResult}
          conditionDetails={conditionResult}
          images={images}
          onReset={handleReset}
        />
      )}

      {showPricingDialog && analysisResult && conditionResult && (
        <DynamicPricingDialog
          open={showPricingDialog}
          onOpenChange={setShowPricingDialog}
          item={{
            id: `temp-${Date.now()}`,
            collectionId: 'temp',
            artistName: analysisResult.artistName,
            releaseTitle: analysisResult.releaseTitle,
            format: analysisResult.format,
            year: analysisResult.year,
            country: analysisResult.country,
            catalogNumber: analysisResult.catalogNumber,
            purchaseCurrency: 'USD',
            sourceType: 'unknown',
            quantity: 1,
            status: 'owned',
            condition: {
              mediaGrade: conditionResult.mediaGrade,
              sleeveGrade: conditionResult.sleeveGrade,
              gradingStandard: 'Goldmine',
              gradingNotes: conditionResult.gradingNotes,
              gradedAt: new Date().toISOString()
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }}
          onPriceAccept={handlePriceAccept}
        />
      )}

      {showABTestDialog && analysisResult && conditionResult && (
        <ABTestingDialog
          open={showABTestDialog}
          onOpenChange={setShowABTestDialog}
          item={{
            id: `temp-${Date.now()}`,
            collectionId: 'temp',
            artistName: analysisResult.artistName,
            releaseTitle: analysisResult.releaseTitle,
            format: analysisResult.format,
            year: analysisResult.year,
            country: analysisResult.country,
            catalogNumber: analysisResult.catalogNumber,
            purchaseCurrency: 'USD',
            sourceType: 'unknown',
            quantity: 1,
            status: 'owned',
            condition: {
              mediaGrade: conditionResult.mediaGrade,
              sleeveGrade: conditionResult.sleeveGrade,
              gradingStandard: 'Goldmine',
              gradingNotes: conditionResult.gradingNotes,
              gradedAt: new Date().toISOString()
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }}
          channel="ebay"
          onSelectTitle={(title) => {
            setListingContent(prev => prev ? { ...prev, title } : null)
          }}
        />
      )}

      <BatchPhotoCaptureDialog
        open={showBatchCapture}
        onOpenChange={setShowBatchCapture}
      />

      <BatchRecordUploadDialog
        open={showBatchUpload}
        onOpenChange={setShowBatchUpload}
      />
    </div>
  )
}

function AnalysisStepIndicator({ label, status }: { label: string; status: 'pending' | 'active' | 'complete' }) {
  return (
    <div className="flex items-center gap-3">
      {status === 'pending' && (
        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
      )}
      {status === 'active' && (
        <CircleNotch className="w-5 h-5 text-primary animate-spin" weight="bold" />
      )}
      {status === 'complete' && (
        <CheckCircle className="w-5 h-5 text-accent" weight="fill" />
      )}
      <span className={status === 'active' ? 'font-semibold' : status === 'complete' ? 'text-muted-foreground' : 'text-muted-foreground/60'}>
        {label}
      </span>
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const getColor = () => {
    if (confidence >= 0.8) return 'default'
    if (confidence >= 0.6) return 'secondary'
    return 'outline'
  }

  const getIcon = () => {
    if (confidence >= 0.8) return <CheckCircle className="w-3 h-3" weight="fill" />
    if (confidence >= 0.6) return <Info className="w-3 h-3" weight="fill" />
    return <Warning className="w-3 h-3" weight="fill" />
  }

  return (
    <Badge variant={getColor()} className="gap-1">
      {getIcon()}
      {Math.round(confidence * 100)}% confidence
    </Badge>
  )
}
