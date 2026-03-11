import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { watchlistTemplates, WatchlistTemplate } from '@/lib/watchlist-templates'
import { WatchlistItem } from '@/lib/types'
import { Check, Plus, MusicNotes, Disc, Diamond, Lightning } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface WatchlistTemplatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (items: Omit<WatchlistItem, 'id' | 'collectionId' | 'createdAt'>[]) => void
}

export function WatchlistTemplatesDialog({ open, onOpenChange, onImport }: WatchlistTemplatesDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<WatchlistTemplate | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'genre' | 'style' | 'rarity' | 'format'>('all')

  const filteredTemplates = selectedCategory === 'all' 
    ? watchlistTemplates 
    : watchlistTemplates.filter(t => t.category === selectedCategory)

  const handleImportTemplate = (template: WatchlistTemplate) => {
    onImport(template.items)
    toast.success(`Imported ${template.name}`, {
      description: `Added ${template.items.length} watchlist items`,
    })
    onOpenChange(false)
  }

  const getCategoryIcon = (category: WatchlistTemplate['category']) => {
    switch (category) {
      case 'genre':
        return <MusicNotes className="w-4 h-4" />
      case 'style':
        return <Disc className="w-4 h-4" />
      case 'rarity':
        return <Diamond className="w-4 h-4" />
      case 'format':
        return <Lightning className="w-4 h-4" />
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Watchlist Templates</DialogTitle>
          <DialogDescription>
            Choose a preset template to quickly populate your watchlist with curated items
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)} className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="genre">Genre</TabsTrigger>
            <TabsTrigger value="style">Style</TabsTrigger>
            <TabsTrigger value="rarity">Rarity</TabsTrigger>
            <TabsTrigger value="format">Format</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedCategory} className="mt-4">
            <ScrollArea className="h-[calc(85vh-240px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
                {filteredTemplates.map((template) => (
                  <Card 
                    key={template.id} 
                    className={`cursor-pointer transition-all hover:border-accent ${
                      selectedTemplate?.id === template.id ? 'border-accent bg-accent/5' : ''
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{template.icon}</span>
                          <div>
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {getCategoryIcon(template.category)}
                                <span className="ml-1">{template.category}</span>
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {template.items.length} items
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {selectedTemplate?.id === template.id && (
                          <Check className="w-5 h-5 text-accent" weight="bold" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="text-sm">
                        {template.description}
                      </CardDescription>
                      
                      <div className="mt-3 space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Includes:</p>
                        <div className="flex flex-wrap gap-1">
                          {template.items.slice(0, 3).map((item, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {item.artistName || item.releaseTitle || item.searchQuery?.substring(0, 20) + '...'}
                            </Badge>
                          ))}
                          {template.items.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{template.items.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredTemplates.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No templates found in this category</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedTemplate ? (
              <span>
                <strong>{selectedTemplate.name}</strong> selected ({selectedTemplate.items.length} items)
              </span>
            ) : (
              'Select a template to import'
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedTemplate && handleImportTemplate(selectedTemplate)}
              disabled={!selectedTemplate}
            >
              <Plus className="w-4 h-4 mr-2" />
              Import Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
