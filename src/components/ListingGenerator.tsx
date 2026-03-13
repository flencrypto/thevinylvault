import { useState } from 'react'
import { CollectionItem, ListingDraft } from '@/lib/types'
import { ABTest } from '@/lib/ab-testing-types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sparkle, Copy, Check, MagicWand, ArrowsClockwise, Trophy } from '@phosphor-icons/react'
import { formatCurrency, generatePriceEstimate } from '@/lib/helpers'
import { generateListingCopy, generateSEOKeywords, suggestListingPrice } from '@/lib/listing-ai'
import TitlePatternOptimizerDialog from './TitlePatternOptimizerDialog'
import { toast } from 'sonner'
import { useKV } from '@github/spark/hooks'

interface ListingGeneratorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CollectionItem | null
  onSave: (draft: ListingDraft) => void
}

export function ListingGenerator({ open, onOpenChange, item, onSave }: ListingGeneratorProps) {
  const [abTests] = useKV<ABTest[]>('vinyl-vault-ab-tests', [])
  const [autoOptimize] = useKV<boolean>('vinyl-vault-auto-optimize-titles', false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [draft, setDraft] = useState<Partial<ListingDraft>>({})
  const [channel, setChannel] = useState<'ebay' | 'discogs' | 'shopify'>('ebay')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showPatternOptimizer, setShowPatternOptimizer] = useState(false)

  if (!item) return null

  const estimate = generatePriceEstimate(item)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setGenerationProgress(0)

    try {
      setGenerationProgress(20)
      await new Promise(resolve => setTimeout(resolve, 300))

      const keywords = await generateSEOKeywords(item, channel)
      setGenerationProgress(40)
      await new Promise(resolve => setTimeout(resolve, 300))

      const completedTests = (abTests || []).filter(t => t.status === 'completed')
      const { title, subtitle, description } = await generateListingCopy(item, channel, keywords, {
        usePatternOptimization: autoOptimize,
        completedABTests: completedTests,
      })
      setGenerationProgress(70)
      await new Promise(resolve => setTimeout(resolve, 300))

      const suggestedPrice = suggestListingPrice(estimate, item.condition.mediaGrade)
      setGenerationProgress(90)

      setDraft({
        title,
        subtitle,
        description,
        price: suggestedPrice,
        currency: item.purchaseCurrency,
        conditionSummary: `${item.condition.mediaGrade}/${item.condition.sleeveGrade}`,
        generatedByAi: true,
      })

      setGenerationProgress(100)
      toast.success('Listing copy generated successfully')
    } catch (error) {
      toast.error('Failed to generate listing copy')
      console.error(error)
    } finally {
      setTimeout(() => {
        setIsGenerating(false)
        setGenerationProgress(0)
      }, 500)
    }
  }

  const handleRegenerateField = async (field: 'title' | 'description') => {
    const keywords = await generateSEOKeywords(item, channel)
    
    if (field === 'title') {
      const { title } = await generateListingCopy(item, channel, keywords)
      setDraft({ ...draft, title })
      toast.success('Title regenerated')
    } else {
      const { description } = await generateListingCopy(item, channel, keywords)
      setDraft({ ...draft, description })
      toast.success('Description regenerated')
    }
  }

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    toast.success(`${fieldName} copied to clipboard`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleSave = () => {
    if (!draft.title || !draft.description || !draft.price) {
      toast.error('Please fill in all required fields')
      return
    }

    const completeDraft: ListingDraft = {
      id: crypto.randomUUID(),
      itemId: item.id,
      title: draft.title,
      subtitle: draft.subtitle,
      description: draft.description,
      price: draft.price,
      currency: draft.currency || item.purchaseCurrency,
      conditionSummary: draft.conditionSummary || `${item.condition.mediaGrade}/${item.condition.sleeveGrade}`,
      generatedByAi: draft.generatedByAi || false,
      createdAt: new Date().toISOString(),
    }

    onSave(completeDraft)
    onOpenChange(false)
    setDraft({})
    toast.success('Listing draft saved')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkle size={24} className="text-accent" weight="fill" />
            Generate Marketplace Listing
          </DialogTitle>
          <DialogDescription>
            AI-powered listing generator with SEO optimization for {item.artistName} - {item.releaseTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Marketplace Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ebay">eBay</SelectItem>
                  <SelectItem value="discogs">Discogs</SelectItem>
                  <SelectItem value="shopify">Shopify/Custom Store</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 flex items-end gap-2">
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating}
                className="flex-1 gap-2"
              >
                <MagicWand size={20} />
                {isGenerating ? 'Generating...' : 'Generate Listing Copy'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPatternOptimizer(true)}
                className="gap-2"
                title="View winning title patterns"
              >
                <Trophy size={20} weight="fill" />
              </Button>
            </div>
          </div>

          {autoOptimize && (abTests || []).filter(t => t.status === 'completed').length > 0 && (
            <Badge variant="secondary" className="gap-1.5">
              <Trophy size={14} weight="fill" />
              Auto-Optimization Enabled
            </Badge>
          )}

          {isGenerating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Generating optimized listing...</span>
                <span>{generationProgress}%</span>
              </div>
              <Progress value={generationProgress} />
            </div>
          )}

          {draft.title && (
            <Tabs defaultValue="edit" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="edit">Edit Listing</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Title</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerateField('title')}
                      >
                        <ArrowsClockwise size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(draft.title!, 'Title')}
                      >
                        {copiedField === 'Title' ? <Check size={16} /> : <Copy size={16} />}
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="Listing title"
                  />
                  <div className="text-xs text-muted-foreground">
                    {draft.title?.length || 0} / 80 characters (recommended)
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Subtitle (Optional)</Label>
                  <Input
                    value={draft.subtitle || ''}
                    onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                    placeholder="Additional details"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Price</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={draft.price}
                        onChange={(e) => setDraft({ ...draft, price: parseFloat(e.target.value) })}
                        placeholder="0.00"
                      />
                      <Select 
                        value={draft.currency} 
                        onValueChange={(v) => setDraft({ ...draft, currency: v })}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Est. range: {formatCurrency(estimate.estimateLow, estimate.currency)} - {formatCurrency(estimate.estimateHigh, estimate.currency)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Input
                      value={draft.conditionSummary}
                      onChange={(e) => setDraft({ ...draft, conditionSummary: e.target.value })}
                      placeholder="Media/Sleeve grade"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Description</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerateField('description')}
                      >
                        <ArrowsClockwise size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(draft.description!, 'Description')}
                      >
                        {copiedField === 'Description' ? <Check size={16} /> : <Copy size={16} />}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="Listing description"
                    rows={12}
                    className="font-mono text-sm"
                  />
                  <div className="flex items-center gap-2 text-xs">
                    {draft.generatedByAi && (
                      <Badge variant="secondary" className="gap-1">
                        <Sparkle size={12} weight="fill" />
                        AI-Generated
                      </Badge>
                    )}
                    <span className="text-muted-foreground">
                      {draft.description?.length || 0} characters
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1">{draft.title}</h3>
                    {draft.subtitle && (
                      <p className="text-muted-foreground">{draft.subtitle}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold text-accent">
                      {formatCurrency(draft.price || 0, draft.currency || item.purchaseCurrency)}
                    </div>
                    <Badge variant="secondary">
                      {draft.conditionSummary}
                    </Badge>
                  </div>

                  <div className="border-t border-border pt-4">
                    <h4 className="font-semibold mb-2">Description</h4>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {draft.description}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!draft.title || !draft.description}>
              Save Draft
            </Button>
          </div>
        </div>
      </DialogContent>
      
      <TitlePatternOptimizerDialog
        open={showPatternOptimizer}
        onOpenChange={setShowPatternOptimizer}
        item={item}
        channel={channel}
        onApplyTitle={(title) => {
          setDraft({ ...draft, title })
          toast.success('Optimized title applied')
        }}
      />
    </Dialog>
  )
}
