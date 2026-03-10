import { ListingDraft } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/helpers'
import { Sparkle, Trash, Copy } from '@phosphor-icons/react'

interface ListingDraftCardProps {
  draft: ListingDraft
  onDelete: () => void
  onCopy: () => void
}

export function ListingDraftCard({ draft, onDelete, onCopy }: ListingDraftCardProps) {
  return (
    <Card className="transition-all duration-200 hover:shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg leading-tight">{draft.title}</CardTitle>
            {draft.subtitle && (
              <CardDescription className="mt-1">{draft.subtitle}</CardDescription>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={onCopy}>
              <Copy size={16} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash size={16} />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="text-2xl font-bold text-accent">
            {formatCurrency(draft.price, draft.currency)}
          </div>
          <Badge variant="secondary">{draft.conditionSummary}</Badge>
          {draft.generatedByAi && (
            <Badge variant="outline" className="gap-1">
              <Sparkle size={12} weight="fill" />
              AI
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-1">Description</h4>
            <p className="text-sm line-clamp-3 whitespace-pre-wrap">{draft.description}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            Created {formatDate(draft.createdAt)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
