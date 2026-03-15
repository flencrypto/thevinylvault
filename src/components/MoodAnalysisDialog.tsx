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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { MusicNote, Waveform, VinylRecord } from '@phosphor-icons/react'

interface MoodEntry {
  label: string
  emoji: string
  color: string
  keywords: string[]
}

const MOOD_MAP: MoodEntry[] = [
  { label: 'Energetic', emoji: '⚡', color: '#f97316', keywords: ['rock', 'punk', 'grunge', 'indie'] },
  { label: 'Intense', emoji: '🔥', color: '#ef4444', keywords: ['metal', 'heavy', 'thrash', 'doom'] },
  { label: 'Sophisticated', emoji: '🎷', color: '#8b5cf6', keywords: ['jazz', 'bebop', 'swing', 'bossa'] },
  { label: 'Contemplative', emoji: '🎻', color: '#6366f1', keywords: ['classical', 'orchestral', 'symphony'] },
  { label: 'Melancholic', emoji: '🌧️', color: '#3b82f6', keywords: ['blues'] },
  { label: 'Hypnotic', emoji: '🌐', color: '#06b6d4', keywords: ['electronic', 'techno', 'house', 'ambient'] },
  { label: 'Upbeat', emoji: '✨', color: '#f59e0b', keywords: ['pop', 'disco'] },
  { label: 'Passionate', emoji: '❤️', color: '#ec4899', keywords: ['soul', 'gospel', 'r&b', 'funk'] },
  { label: 'Confident', emoji: '🎤', color: '#a855f7', keywords: ['hip hop', 'rap', 'trap'] },
  { label: 'Nostalgic', emoji: '🍂', color: '#84cc16', keywords: ['folk', 'acoustic', 'country'] },
  { label: 'Laid-back', emoji: '🌴', color: '#10b981', keywords: ['reggae', 'ska', 'dub'] },
  { label: 'Vibrant', emoji: '💃', color: '#fb923c', keywords: ['latin', 'salsa', 'samba'] },
  { label: 'Serene', emoji: '🌙', color: '#67e8f9', keywords: ['new age', 'meditation'] },
  { label: 'Adventurous', emoji: '🌍', color: '#fbbf24', keywords: ['world', 'afrobeat'] },
]

const DEFAULT_MOOD: Omit<MoodEntry, 'keywords'> = {
  label: 'Eclectic',
  emoji: '🎵',
  color: '#9ca3af',
}

function detectMood(item: CollectionItem): MoodEntry & { keywords: string[] } {
  const text = [
    item.releaseTitle,
    item.artistName,
    item.notes,
    item.labelName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const mood of MOOD_MAP) {
    for (const keyword of mood.keywords) {
      const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (pattern.test(text)) {
        return mood
      }
    }
  }

  return { ...DEFAULT_MOOD, keywords: [] }
}

interface GenreBucket {
  name: string
  count: number
  color: string
}

interface MoodBucket {
  label: string
  emoji: string
  color: string
  count: number
  records: CollectionItem[]
}

interface MoodAnalysisDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MoodAnalysisDialog({ open, onOpenChange }: MoodAnalysisDialogProps) {
  const [items] = useKV<CollectionItem[]>('vinyl-vault-collection', [])

  const analysis = useMemo(() => {
    const collection = items || []
    if (collection.length === 0) {
      return { moods: [], genres: [], dominant: null, sampleRecords: [] }
    }

    const moodBuckets = new Map<string, MoodBucket>()
    const genreKeywordHits = new Map<string, { count: number; color: string }>()

    for (const item of collection) {
      const mood = detectMood(item)

      const existing = moodBuckets.get(mood.label)
      if (existing) {
        existing.count++
        existing.records.push(item)
      } else {
        moodBuckets.set(mood.label, {
          label: mood.label,
          emoji: mood.emoji,
          color: mood.color,
          count: 1,
          records: [item],
        })
      }

      // Track genre keywords for the genre bar chart
      for (const entry of MOOD_MAP) {
        const text = [item.releaseTitle, item.artistName, item.notes, item.labelName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        for (const keyword of entry.keywords) {
          if (text.includes(keyword)) {
            const current = genreKeywordHits.get(keyword) || { count: 0, color: entry.color }
            current.count++
            genreKeywordHits.set(keyword, current)
          }
        }
      }
    }

    const moods = Array.from(moodBuckets.values()).sort((a, b) => b.count - a.count)
    const dominant = moods[0] || null

    const genres: GenreBucket[] = Array.from(genreKeywordHits.entries())
      .map(([name, { count, color }]) => ({ name, count, color }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Pick up to 6 sample records with mood labels
    const sampleRecords = collection.slice(0, 6).map((item) => ({
      item,
      mood: detectMood(item),
    }))

    return { moods, genres, dominant, sampleRecords }
  }, [items])

  const totalItems = (items || []).length
  const maxGenreCount = analysis.genres[0]?.count || 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Waveform size={22} weight="fill" />
            Mood Analysis
          </DialogTitle>
          <DialogDescription>
            Keyword-based mood and genre analysis of your vinyl collection
          </DialogDescription>
        </DialogHeader>

        {totalItems === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <VinylRecord size={48} className="text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              Add some records to your collection to see mood analysis.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Dominant Vibe Banner */}
            {analysis.dominant && (
              <Card
                className="p-4 text-center border-2"
                style={{ borderColor: analysis.dominant.color + '40' }}
              >
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Your Collection&apos;s Dominant Vibe
                </p>
                <p className="text-3xl mb-1">{analysis.dominant.emoji}</p>
                <p
                  className="text-xl font-bold"
                  style={{ color: analysis.dominant.color }}
                >
                  {analysis.dominant.label}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {analysis.dominant.count} of {totalItems} record
                  {totalItems !== 1 ? 's' : ''} match this mood
                </p>
              </Card>
            )}

            {/* Genre Classification Breakdown */}
            {analysis.genres.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <MusicNote size={16} />
                  Genre Classification
                </h3>
                <div className="space-y-2">
                  {analysis.genres.map((genre) => (
                    <div key={genre.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="capitalize font-medium">{genre.name}</span>
                        <span className="text-muted-foreground">
                          {genre.count} record{genre.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="relative">
                        <Progress
                          value={(genre.count / maxGenreCount) * 100}
                          className="h-2.5"
                        />
                        <div
                          className="absolute inset-0 h-2.5 rounded-full transition-all"
                          style={{
                            width: `${(genre.count / maxGenreCount) * 100}%`,
                            backgroundColor: genre.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mood Distribution Pills */}
            {analysis.moods.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Mood Distribution</h3>
                <div className="flex flex-wrap gap-2">
                  {analysis.moods.map((mood) => (
                    <Badge
                      key={mood.label}
                      variant="outline"
                      className="text-xs px-2.5 py-1 gap-1"
                      style={{
                        borderColor: mood.color + '60',
                        color: mood.color,
                        backgroundColor: mood.color + '10',
                      }}
                    >
                      {mood.emoji} {mood.label}
                      <span
                        className="ml-0.5 font-bold rounded-full px-1.5 text-[10px]"
                        style={{ backgroundColor: mood.color + '20' }}
                      >
                        {mood.count}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Sample Records with Mood Labels */}
            {analysis.sampleRecords.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Sample Records</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {analysis.sampleRecords.map(({ item, mood }) => (
                    <Card key={item.id} className="p-3 flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                        style={{ backgroundColor: mood.color + '20' }}
                      >
                        {mood.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {item.releaseTitle}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.artistName}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[10px] mt-1 px-1.5 py-0"
                          style={{
                            borderColor: mood.color + '60',
                            color: mood.color,
                          }}
                        >
                          {mood.label}
                        </Badge>
                      </div>
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
