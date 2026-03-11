import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { CollectionItem, Format, MediaGrade, SleeveGrade, SourceType, ItemStatus, STATUS_LABELS, FORMAT_LABELS, GRADE_DESCRIPTIONS, ItemImage } from '@/lib/types'
import { formatCurrency, formatDate, getGradeColor, generatePriceEstimate } from '@/lib/helpers'
import { Pencil, Trash, Info, ChartBar, Calendar, MapPin, Package, CurrencyDollar, Record, Eye, Sparkle } from '@phosphor-icons/react'
import { ConditionGradingDialog } from '@/components/ConditionGradingDialog'
import { suggestGradingNotes } from '@/lib/condition-grading-ai'
import { toast } from 'sonner'

interface ItemDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CollectionItem
  onUpdate: (item: CollectionItem) => void
  onDelete: (itemId: string) => void
}

export function ItemDetailDialog({ open, onOpenChange, item, onUpdate, onDelete }: ItemDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [conditionGradingDialogOpen, setConditionGradingDialogOpen] = useState(false)
  const [formData, setFormData] = useState(item)

  const estimate = generatePriceEstimate(item)
  
  const existingImages: ItemImage[] = item.images 
    ? item.images.map((dataUrl, idx) => ({
        id: `existing-${idx}`,
        itemId: item.id,
        type: 'front_cover' as const,
        dataUrl,
        mimeType: 'image/jpeg',
        uploadedAt: item.createdAt
      }))
    : []

  const handleSave = () => {
    const updatedItem: CollectionItem = {
      ...formData,
      updatedAt: new Date().toISOString(),
    }
    onUpdate(updatedItem)
    setIsEditing(false)
    toast.success('Item updated successfully')
  }

  const handleCancel = () => {
    setFormData(item)
    setIsEditing(false)
  }

  const handleDelete = () => {
    onDelete(item.id)
    setDeleteDialogOpen(false)
    onOpenChange(false)
    toast.success('Item deleted from collection')
  }
  
  const handleConditionGraded = async (result: any, gradedImages: ItemImage[]) => {
    const newFormData: any = { ...formData }
    
    if (result.mediaGrade) {
      newFormData.condition = {
        ...newFormData.condition,
        mediaGrade: result.mediaGrade,
        gradedAt: new Date().toISOString()
      }
    }
    if (result.sleeveGrade) {
      newFormData.condition = {
        ...newFormData.condition,
        sleeveGrade: result.sleeveGrade,
        gradedAt: new Date().toISOString()
      }
    }

    if (result.defects.length > 0) {
      const generatedNotes = await suggestGradingNotes(result.defects)
      newFormData.condition.gradingNotes = formData.condition.gradingNotes 
        ? `${formData.condition.gradingNotes}\n\nAI Grading Update: ${generatedNotes}`
        : generatedNotes
    }
    
    if (gradedImages.length > 0) {
      newFormData.images = gradedImages.map(img => img.dataUrl)
    }

    setFormData(newFormData)
    toast.success('Condition grades applied from AI analysis')
  }

  const handleDialogOpenChange = (newOpen: boolean) => {
    if (!newOpen && isEditing) {
      handleCancel()
    }
    onOpenChange(newOpen)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-2xl mb-2">
                  {item.artistName} - {item.releaseTitle}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap gap-2 items-center">
                  <Badge variant="secondary">{FORMAT_LABELS[item.format]}</Badge>
                  <span>•</span>
                  <span>{item.year}</span>
                  <span>•</span>
                  <span>{item.country}</span>
                  {item.catalogNumber && (
                    <>
                      <span>•</span>
                      <Badge variant="outline" className="font-mono">{item.catalogNumber}</Badge>
                    </>
                  )}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                {!isEditing ? (
                  <>
                    <Button variant="outline" size="icon" onClick={() => setIsEditing(true)}>
                      <Pencil size={18} />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setDeleteDialogOpen(true)}>
                      <Trash size={18} className="text-destructive" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">
                <Info size={16} className="mr-2" />
                Details
              </TabsTrigger>
              <TabsTrigger value="condition">
                <Eye size={16} className="mr-2" />
                Condition
              </TabsTrigger>
              <TabsTrigger value="valuation">
                <ChartBar size={16} className="mr-2" />
                Valuation
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-6">
              {!isEditing ? (
                <div className="grid grid-cols-2 gap-6">
                  <Card className="p-4 space-y-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Status</div>
                      <Badge>{STATUS_LABELS[item.status]}</Badge>
                    </div>
                    <Separator />
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Format</div>
                      <div className="font-semibold">{FORMAT_LABELS[item.format]}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Year</div>
                      <div className="font-semibold">{item.year}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Country</div>
                      <div className="font-semibold">{item.country}</div>
                    </div>
                    {item.catalogNumber && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Catalog Number</div>
                        <div className="font-semibold font-mono">{item.catalogNumber}</div>
                      </div>
                    )}
                  </Card>

                  <Card className="p-4 space-y-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                        <Calendar size={14} />
                        Acquisition Date
                      </div>
                      <div className="font-semibold">
                        {item.acquisitionDate ? formatDate(item.acquisitionDate) : 'Not recorded'}
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                        <CurrencyDollar size={14} />
                        Purchase Price
                      </div>
                      <div className="font-semibold">
                        {item.purchasePrice ? formatCurrency(item.purchasePrice, item.purchaseCurrency) : 'Not recorded'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                        <Package size={14} />
                        Source
                      </div>
                      <div className="font-semibold capitalize">{item.sourceType.replace('_', ' ')}</div>
                    </div>
                    {item.storageLocation && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                          <MapPin size={14} />
                          Storage Location
                        </div>
                        <div className="font-semibold">{item.storageLocation}</div>
                      </div>
                    )}
                  </Card>

                  {item.notes && (
                    <Card className="p-4 col-span-2">
                      <div className="text-xs text-muted-foreground mb-2">Notes</div>
                      <div className="text-sm whitespace-pre-wrap">{item.notes}</div>
                    </Card>
                  )}

                  {item.images && item.images.length > 0 && (
                    <Card className="p-4 col-span-2">
                      <div className="text-xs text-muted-foreground mb-3">Images ({item.images.length})</div>
                      <div className="grid grid-cols-6 gap-2">
                        {item.images.map((img, idx) => (
                          <div key={idx} className="aspect-square bg-muted rounded overflow-hidden border border-border">
                            <img src={img} alt={`Item ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: ItemStatus) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owned">In Collection</SelectItem>
                        <SelectItem value="for_sale">For Sale</SelectItem>
                        <SelectItem value="sold">Sold</SelectItem>
                        <SelectItem value="traded">Traded</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
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
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || item.year })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="catalogNumber">Catalog Number</Label>
                    <Input
                      id="catalogNumber"
                      className="font-mono"
                      value={formData.catalogNumber || ''}
                      onChange={(e) => setFormData({ ...formData, catalogNumber: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="acquisitionDate">Acquisition Date</Label>
                    <Input
                      id="acquisitionDate"
                      type="date"
                      value={formData.acquisitionDate || ''}
                      onChange={(e) => setFormData({ ...formData, acquisitionDate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="purchasePrice">Purchase Price</Label>
                    <Input
                      id="purchasePrice"
                      type="number"
                      step="0.01"
                      value={formData.purchasePrice || ''}
                      onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value ? parseFloat(e.target.value) : undefined })}
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
                      value={formData.storageLocation || ''}
                      onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
                      placeholder="Shelf A-1"
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={4}
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="condition" className="space-y-6 mt-6">
              {!isEditing ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-6">
                      <div className="flex items-center gap-4 mb-4">
                        <Record size={32} className="text-muted-foreground" />
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Media Grade</div>
                          <div className={`text-3xl font-bold font-mono ${getGradeColor(item.condition.mediaGrade)}`}>
                            {item.condition.mediaGrade}
                          </div>
                        </div>
                      </div>
                      <Separator className="mb-3" />
                      <div className="text-sm text-muted-foreground">
                        {GRADE_DESCRIPTIONS[item.condition.mediaGrade]}
                      </div>
                    </Card>

                    <Card className="p-6">
                      <div className="flex items-center gap-4 mb-4">
                        <Package size={32} className="text-muted-foreground" />
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Sleeve Grade</div>
                          <div className={`text-3xl font-bold font-mono ${getGradeColor(item.condition.sleeveGrade)}`}>
                            {item.condition.sleeveGrade}
                          </div>
                        </div>
                      </div>
                      <Separator className="mb-3" />
                      <div className="text-sm text-muted-foreground">
                        {GRADE_DESCRIPTIONS[item.condition.sleeveGrade]}
                      </div>
                    </Card>
                  </div>

                  <Card className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Grading Standard</div>
                        <div className="font-semibold">{item.condition.gradingStandard}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Graded At</div>
                        <div className="font-semibold">{formatDate(item.condition.gradedAt)}</div>
                      </div>
                      {item.condition.gradingNotes && (
                        <div className="col-span-2">
                          <div className="text-xs text-muted-foreground mb-1">Grading Notes</div>
                          <div className="text-sm whitespace-pre-wrap">{item.condition.gradingNotes}</div>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConditionGradingDialogOpen(true)}
                      className="gap-2"
                    >
                      <Sparkle size={18} />
                      AI Grade Condition
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mediaGrade">Media Grade</Label>
                      <Select
                        value={formData.condition.mediaGrade}
                        onValueChange={(value: MediaGrade) =>
                          setFormData({
                            ...formData,
                            condition: { ...formData.condition, mediaGrade: value },
                          })
                        }
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
                        value={formData.condition.sleeveGrade}
                        onValueChange={(value: SleeveGrade) =>
                          setFormData({
                            ...formData,
                            condition: { ...formData.condition, sleeveGrade: value },
                          })
                        }
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

                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="gradingNotes">Grading Notes</Label>
                      <Textarea
                        id="gradingNotes"
                        value={formData.condition.gradingNotes || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            condition: { ...formData.condition, gradingNotes: e.target.value },
                          })
                        }
                        rows={4}
                        placeholder="Detailed condition notes..."
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="valuation" className="space-y-6 mt-6">
              <Card className="p-6 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
                <div className="text-center mb-6">
                  <div className="text-sm text-muted-foreground mb-2">Estimated Current Value</div>
                  <div className="text-5xl font-bold text-accent">
                    {formatCurrency(estimate.estimateMid, item.purchaseCurrency)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    Range: {formatCurrency(estimate.estimateLow, item.purchaseCurrency)} - {formatCurrency(estimate.estimateHigh, item.purchaseCurrency)}
                  </div>
                </div>

                <Separator className="mb-6" />

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center p-4 bg-card rounded-lg border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Confidence Score</div>
                    <div className="text-2xl font-bold">{Math.round(estimate.confidenceScore * 100)}%</div>
                  </div>
                  <div className="text-center p-4 bg-card rounded-lg border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Comparable Sales</div>
                    <div className="text-2xl font-bold">{estimate.comparableSales}</div>
                  </div>
                </div>

                {item.purchasePrice && (
                  <div className="p-4 bg-card rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-muted-foreground">Purchase Price</div>
                      <div className="font-semibold">{formatCurrency(item.purchasePrice, item.purchaseCurrency)}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">Estimated Gain/Loss</div>
                      <div className={`font-bold ${estimate.estimateMid > item.purchasePrice ? 'text-green-500' : 'text-red-500'}`}>
                        {estimate.estimateMid > item.purchasePrice ? '+' : ''}
                        {formatCurrency(estimate.estimateMid - item.purchasePrice, item.purchaseCurrency)}
                        {' '}
                        ({((estimate.estimateMid / item.purchasePrice - 1) * 100).toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {estimate.drivers && (
                <Card className="p-4">
                  <div className="text-sm font-semibold mb-4">Value Drivers</div>
                  <div className="space-y-3">
                    {estimate.drivers.map((driver, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1 text-sm">
                          <span>{driver.name}</span>
                          <span className="font-mono text-muted-foreground">{Math.round(driver.impact * 100)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent"
                            style={{ width: `${driver.impact * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          <div className="text-xs text-muted-foreground text-center pt-4">
            Added {formatDate(item.createdAt)} • Last updated {formatDate(item.updatedAt)}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{item.artistName} - {item.releaseTitle}" from your collection? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <ConditionGradingDialog
        open={conditionGradingDialogOpen}
        onOpenChange={setConditionGradingDialogOpen}
        onApply={handleConditionGraded}
        existingImages={existingImages}
      />
    </>
  )
}
