import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { useConfidenceThresholds } from '@/hooks/use-confidence-thresholds'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ImageUpload } from '@/components/ImageUpload'
import { ItemImage, Format, FORMAT_LABELS } from '@/lib/types'
import { analyzeVinylImage } from '@/lib/image-analysis-ai'
import { identifyPressing, ScoredPressingCandidate } from '@/lib/pressing-identification-ai'
import { Sparkle, CheckCircle, Warning, Info, X, Database, Lightning } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { DiscogsApiConfig } from '@/lib/marketplace-discogs'

interface PressingIdentificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect?: (pressing: ScoredPressingCandidate, images: ItemImage[]) => void
}

export function PressingIdentificationDialog({
  open,
  onOpenChange,
  onSelect,
}: PressingIdentificationDialogProps) {
  const [images, setImages] = useState<ItemImage[]>([])
  const [manualHints, setManualHints] = useState({
    artist: '',
    title: '',
    catalogNumber: '',
    country: '',
    year: '',
    format: '' as Format | '',
    labelName: '',
  })
  const [ocrRunoutValues, setOcrRunoutValues] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [candidates, setCandidates] = useState<ScoredPressingCandidate[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [autoMatchedCandidate, setAutoMatchedCandidate] = useState<ScoredPressingCandidate | null>(null)
  const [discogsEnabled, setDiscogsEnabled] = useState(true)
  const [apiKeys] = useKV<{ discogsUserToken?: string }>('vinyl-vault-api-keys', {})
  const { getThreshold, shouldAutoMatch } = useConfidenceThresholds()

  useEffect(() => {
    if (candidates.length > 0) {
      const topCandidate = candidates[0]
      if (shouldAutoMatch('pressingIdentification', topCandidate.confidence)) {
        setAutoMatchedCandidate(topCandidate)
        setSelectedCandidate(topCandidate.id)
        toast.success('Auto-matched pressing!', {
          description: `${topCandidate.artistName} - ${topCandidate.releaseTitle} (${Math.round(topCandidate.confidence * 100)}% confidence)`,
          duration: 5000,
        })
      } else {
        setAutoMatchedCandidate(null)
      }
    }
  }, [candidates, shouldAutoMatch])

  const handleAddImage = (image: ItemImage) => {
    setImages(prev => [...prev, image])
  }

  const handleRemoveImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId))
  }

  const handleIdentifyPressing = async () => {
    if (images.length === 0 && !manualHints.artist && !manualHints.catalogNumber) {
      toast.error('Please upload at least one image or provide manual hints')
      return
    }

    setIsAnalyzing(true)
    setAnalysisProgress(10)
    setCandidates([])
    setSelectedCandidate(null)

    try {
      const imageAnalysis = []
      
      if (images.length > 0) {
        setAnalysisProgress(20)
        for (const [index, image] of images.entries()) {
          const analysis = await analyzeVinylImage(image.dataUrl, image.type)
          imageAnalysis.push(analysis)
          setAnalysisProgress(20 + (index + 1) / images.length * 30)
        }
      }

      setAnalysisProgress(60)

      const runoutValues = ocrRunoutValues
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0)

      const hints = {
        artist: manualHints.artist || undefined,
        title: manualHints.title || undefined,
        catalogNumber: manualHints.catalogNumber || undefined,
        country: manualHints.country || undefined,
        year: manualHints.year ? parseInt(manualHints.year) : undefined,
        format: manualHints.format || undefined,
        labelName: manualHints.labelName || undefined,
      }

      setAnalysisProgress(70)

      const results = await identifyPressing({
        imageAnalysis: imageAnalysis.length > 0 ? imageAnalysis : undefined,
        ocrRunoutValues: runoutValues.length > 0 ? runoutValues : undefined,
        manualHints: hints,
        discogsSearchEnabled: discogsEnabled,
        discogsApiToken: apiKeys?.discogsUserToken,
      })

      setAnalysisProgress(100)
      setCandidates(results)

      if (results.length === 0) {
        toast.error('No pressing candidates found', {
          description: 'Try adding more images or manual hints'
        })
      } else {
        toast.success(`Found ${results.length} pressing candidate${results.length > 1 ? 's' : ''}`)
      }
    } catch (error) {
      console.error('Identification failed:', error)
      toast.error('Pressing identification failed')
    } finally {
      setIsAnalyzing(false)
      setAnalysisProgress(0)
    }
  }

  const handleSelectCandidate = (candidateId: string) => {
    const candidate = candidates.find(c => c.id === candidateId)
    if (candidate && onSelect) {
      onSelect(candidate, images)
      onOpenChange(false)
      toast.success('Pressing selected')
    }
  }

  const handleReset = () => {
    setImages([])
    setManualHints({
      artist: '',
      title: '',
      catalogNumber: '',
      country: '',
      year: '',
      format: '',
      labelName: '',
    })
    setOcrRunoutValues('')
    setCandidates([])
    setSelectedCandidate(null)
    setAutoMatchedCandidate(null)
  }

  const handleNoneOfThese = () => {
    toast.info('No pressing selected', {
      description: 'You can manually enter pressing details instead'
    })
    onOpenChange(false)
  }

  const getConfidenceBadgeVariant = (band: string) => {
    switch (band) {
      case 'high':
        return 'default'
      case 'medium':
        return 'secondary'
      case 'low':
        return 'outline'
      case 'ambiguous':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getConfidenceIcon = (band: string) => {
    switch (band) {
      case 'high':
        return <CheckCircle size={16} weight="fill" />
      case 'medium':
        return <Info size={16} weight="fill" />
      case 'low':
      case 'ambiguous':
        return <Warning size={16} weight="fill" />
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkle size={24} weight="fill" className="text-accent" />
            Pressing Identification Engine
          </DialogTitle>
          <DialogDescription>
            Upload images, provide OCR runout values, and add manual hints to identify the specific pressing
          </DialogDescription>
        </DialogHeader>

        {autoMatchedCandidate && (
          <Alert className="bg-accent/10 border-accent">
            <Lightning size={20} weight="fill" className="text-accent" />
            <AlertDescription>
              <span className="font-semibold">Auto-matched!</span> Top candidate meets the {getThreshold('pressingIdentification')}% confidence threshold and has been pre-selected. You can review other candidates or adjust the threshold in Settings.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Image Upload</h3>
              <ImageUpload images={images} onImagesChange={setImages} maxImages={6} />
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3">OCR Runout Values</h3>
              <div className="space-y-2">
                <Label htmlFor="runout-values">Matrix/Runout Numbers</Label>
                <Input
                  id="runout-values"
                  placeholder="e.g., A1, B1, SHVL 804-A-1"
                  value={ocrRunoutValues}
                  onChange={(e) => setOcrRunoutValues(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Comma-separated values</p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3">Discogs Database Search</h3>
              <div className="flex items-center justify-between space-x-2">
                <div className="flex-1">
                  <Label htmlFor="discogs-toggle" className="flex items-center gap-2">
                    <Database size={16} />
                    Search Discogs database for accurate pressing data
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {apiKeys?.discogsUserToken 
                      ? 'Discogs API configured - real database searches enabled' 
                      : 'No API token configured - using AI-generated suggestions'}
                  </p>
                </div>
                <Switch
                  id="discogs-toggle"
                  checked={discogsEnabled}
                  onCheckedChange={setDiscogsEnabled}
                  disabled={!apiKeys?.discogsUserToken}
                />
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3">Manual Hints</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="artist-hint">Artist</Label>
                  <Input
                    id="artist-hint"
                    placeholder="e.g., David Bowie"
                    value={manualHints.artist}
                    onChange={(e) => setManualHints(prev => ({ ...prev, artist: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="title-hint">Title</Label>
                  <Input
                    id="title-hint"
                    placeholder="e.g., Low"
                    value={manualHints.title}
                    onChange={(e) => setManualHints(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="catalog-hint">Catalog Number</Label>
                    <Input
                      id="catalog-hint"
                      placeholder="e.g., PL 12030"
                      value={manualHints.catalogNumber}
                      onChange={(e) => setManualHints(prev => ({ ...prev, catalogNumber: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="year-hint">Year</Label>
                    <Input
                      id="year-hint"
                      type="number"
                      placeholder="e.g., 1977"
                      value={manualHints.year}
                      onChange={(e) => setManualHints(prev => ({ ...prev, year: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="country-hint">Country</Label>
                    <Input
                      id="country-hint"
                      placeholder="e.g., UK, US"
                      value={manualHints.country}
                      onChange={(e) => setManualHints(prev => ({ ...prev, country: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="format-hint">Format</Label>
                    <Select value={manualHints.format} onValueChange={(value) => setManualHints(prev => ({ ...prev, format: value as Format }))}>
                      <SelectTrigger id="format-hint">
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FORMAT_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="label-hint">Label Name</Label>
                  <Input
                    id="label-hint"
                    placeholder="e.g., RCA Victor"
                    value={manualHints.labelName}
                    onChange={(e) => setManualHints(prev => ({ ...prev, labelName: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleIdentifyPressing}
                disabled={isAnalyzing}
                className="flex-1 gap-2"
              >
                <Sparkle size={18} weight="fill" />
                {isAnalyzing ? 'Analyzing...' : 'Identify Pressing'}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
            </div>

            {isAnalyzing && (
              <div className="space-y-2">
                <Progress value={analysisProgress} />
                <p className="text-sm text-muted-foreground text-center">
                  Analyzing images and matching candidates...
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Ranked Candidates</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1 text-xs">
                  <Lightning size={14} />
                  Auto-match: {getThreshold('pressingIdentification')}%+
                </Badge>
                {candidates.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleNoneOfThese}>
                    None of these
                  </Button>
                )}
              </div>
            </div>

            {candidates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Info size={48} className="mx-auto mb-3 opacity-50" weight="thin" />
                <p>No candidates yet</p>
                <p className="text-sm mt-1">Upload images or provide hints to identify pressings</p>
              </div>
            ) : (
              <div className="space-y-3">
                {candidates.map((candidate, index) => (
                  <Card
                    key={candidate.id}
                    className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedCandidate === candidate.id ? 'ring-2 ring-accent' : ''
                    }`}
                    onClick={() => setSelectedCandidate(candidate.id)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-mono">
                              #{index + 1}
                            </Badge>
                            <Badge variant={getConfidenceBadgeVariant(candidate.confidenceBand)} className="gap-1">
                              {getConfidenceIcon(candidate.confidenceBand)}
                              {candidate.confidenceBand}
                            </Badge>
                            <span className="text-sm text-muted-foreground font-mono">
                              {Math.round(candidate.confidence * 100)}%
                            </span>
                          </div>
                          <h4 className="font-semibold">{candidate.pressingName}</h4>
                          <p className="text-sm text-muted-foreground">
                            {candidate.artistName} - {candidate.releaseTitle}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Year:</span>{' '}
                          <span className="font-medium">{candidate.year}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Country:</span>{' '}
                          <span className="font-medium">{candidate.country}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Format:</span>{' '}
                          <span className="font-medium">{FORMAT_LABELS[candidate.format]}</span>
                        </div>
                        {candidate.catalogNumber && (
                          <div>
                            <span className="text-muted-foreground">Cat#:</span>{' '}
                            <span className="font-medium font-mono">{candidate.catalogNumber}</span>
                          </div>
                        )}
                      </div>

                      {candidate.evidenceSnippets && candidate.evidenceSnippets.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Evidence</p>
                          <ul className="space-y-1">
                            {candidate.evidenceSnippets.slice(0, 3).map((evidence, idx) => (
                              <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                                <span className="text-accent">•</span>
                                <span>{evidence}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {candidate.matchedIdentifiers && candidate.matchedIdentifiers.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {candidate.matchedIdentifiers.map((identifier, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs font-mono">
                              {identifier}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {selectedCandidate === candidate.id && (
                        <Button
                          onClick={() => handleSelectCandidate(candidate.id)}
                          className="w-full gap-2"
                        >
                          <CheckCircle size={18} weight="fill" />
                          Select This Pressing
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
