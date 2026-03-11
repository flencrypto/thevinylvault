import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CollectionItem } from '@/lib/types'
import { generateMarketplaceDescription } from '@/lib/export-descriptions-ai'
import { formatCurrency } from '@/lib/helpers'
import { 
  Export, 
  Sparkle, 
  CheckCircle, 
  Copy, 
  FileText,
  Download,
  List
} from '@phosphor-icons/react'
import { toast } from 'sonner'

interface ExportGradedItemsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CollectionItem[]
}

type ExportFormat = 'csv' | 'json' | 'text'
type DescriptionStyle = 'professional' | 'casual' | 'technical' | 'enthusiast'

interface GeneratedDescription {
  itemId: string
  title: string
  description: string
  conditionSummary: string
  highlights: string[]
  seoKeywords: string[]
}

export function ExportGradedItemsDialog({
  open,
  onOpenChange,
  items
}: ExportGradedItemsDialogProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [isGenerating, setIsGenerating] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('text')
  const [descriptionStyle, setDescriptionStyle] = useState<DescriptionStyle>('professional')
  const [generatedDescriptions, setGeneratedDescriptions] = useState<Map<string, GeneratedDescription>>(new Map())
  const [currentTab, setCurrentTab] = useState<'select' | 'preview'>('select')

  const gradedItems = useMemo(() => {
    return items.filter(item => 
      item.condition?.mediaGrade && 
      item.condition?.sleeveGrade
    )
  }, [items])

  const handleToggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedItems.size === gradedItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(gradedItems.map(item => item.id)))
    }
  }

  const handleGenerateDescriptions = async () => {
    if (selectedItems.size === 0) {
      toast.error('Please select at least one item')
      return
    }

    setIsGenerating(true)
    const newDescriptions = new Map<string, GeneratedDescription>()

    try {
      const selectedItemsArray = gradedItems.filter(item => selectedItems.has(item.id))
      
      for (const item of selectedItemsArray) {
        const description = await generateMarketplaceDescription(item, descriptionStyle)
        newDescriptions.set(item.id, description)
      }

      setGeneratedDescriptions(newDescriptions)
      setCurrentTab('preview')
      toast.success(`Generated ${newDescriptions.size} marketplace descriptions`)
    } catch (error) {
      console.error('Failed to generate descriptions:', error)
      toast.error('Failed to generate descriptions. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyDescription = (description: GeneratedDescription) => {
    const formattedText = `${description.title}

${description.conditionSummary}

${description.description}

Key Highlights:
${description.highlights.map(h => `• ${h}`).join('\n')}

Keywords: ${description.seoKeywords.join(', ')}`

    navigator.clipboard.writeText(formattedText)
    toast.success('Description copied to clipboard')
  }

  const handleExport = () => {
    if (generatedDescriptions.size === 0) {
      toast.error('No descriptions generated yet')
      return
    }

    let exportContent = ''
    const exportData = Array.from(generatedDescriptions.values())

    switch (exportFormat) {
      case 'csv': {
        const headers = ['Title', 'Condition', 'Description', 'Highlights', 'Keywords']
        const rows = exportData.map(desc => [
          desc.title,
          desc.conditionSummary,
          desc.description.replace(/"/g, '""'),
          desc.highlights.join('; '),
          desc.seoKeywords.join('; ')
        ])
        
        exportContent = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n')
        break
      }

      case 'json': {
        exportContent = JSON.stringify(exportData, null, 2)
        break
      }

      case 'text': {
        exportContent = exportData.map(desc => {
          return `
===========================================
${desc.title}
===========================================

CONDITION: ${desc.conditionSummary}

DESCRIPTION:
${desc.description}

KEY HIGHLIGHTS:
${desc.highlights.map(h => `• ${h}`).join('\n')}

SEO KEYWORDS: ${desc.seoKeywords.join(', ')}

===========================================
`
        }).join('\n\n')
        break
      }
    }

    const blob = new Blob([exportContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vinyl-export-${Date.now()}.${exportFormat === 'text' ? 'txt' : exportFormat}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Export downloaded successfully')
  }

  const handleCopyAll = () => {
    const allText = Array.from(generatedDescriptions.values()).map(desc => {
      return `${desc.title}

${desc.conditionSummary}

${desc.description}

Key Highlights:
${desc.highlights.map(h => `• ${h}`).join('\n')}

Keywords: ${desc.seoKeywords.join(', ')}`
    }).join('\n\n---\n\n')

    navigator.clipboard.writeText(allText)
    toast.success('All descriptions copied to clipboard')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Export size={24} weight="fill" className="text-accent" />
            Export Graded Items
          </DialogTitle>
          <DialogDescription>
            Generate professional marketplace-ready descriptions for your graded vinyl records
          </DialogDescription>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as 'select' | 'preview')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="select">
              <List className="w-4 h-4 mr-2" />
              Select Items ({selectedItems.size})
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={generatedDescriptions.size === 0}>
              <FileText className="w-4 h-4 mr-2" />
              Preview & Export ({generatedDescriptions.size})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="space-y-4">
            {gradedItems.length === 0 ? (
              <Card className="p-12 text-center border-dashed">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-xl font-semibold mb-2">No Graded Items</h3>
                <p className="text-muted-foreground">
                  You need to grade items before exporting. Use AI condition grading or manually grade items in your collection.
                </p>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                    >
                      {selectedItems.size === gradedItems.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {selectedItems.size} of {gradedItems.length} items selected
                    </span>
                  </div>

                  <Select value={descriptionStyle} onValueChange={(v: DescriptionStyle) => setDescriptionStyle(v)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual & Friendly</SelectItem>
                      <SelectItem value="technical">Technical Detail</SelectItem>
                      <SelectItem value="enthusiast">Collector Enthusiast</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {gradedItems.map(item => (
                    <Card
                      key={item.id}
                      className={`p-4 cursor-pointer transition-all ${
                        selectedItems.has(item.id) 
                          ? 'border-accent bg-accent/5' 
                          : 'hover:border-muted-foreground/30'
                      }`}
                      onClick={() => handleToggleItem(item.id)}
                    >
                      <div className="flex items-start gap-4">
                        <Checkbox
                          checked={selectedItems.has(item.id)}
                          onCheckedChange={() => handleToggleItem(item.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold truncate">{item.artistName}</h4>
                              <p className="text-sm text-muted-foreground truncate">{item.releaseTitle}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Badge variant="outline" className="font-mono">
                                {item.condition.mediaGrade}
                              </Badge>
                              <Badge variant="outline" className="font-mono">
                                {item.condition.sleeveGrade}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{item.year}</span>
                            <span>•</span>
                            <span>{item.format}</span>
                            {item.catalogNumber && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{item.catalogNumber}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleGenerateDescriptions}
                    disabled={selectedItems.size === 0 || isGenerating}
                    className="gap-2"
                  >
                    <Sparkle size={18} />
                    {isGenerating ? 'Generating...' : `Generate ${selectedItems.size} Description${selectedItems.size !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="gap-1.5">
                  <CheckCircle size={14} />
                  {generatedDescriptions.size} Ready
                </Badge>
                <Select value={exportFormat} onValueChange={(v: ExportFormat) => setExportFormat(v)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text File</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyAll} className="gap-2">
                  <Copy size={16} />
                  Copy All
                </Button>
                <Button variant="default" size="sm" onClick={handleExport} className="gap-2">
                  <Download size={16} />
                  Export File
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {Array.from(generatedDescriptions.entries()).map(([itemId, description]) => {
                const item = gradedItems.find(i => i.id === itemId)
                if (!item) return null

                return (
                  <Card key={itemId} className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold mb-1">{description.title}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            Media: {item.condition.mediaGrade}
                          </Badge>
                          <Badge variant="outline" className="font-mono">
                            Sleeve: {item.condition.sleeveGrade}
                          </Badge>
                          {item.purchasePrice && (
                            <Badge variant="secondary">
                              Paid: {formatCurrency(item.purchasePrice)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyDescription(description)}
                        className="gap-2 shrink-0"
                      >
                        <Copy size={16} />
                        Copy
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                          Condition Summary
                        </div>
                        <div className="text-sm bg-muted/50 rounded-md p-3">
                          {description.conditionSummary}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                          Description
                        </div>
                        <Textarea
                          value={description.description}
                          readOnly
                          className="min-h-[120px] resize-none text-sm"
                        />
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                          Key Highlights
                        </div>
                        <div className="space-y-1">
                          {description.highlights.map((highlight, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm">
                              <CheckCircle size={16} className="text-accent mt-0.5 shrink-0" />
                              <span>{highlight}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                          SEO Keywords
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {description.seoKeywords.map((keyword, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setCurrentTab('select')}>
                Back to Selection
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
