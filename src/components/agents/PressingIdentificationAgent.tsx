import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Robot, CircleNotch, CheckCircle, ArrowsClockwise } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { identifyPressing } from '@/lib/pressing-identification-ai'
import type { ScoredPressingCandidate } from '@/lib/pressing-identification-ai'

export interface PressingIdentifiedPayload {
  catalog: string
  label: string
  year: string
  country: string
  pressingName: string
  artistName: string
  releaseTitle: string
  confidence: number
  reasoning: string
}

interface FormState {
  artist: string
  title: string
  catalogNumber: string
  year: string
  country: string
  labelName: string
  runoutMatrix: string
}

const INITIAL_FORM: FormState = {
  artist: '',
  title: '',
  catalogNumber: '',
  year: '',
  country: '',
  labelName: '',
  runoutMatrix: '',
}

function confidenceBandColor(band: 'high' | 'medium' | 'low' | 'ambiguous'): string {
  switch (band) {
    case 'high':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'low':
    case 'ambiguous':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
  }
}

function confidenceBandLabel(band: 'high' | 'medium' | 'low' | 'ambiguous'): string {
  switch (band) {
    case 'high':
      return 'High Confidence'
    case 'medium':
      return 'Medium Confidence'
    case 'low':
      return 'Low Confidence'
    case 'ambiguous':
      return 'Ambiguous'
  }
}

export default function PressingIdentificationAgent() {
  const [apiKeys] = useKV<{ discogsUserToken?: string }>('vinyl-vault-api-keys', {})
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<ScoredPressingCandidate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function updateField(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleIdentify() {
    setLoading(true)
    setError(null)
    setCandidates([])
    setSelectedId(null)

    try {
      const results = await identifyPressing({
        ocrRunoutValues: form.runoutMatrix
          ? form.runoutMatrix.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
        manualHints: {
          artist: form.artist || undefined,
          title: form.title || undefined,
          catalogNumber: form.catalogNumber || undefined,
          country: form.country || undefined,
          year: form.year ? parseInt(form.year, 10) : undefined,
          labelName: form.labelName || undefined,
        },
        discogsSearchEnabled: !!apiKeys?.discogsUserToken,
        discogsApiToken: apiKeys?.discogsUserToken,
      })

      setCandidates(results.slice(0, 5))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleSelectCandidate(candidate: ScoredPressingCandidate) {
    setSelectedId(candidate.id)

    const payload: PressingIdentifiedPayload = {
      catalog: candidate.catalogNumber || '',
      label: candidate.pressingName,
      year: String(candidate.year),
      country: candidate.country,
      pressingName: candidate.pressingName,
      artistName: candidate.artistName,
      releaseTitle: candidate.releaseTitle,
      confidence: candidate.confidence,
      reasoning: candidate.reasoning,
    }

    window.dispatchEvent(
      new CustomEvent('agent:output', {
        detail: { type: 'pressing-identified', payload },
      })
    )
  }

  function handleReset() {
    setForm(INITIAL_FORM)
    setCandidates([])
    setSelectedId(null)
    setError(null)
    setLoading(false)
  }

  return (
    <Card className='border border-border bg-card'>
      <CardHeader className='pb-4'>
        <div className='flex items-center gap-2'>
          <Robot size={22} className='text-blue-400' weight='duotone' />
          <CardTitle className='text-lg'>Agent 1 – Pressing Identification</CardTitle>
        </div>
        <CardDescription>
          Enter record details and runout/matrix values to identify the pressing using AI and
          Discogs database matching.
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-5'>
        {/* Form fields */}
        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1.5'>
            <Label htmlFor='pi-artist'>Artist</Label>
            <Input
              id='pi-artist'
              placeholder='e.g. Pink Floyd'
              value={form.artist}
              onChange={e => updateField('artist', e.target.value)}
              disabled={loading}
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='pi-title'>Title</Label>
            <Input
              id='pi-title'
              placeholder='e.g. The Wall'
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
              disabled={loading}
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='pi-catalog'>Catalog Number</Label>
            <Input
              id='pi-catalog'
              placeholder='e.g. SHDW 411'
              value={form.catalogNumber}
              onChange={e => updateField('catalogNumber', e.target.value)}
              disabled={loading}
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='pi-year'>Year</Label>
            <Input
              id='pi-year'
              placeholder='e.g. 1979'
              value={form.year}
              onChange={e => updateField('year', e.target.value)}
              disabled={loading}
              type='number'
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='pi-country'>Country</Label>
            <Input
              id='pi-country'
              placeholder='e.g. UK'
              value={form.country}
              onChange={e => updateField('country', e.target.value)}
              disabled={loading}
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='pi-label'>Label Name</Label>
            <Input
              id='pi-label'
              placeholder='e.g. Harvest'
              value={form.labelName}
              onChange={e => updateField('labelName', e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='pi-runout'>Runout / Matrix Values</Label>
          <Textarea
            id='pi-runout'
            placeholder={'Enter matrix/runout text, one per line\ne.g. SHDW 411 A1\nSHDW 411 B1'}
            value={form.runoutMatrix}
            onChange={e => updateField('runoutMatrix', e.target.value)}
            disabled={loading}
            rows={3}
            className='resize-none font-mono text-sm'
          />
        </div>

        <div className='flex gap-2'>
          <Button
            onClick={handleIdentify}
            disabled={loading || (!form.artist && !form.catalogNumber && !form.runoutMatrix)}
            className='flex-1'
          >
            {loading ? (
              <>
                <CircleNotch size={16} className='mr-2 animate-spin' />
                Analysing…
              </>
            ) : (
              <>
                <Robot size={16} className='mr-2' />
                Identify Pressing
              </>
            )}
          </Button>

          {(candidates.length > 0 || error) && (
            <Button variant='outline' onClick={handleReset}>
              <ArrowsClockwise size={16} className='mr-2' />
              Reset
            </Button>
          )}
        </div>

        {/* Error state */}
        {error && (
          <p className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
            {error}
          </p>
        )}

        {/* Candidates */}
        {candidates.length > 0 && (
          <>
            <Separator />
            <div className='space-y-3'>
              <p className='text-sm font-medium text-muted-foreground'>
                {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} found
              </p>

              {candidates.map((candidate, idx) => {
                const isSelected = selectedId === candidate.id
                return (
                  <div
                    key={candidate.id}
                    className={cn(
                      'rounded-lg border p-4 transition-colors',
                      isSelected
                        ? 'border-green-500/50 bg-green-500/5'
                        : 'border-border bg-muted/30'
                    )}
                  >
                    <div className='mb-2 flex items-start justify-between gap-2'>
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-center gap-2'>
                          <span className='text-xs font-bold text-muted-foreground'>
                            #{idx + 1}
                          </span>
                          <p className='truncate text-sm font-semibold'>
                            {candidate.artistName} – {candidate.releaseTitle}
                          </p>
                        </div>
                        <p className='mt-0.5 text-xs text-muted-foreground'>
                          {candidate.pressingName}
                        </p>
                      </div>

                      <div className='flex shrink-0 flex-col items-end gap-1.5'>
                        <Badge
                          variant='outline'
                          className={cn('text-xs', confidenceBandColor(candidate.confidenceBand))}
                        >
                          {confidenceBandLabel(candidate.confidenceBand)}
                        </Badge>
                        <span className='text-xs font-medium tabular-nums text-muted-foreground'>
                          {Math.round(candidate.confidence * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className='mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
                      {candidate.year && <span>Year: {candidate.year}</span>}
                      {candidate.country && <span>Country: {candidate.country}</span>}
                      {candidate.catalogNumber && (
                        <span>Cat#: {candidate.catalogNumber}</span>
                      )}
                    </div>

                    <p className='mb-3 text-xs leading-relaxed text-muted-foreground'>
                      {candidate.reasoning}
                    </p>

                    <Button
                      size='sm'
                      variant={isSelected ? 'default' : 'outline'}
                      className={cn('w-full', isSelected && 'bg-green-600 hover:bg-green-700')}
                      onClick={() => handleSelectCandidate(candidate)}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle size={14} className='mr-1.5' weight='fill' />
                          Selected
                        </>
                      ) : (
                        'Select this pressing'
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
