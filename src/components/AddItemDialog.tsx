import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { CollectionItem, Format, MediaGrade, SleeveGrade, SourceType, PressingCandidate, ItemImage } from '@/lib/types'
import { ImageUpload } from '@/components/ImageUpload'
import { PressingIdentificationDialog } from '@/components/PressingIdentificationDialog'
import { ConditionGradingDialog } from '@/components/ConditionGradingDialog'
import { ImageAnalysisDialog } from '@/components/ImageAnalysisDialog'
import { suggestGradingNotes } from '@/lib/condition-grading-ai'
import { generateListingNotes, ImageAnalysisOutput } from '@/lib/openai-vision-service'
import { Sparkle, Eye, ScanSmiley } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface AddItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (item: CollectionItem) => void
}

export function AddItemDialog({ open, onOpenChange, onAdd }: AddItemDialogProps) {
  const [formData, setFormData] = useState({
    artistName: '',
    releaseTitle: '',
    year: new Date().getFullYear(),
    country: 'UK',
    format: 'LP' as Format,
    catalogNumber: '',
    mediaGrade: 'VG+' as MediaGrade,
    sleeveGrade: 'VG+' as SleeveGrade,
    purchasePrice: '',
    acquisitionDate: new Date().toISOString().split('T')[0],
    sourceType: 'shop' as SourceType,
    storageLocation: '',
    notes: '',
  })
  
  const [images, setImages] = useState<ItemImage[]>([])
  const [identificationDialogOpen, setIdentificationDialogOpen] = useState(false)
  const [conditionGradingDialogOpen, setConditionGradingDialogOpen] = useState(false)
  const [imageAnalysisDialogOpen, setImageAnalysisDialogOpen] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.artistName || !formData.releaseTitle) {
      toast.error('Please fill in artist and title')
      return
    }

    const imageDataUrls = images.length > 0 ? images.map(img => img.dataUrl) : undefined

    const newItem: CollectionItem = {
      id: `item-${Date.now()}`,
      collectionId: 'default',
      artistName: formData.artistName,
      releaseTitle: formData.releaseTitle,
      year: formData.year,
      country: formData.country,
      format: formData.format,
      catalogNumber: formData.catalogNumber || undefined,
      acquisitionDate: formData.acquisitionDate,
      purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : undefined,
      purchaseCurrency: 'GBP',
      sourceType: formData.sourceType,
      quantity: 1,
      storageLocation: formData.storageLocation || undefined,
      status: 'owned',
      notes: formData.notes || undefined,
      condition: {
        mediaGrade: formData.mediaGrade,
        sleeveGrade: formData.sleeveGrade,
        gradingStandard: 'Goldmine',
        gradedAt: new Date().toISOString(),
      },
      images: imageDataUrls,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    onAdd(newItem)
    toast.success(`Added ${formData.artistName} - ${formData.releaseTitle}`)
    onOpenChange(false)
    
    setFormData({
      artistName: '',
      releaseTitle: '',
      year: new Date().getFullYear(),
      country: 'UK',
      format: 'LP',
      catalogNumber: '',
      mediaGrade: 'VG+',
      sleeveGrade: 'VG+',
      purchasePrice: '',
      acquisitionDate: new Date().toISOString().split('T')[0],
      sourceType: 'shop',
      storageLocation: '',
      notes: '',
    })
    setImages([])
  }

  const handlePressingIdentified = (candidate: PressingCandidate, identifiedImages: ItemImage[]) => {
    setFormData({
      ...formData,
      artistName: candidate.artistName,
      releaseTitle: candidate.releaseTitle,
      year: candidate.year,
      country: candidate.country,
      format: candidate.format,
      catalogNumber: candidate.catalogNumber || '',
    })
    setImages(identifiedImages)
    toast.success('Pressing details filled from AI identification')
  }

  const handleConditionGraded = async (result: any, gradedImages: ItemImage[]) => {
    const newFormData: any = { ...formData }
    
    if (result.mediaGrade) {
      newFormData.mediaGrade = result.mediaGrade
    }
    if (result.sleeveGrade) {
      newFormData.sleeveGrade = result.sleeveGrade
    }

    if (result.defects.length > 0) {
      const generatedNotes = await suggestGradingNotes(result.defects)
      newFormData.notes = formData.notes 
        ? `${formData.notes}\n\nAI Grading Notes: ${generatedNotes}`
        : `AI Grading Notes: ${generatedNotes}`
    }

    setFormData(newFormData)
    setImages(gradedImages)
    toast.success('Condition grades applied from AI analysis')
  }

  const handleImageAnalysisComplete = async (results: Map<string, ImageAnalysisOutput>) => {
    const allMetadata = Array.from(results.values())
    
    const artistNames = allMetadata.map(r => r.extractedMetadata.artistName).filter(Boolean) as string[]
    const titles = allMetadata.map(r => r.extractedMetadata.title).filter(Boolean) as string[]
    const catalogNumbers = allMetadata.map(r => r.extractedMetadata.catalogNumber).filter(Boolean) as string[]
    const allDefects = allMetadata.flatMap(r => r.conditionDefects)

    const newFormData = { ...formData }
    
    if (artistNames.length > 0 && !formData.artistName) {
      newFormData.artistName = artistNames[0]!
    }
    if (titles.length > 0 && !formData.releaseTitle) {
      newFormData.releaseTitle = titles[0]!
    }
    if (catalogNumbers.length > 0 && !formData.catalogNumber) {
      newFormData.catalogNumber = catalogNumbers[0]!
    }

    if (allDefects.length > 0) {
      const listingNotes = await generateListingNotes(allDefects, allMetadata[0].extractedMetadata)
      
      if (listingNotes.gradeSuggestion) {
        if (listingNotes.gradeSuggestion.media) {
          newFormData.mediaGrade = listingNotes.gradeSuggestion.media as MediaGrade
        }
        if (listingNotes.gradeSuggestion.sleeve) {
          newFormData.sleeveGrade = listingNotes.gradeSuggestion.sleeve as SleeveGrade
        }
      }

      const defectSummary = listingNotes.sellerNotes.join('. ')
      newFormData.notes = formData.notes 
        ? `${formData.notes}\n\nAI Analysis: ${defectSummary}`
        : `AI Analysis: ${defectSummary}`
    }

    setFormData(newFormData)
    toast.success('Image analysis complete - metadata and condition extracted')
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Item to Collection</DialogTitle>
            <DialogDescription>
              Enter the details of your vinyl record or use AI identification
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIdentificationDialogOpen(true)}
                className="gap-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground"
              >
                <Sparkle size={20} weight="fill" />
                Identify Pressing
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConditionGradingDialogOpen(true)}
                className="gap-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground"
              >
                <Eye size={20} weight="fill" />
                Grade Condition
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (images.length === 0) {
                    toast.error('Please upload images first')
                    return
                  }
                  setImageAnalysisDialogOpen(true)
                }}
                className="gap-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                disabled={images.length === 0}
              >
                <ScanSmiley size={20} weight="fill" />
                AI Image Analysis
              </Button>
            </div>

            <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="artistName">Artist *</Label>
              <Input
                id="artistName"
                value={formData.artistName}
                onChange={(e) => setFormData({ ...formData, artistName: e.target.value })}
                placeholder="David Bowie"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="releaseTitle">Title *</Label>
              <Input
                id="releaseTitle"
                value={formData.releaseTitle}
                onChange={(e) => setFormData({ ...formData, releaseTitle: e.target.value })}
                placeholder="Low"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <Select
                value={formData.format}
                onValueChange={(value: Format) => setFormData({ ...formData, format: value })}
              >
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LP">12" LP</SelectItem>
                  <SelectItem value="7in">7" Single</SelectItem>
                  <SelectItem value="12in">12" Single</SelectItem>
                  <SelectItem value="EP">EP</SelectItem>
                  <SelectItem value="Boxset">Box Set</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="UK"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="catalogNumber">Catalog Number</Label>
              <Input
                id="catalogNumber"
                className="font-mono"
                value={formData.catalogNumber}
                onChange={(e) => setFormData({ ...formData, catalogNumber: e.target.value })}
                placeholder="PL 12030"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mediaGrade">Media Grade</Label>
              <Select
                value={formData.mediaGrade}
                onValueChange={(value: MediaGrade) => setFormData({ ...formData, mediaGrade: value })}
              >
                <SelectTrigger id="mediaGrade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">M - Mint</SelectItem>
                  <SelectItem value="NM">NM - Near Mint</SelectItem>
                  <SelectItem value="EX">EX - Excellent</SelectItem>
                  <SelectItem value="VG+">VG+ - Very Good Plus</SelectItem>
                  <SelectItem value="VG">VG - Very Good</SelectItem>
                  <SelectItem value="G">G - Good</SelectItem>
                  <SelectItem value="F">F - Fair</SelectItem>
                  <SelectItem value="P">P - Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sleeveGrade">Sleeve Grade</Label>
              <Select
                value={formData.sleeveGrade}
                onValueChange={(value: SleeveGrade) => setFormData({ ...formData, sleeveGrade: value })}
              >
                <SelectTrigger id="sleeveGrade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">M - Mint</SelectItem>
                  <SelectItem value="NM">NM - Near Mint</SelectItem>
                  <SelectItem value="EX">EX - Excellent</SelectItem>
                  <SelectItem value="VG+">VG+ - Very Good Plus</SelectItem>
                  <SelectItem value="VG">VG - Very Good</SelectItem>
                  <SelectItem value="G">G - Good</SelectItem>
                  <SelectItem value="F">F - Fair</SelectItem>
                  <SelectItem value="P">P - Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchasePrice">Purchase Price (£)</Label>
              <Input
                id="purchasePrice"
                type="number"
                step="0.01"
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                placeholder="25.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="acquisitionDate">Acquisition Date</Label>
              <Input
                id="acquisitionDate"
                type="date"
                value={formData.acquisitionDate}
                onChange={(e) => setFormData({ ...formData, acquisitionDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceType">Source</Label>
              <Select
                value={formData.sourceType}
                onValueChange={(value: SourceType) => setFormData({ ...formData, sourceType: value })}
              >
                <SelectTrigger id="sourceType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shop">Record Shop</SelectItem>
                  <SelectItem value="ebay">eBay</SelectItem>
                  <SelectItem value="discogs">Discogs</SelectItem>
                  <SelectItem value="fair">Record Fair</SelectItem>
                  <SelectItem value="gift">Gift</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storageLocation">Storage Location</Label>
              <Input
                id="storageLocation"
                value={formData.storageLocation}
                onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
                placeholder="Shelf A-1"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this item..."
                rows={3}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Images</Label>
              <ImageUpload images={images} onImagesChange={setImages} maxImages={6} />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Add to Collection
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <PressingIdentificationDialog
      open={identificationDialogOpen}
      onOpenChange={setIdentificationDialogOpen}
      onSelect={handlePressingIdentified}
    />

    <ConditionGradingDialog
      open={conditionGradingDialogOpen}
      onOpenChange={setConditionGradingDialogOpen}
      onApply={handleConditionGraded}
      existingImages={images}
    />

    <ImageAnalysisDialog
      open={imageAnalysisDialogOpen}
      onOpenChange={setImageAnalysisDialogOpen}
      images={images}
      onAnalysisComplete={handleImageAnalysisComplete}
    />
  </>
  )
}
