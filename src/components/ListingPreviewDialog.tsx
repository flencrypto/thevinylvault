import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Copy, Check, Storefront } from '@phosphor-icons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ItemImage, MediaGrade, SleeveGrade, Format, ItemStatus, SourceType } from '@/lib/types'
import { generateEbayListingPackage, EbayListingPackage } from '@/lib/listing-ai'
import EbayListingDialog from './EbayListingDialog'

interface ListingPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  listingContent: {
    title: string
    description: string
    highlights: string[]
    conditionSummary: string
    suggestedPrice: number
  }
  recordDetails: {
    artistName: string
    releaseTitle: string
    year: number
    country: string
    format: string
    catalogNumber?: string
  }
  conditionDetails: {
    mediaGrade: MediaGrade
    sleeveGrade: SleeveGrade
  }
  images: ItemImage[]
  onReset?: () => void
}

export function ListingPreviewDialog({
  open,
  onOpenChange,
  listingContent,
  recordDetails,
  conditionDetails,
  images,
  onReset
}: ListingPreviewDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [ebayListingPackage, setEbayListingPackage] = useState<EbayListingPackage | null>(null)
  const [showEbayDialog, setShowEbayDialog] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentImages, setCurrentImages] = useState<ItemImage[]>(images)

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    toast.success(`${fieldName} copied to clipboard`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleGenerateEbayListing = async () => {
    setIsGenerating(true)
    
    try {
      const itemForListing = {
        id: `temp-${Date.now()}`,
        collectionId: 'temp',
        artistName: recordDetails.artistName,
        releaseTitle: recordDetails.releaseTitle,
        format: recordDetails.format as Format,
        year: recordDetails.year,
        country: recordDetails.country,
        catalogNumber: recordDetails.catalogNumber,
        purchaseCurrency: 'USD',
        sourceType: 'unknown' as SourceType,
        quantity: 1,
        status: 'owned' as ItemStatus,
        condition: {
          mediaGrade: conditionDetails.mediaGrade,
          sleeveGrade: conditionDetails.sleeveGrade,
          gradingStandard: 'Goldmine' as 'Goldmine' | 'RecordCollector',
          gradingNotes: listingContent.conditionSummary,
          gradedAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const ebayPackage = await generateEbayListingPackage(itemForListing, currentImages)
      setEbayListingPackage(ebayPackage)
      setShowEbayDialog(true)
      
      toast.success('eBay listing generated!', {
        description: ebayPackage.requiresImgBBUpload 
          ? `${ebayPackage.missingImageCount} images need to be uploaded` 
          : 'All images ready for eBay'
      })
    } catch (error) {
      console.error('Failed to generate eBay listing:', error)
      toast.error('Failed to generate eBay listing')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleImagesUploaded = async (uploadedImages: ItemImage[]) => {
    setCurrentImages((prev) => {
      const imageMap = new Map(uploadedImages.map(img => [img.id, img]))
      return prev.map(img => imageMap.get(img.id) || img)
    })

    if (ebayListingPackage) {
      const itemForListing = {
        id: `temp-${Date.now()}`,
        collectionId: 'temp',
        artistName: recordDetails.artistName,
        releaseTitle: recordDetails.releaseTitle,
        format: recordDetails.format as Format,
        year: recordDetails.year,
        country: recordDetails.country,
        catalogNumber: recordDetails.catalogNumber,
        purchaseCurrency: 'USD',
        sourceType: 'unknown' as SourceType,
        quantity: 1,
        status: 'owned' as ItemStatus,
        condition: {
          mediaGrade: conditionDetails.mediaGrade,
          sleeveGrade: conditionDetails.sleeveGrade,
          gradingStandard: 'Goldmine' as 'Goldmine' | 'RecordCollector',
          gradingNotes: listingContent.conditionSummary,
          gradedAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const updatedImageList = currentImages.map(img => {
        const uploaded = uploadedImages.find(u => u.id === img.id)
        return uploaded || img
      })

      const updatedPackage = await generateEbayListingPackage(itemForListing, updatedImageList)
      setEbayListingPackage(updatedPackage)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Marketplace Listing Preview</DialogTitle>
          <DialogDescription>
            Review your AI-generated listing content before publishing
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-muted-foreground">LISTING TITLE</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(listingContent.title, 'Title')}
                  className="gap-2"
                >
                  {copiedField === 'Title' ? (
                    <>
                      <Check className="w-4 h-4" weight="bold" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <p className="text-lg font-semibold leading-tight">{listingContent.title}</p>
            </div>

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.slice(0, 6).map((image, idx) => (
                <div key={image.id} className="aspect-square bg-muted rounded-lg overflow-hidden">
                  <img
                    src={image.dataUrl}
                    alt={`${image.type} ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">RECORD DETAILS</h3>
              <div className="grid grid-cols-2 gap-4 bg-muted/30 rounded-lg p-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Artist</div>
                  <div className="font-semibold">{recordDetails.artistName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Title</div>
                  <div className="font-semibold">{recordDetails.releaseTitle}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Format</div>
                  <div className="font-semibold">{recordDetails.format}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Year</div>
                  <div className="font-semibold">{recordDetails.year}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Country</div>
                  <div className="font-semibold">{recordDetails.country}</div>
                </div>
                {recordDetails.catalogNumber && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Catalog #</div>
                    <div className="font-semibold font-mono text-sm">{recordDetails.catalogNumber}</div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">CONDITION</h3>
              <div className="flex gap-4 mb-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Media</div>
                  <Badge variant="outline" className="text-base px-3 py-1">
                    {conditionDetails.mediaGrade}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Sleeve</div>
                  <Badge variant="outline" className="text-base px-3 py-1">
                    {conditionDetails.sleeveGrade}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {listingContent.conditionSummary}
              </p>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-muted-foreground">DESCRIPTION</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(listingContent.description, 'Description')}
                  className="gap-2"
                >
                  {copiedField === 'Description' ? (
                    <>
                      <Check className="w-4 h-4" weight="bold" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {listingContent.description}
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">SUGGESTED PRICE</h3>
              <div className="text-4xl font-bold text-accent">
                ${listingContent.suggestedPrice.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Based on AI analysis of format, condition, and market data
              </p>
            </div>

            {listingContent.highlights.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-3">SEO KEYWORDS</h3>
                  <div className="flex flex-wrap gap-2">
                    {listingContent.highlights.map((keyword, idx) => (
                      <Badge key={idx} variant="secondary">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              onReset?.()
            }}
          >
            Create Another
          </Button>
          <Button 
            onClick={handleGenerateEbayListing}
            disabled={isGenerating}
            className="gap-2"
          >
            <Storefront className="w-4 h-4" weight="bold" />
            {isGenerating ? 'Generating...' : 'Generate eBay Listing'}
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>

      {showEbayDialog && ebayListingPackage && (
        <EbayListingDialog
          open={showEbayDialog}
          onOpenChange={setShowEbayDialog}
          listingPackage={ebayListingPackage}
          images={currentImages}
          onImagesUploaded={handleImagesUploaded}
        />
      )}
    </Dialog>
  )
}
