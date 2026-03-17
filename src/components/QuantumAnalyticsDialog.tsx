import { useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { CollectionItem } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { VinylRecord } from '@phosphor-icons/react'

interface QuantumAnalyticsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CONDITION_COLORS: Record<string, string> = {
  M: '#10b981',
  NM: '#06b6d4',
  EX: '#3b82f6',
  'VG+': '#7c3aed',
  VG: '#f59e0b',
  G: '#ef4444',
  F: '#6b7280',
  P: '#374151',
}

const GENRE_KEYWORDS: { genre: string; keywords: string[] }[] = [
  { genre: 'Rock', keywords: ['rock', 'punk', 'grunge', 'indie'] },
  { genre: 'Metal', keywords: ['metal', 'heavy', 'thrash', 'doom'] },
  { genre: 'Jazz', keywords: ['jazz', 'bebop', 'swing', 'bossa'] },
  { genre: 'Classical', keywords: ['classical', 'orchestral', 'symphony'] },
  { genre: 'Blues', keywords: ['blues'] },
  { genre: 'Electronic', keywords: ['electronic', 'techno', 'house', 'ambient', 'synth'] },
  { genre: 'Pop', keywords: ['pop', 'disco'] },
  { genre: 'Soul / R&B', keywords: ['soul', 'gospel', 'r&b', 'funk'] },
  { genre: 'Hip Hop', keywords: ['hip hop', 'rap', 'trap'] },
  { genre: 'Folk / Country', keywords: ['folk', 'acoustic', 'country', 'bluegrass'] },
  { genre: 'Reggae', keywords: ['reggae', 'ska', 'dub'] },
  { genre: 'Latin', keywords: ['latin', 'salsa', 'samba'] },
  { genre: 'World', keywords: ['world', 'afrobeat'] },
]

function detectGenre(item: CollectionItem): string {
  const text = [item.releaseTitle, item.artistName, item.notes, item.labelName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  for (const entry of GENRE_KEYWORDS) {
    for (const kw of entry.keywords) {
      const pattern = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (pattern.test(text)) return entry.genre
    }
  }
  return 'Other'
}

export function QuantumAnalyticsDialog({ open, onOpenChange }: QuantumAnalyticsDialogProps) {
  const [items] = useKV<CollectionItem[]>('vinyl-vault-collection', [])

  const analytics = useMemo(() => {
    const collection = items || []
    if (collection.length === 0) {
      return null
    }

    let totalInvested = 0
    let totalValue = 0
    const genreCounts: Record<string, number> = {}
    const conditionCounts: Record<string, number> = {}
    const recordValues: { artist: string; title: string; value: number }[] = []

    for (const item of collection) {
      const invested = item.purchasePrice || 0
      const value = item.estimatedValue?.estimateMid || 0
      totalInvested += invested
      totalValue += value

      const genre = detectGenre(item)
      genreCounts[genre] = (genreCounts[genre] || 0) + 1

      const condition = item.condition?.mediaGrade || 'Unknown'
      conditionCounts[condition] = (conditionCounts[condition] || 0) + 1

      if (value > 0) {
        recordValues.push({ artist: item.artistName, title: item.releaseTitle, value })
      }
    }

    const roi = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0

    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count, pct: (count / collection.length) * 100 }))

    const conditionOrder = ['M', 'NM', 'EX', 'VG+', 'VG', 'G', 'F', 'P']
    const conditions = conditionOrder
      .map(grade => ({ grade, count: conditionCounts[grade] || 0 }))
      .filter(c => c.count > 0)

    const unknownCondition = conditionCounts['Unknown'] || 0
    if (unknownCondition > 0) {
      conditions.push({ grade: 'Unknown', count: unknownCondition })
    }

    const maxConditionCount = Math.max(...conditions.map(c => c.count), 1)

    const topRecords = recordValues
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    return {
      totalRecords: collection.length,
      totalValue,
      totalInvested,
      roi,
      topGenres,
      conditions,
      maxConditionCount,
      topRecords,
    }
  }, [items])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <VinylRecord size={22} weight="fill" />
            Quantum Analytics Dashboard
          </DialogTitle>
          <DialogDescription>
            Portfolio analytics and collection insights
          </DialogDescription>
        </DialogHeader>

        {!analytics ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <VinylRecord size={48} className="text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              Add some records to your collection to see analytics.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Records</p>
                <p className="text-2xl font-bold mt-1">{analytics.totalRecords}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Estimated Value</p>
                <p className="text-2xl font-bold mt-1">£{analytics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Invested</p>
                <p className="text-2xl font-bold mt-1">£{analytics.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">ROI</p>
                <p className={`text-2xl font-bold mt-1 ${analytics.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {analytics.roi >= 0 ? '+' : ''}{analytics.roi.toFixed(1)}%
                </p>
              </Card>
            </div>

            {/* Genre Breakdown */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Genre Breakdown</h3>
              <div className="space-y-2">
                {analytics.topGenres.map(genre => (
                  <div key={genre.name} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 truncate">{genre.name}</span>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${genre.pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-12 text-right">{genre.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Condition Distribution */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Condition Distribution</h3>
              <div className="space-y-2">
                {analytics.conditions.map(cond => (
                  <div key={cond.grade} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-12">{cond.grade}</span>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(cond.count / analytics.maxConditionCount) * 100}%`,
                          backgroundColor: CONDITION_COLORS[cond.grade] || '#6b7280',
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{cond.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Records by Value */}
            {analytics.topRecords.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Top Records by Estimated Value</h3>
                <div className="space-y-2">
                  {analytics.topRecords.map((record) => (
                    <Card key={`${record.artist}-${record.title}`} className="p-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{record.artist}</p>
                        <p className="text-xs text-muted-foreground truncate">{record.title}</p>
                      </div>
                      <span className="text-sm font-bold ml-3 shrink-0">
                        £{record.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
