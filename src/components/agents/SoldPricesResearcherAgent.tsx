import { useState, useEffect, useCallback } from 'react'
import { Brain, CircleNotch, ArrowsClockwise } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { PressingIdentifiedPayload } from './PressingIdentificationAgent'

export interface SoldItem {
  date: string
  condition: string
  price: string
  platform: string
  notes: string
}

export interface SoldDataPayload {
  soldItems: SoldItem[]
  average: string
  median: string
  currentRange: string
  sourceNote: string
}

const SIMULATED_SOLD_ITEMS: SoldItem[] = [
  { date: '2026-03-10', condition: 'VG+', price: '£145', platform: 'eBay', notes: 'UK 1st press A1/B1' },
  { date: '2026-03-05', condition: 'EX', price: '£98', platform: 'Discogs', notes: '' },
  { date: '2026-02-28', condition: 'VG+', price: '£132', platform: 'eBay', notes: 'gatefold' },
  { date: '2026-02-15', condition: 'NM', price: '£185', platform: 'Discogs', notes: 'misprint variant' },
  { date: '2026-02-10', condition: 'VG', price: '£78', platform: 'eBay', notes: 'worn sleeve' },
]

const SIMULATED_SUMMARY = {
  average: '£127.60',
  median: '£132.00',
  currentRange: '£95–£190',
}

function platformBadgeClass(platform: string): string {
  switch (platform) {
    case 'eBay':
      return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'
    case 'Discogs':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/25'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export default function SoldPricesResearcherAgent() {
  const [pressing, setPressing] = useState<PressingIdentifiedPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [soldData, setSoldData] = useState<SoldDataPayload | null>(null)

  const fetchSoldData = useCallback(async (pressingPayload: PressingIdentifiedPayload) => {
    setLoading(true)
    setSoldData(null)

    // Simulate API call delay
    await new Promise<void>(resolve => setTimeout(resolve, 1500))

    const payload: SoldDataPayload = {
      soldItems: SIMULATED_SOLD_ITEMS,
      average: SIMULATED_SUMMARY.average,
      median: SIMULATED_SUMMARY.median,
      currentRange: SIMULATED_SUMMARY.currentRange,
      sourceNote: `Simulated UK sold prices for ${pressingPayload.artistName} – ${pressingPayload.releaseTitle} (${pressingPayload.year}, ${pressingPayload.country})`,
    }

    setSoldData(payload)
    setLoading(false)

    window.dispatchEvent(
      new CustomEvent('agent:output', {
        detail: { type: 'sold-data-ready', payload },
      })
    )
  }, [])

  useEffect(() => {
    function handleAgentOutput(e: Event) {
      const event = e as CustomEvent<{ type: string; payload: unknown }>
      if (event.detail.type === 'pressing-identified') {
        const payload = event.detail.payload as PressingIdentifiedPayload
        setPressing(payload)
        fetchSoldData(payload)
      }
      if (event.detail.type === 'workflow-reset') {
        setPressing(null)
        setSoldData(null)
        setLoading(false)
      }
    }

    window.addEventListener('agent:output', handleAgentOutput)
    return () => window.removeEventListener('agent:output', handleAgentOutput)
  }, [fetchSoldData])

  return (
    <Card className='border border-border bg-card'>
      <CardHeader className='pb-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Brain size={22} className='text-purple-400' weight='duotone' />
            <CardTitle className='text-lg'>Agent 2 – UK Sold Prices</CardTitle>
          </div>

          {pressing && !loading && (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => fetchSoldData(pressing)}
              className='text-muted-foreground hover:text-foreground'
            >
              <ArrowsClockwise size={14} className='mr-1.5' />
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Idle placeholder */}
        {!pressing && !loading && !soldData && (
          <div className='flex flex-col items-center justify-center py-8 text-center'>
            <Brain size={36} className='mb-3 text-muted-foreground/40' weight='duotone' />
            <p className='text-sm text-muted-foreground'>Waiting for pressing identification…</p>
            <p className='mt-1 text-xs text-muted-foreground/60'>
              Agent 1 must complete before sold prices can be fetched.
            </p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className='flex flex-col items-center justify-center py-8 text-center'>
            <CircleNotch size={32} className='mb-3 animate-spin text-purple-400' />
            <p className='text-sm font-medium'>Fetching UK sold prices…</p>
            {pressing && (
              <p className='mt-1 text-xs text-muted-foreground'>
                {pressing.artistName} – {pressing.releaseTitle} ({pressing.year})
              </p>
            )}
          </div>
        )}

        {/* Results */}
        {soldData && !loading && (
          <div className='space-y-4'>
            {pressing && (
              <p className='text-xs text-muted-foreground'>
                Results for:{' '}
                <span className='font-medium text-foreground'>
                  {pressing.artistName} – {pressing.releaseTitle}
                </span>{' '}
                · {pressing.year} · {pressing.country}
              </p>
            )}

            {/* Sold items table */}
            <div className='overflow-x-auto rounded-md border border-border'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b border-border bg-muted/40'>
                    <th className='px-3 py-2 text-left text-xs font-medium text-muted-foreground'>
                      Date
                    </th>
                    <th className='px-3 py-2 text-left text-xs font-medium text-muted-foreground'>
                      Condition
                    </th>
                    <th className='px-3 py-2 text-right text-xs font-medium text-muted-foreground'>
                      Price
                    </th>
                    <th className='px-3 py-2 text-left text-xs font-medium text-muted-foreground'>
                      Platform
                    </th>
                    <th className='px-3 py-2 text-left text-xs font-medium text-muted-foreground'>
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {soldData.soldItems.map((item, idx) => (
                    <tr
                      key={idx}
                      className='border-b border-border/50 last:border-0 hover:bg-muted/20'
                    >
                      <td className='px-3 py-2 text-xs tabular-nums text-muted-foreground'>
                        {item.date}
                      </td>
                      <td className='px-3 py-2 text-xs font-medium'>{item.condition}</td>
                      <td className='px-3 py-2 text-right text-xs font-semibold tabular-nums'>
                        {item.price}
                      </td>
                      <td className='px-3 py-2'>
                        <Badge
                          variant='outline'
                          className={`text-xs ${platformBadgeClass(item.platform)}`}
                        >
                          {item.platform}
                        </Badge>
                      </td>
                      <td className='px-3 py-2 text-xs text-muted-foreground'>
                        {item.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Separator />

            {/* Summary stats */}
            <div className='grid grid-cols-3 gap-3'>
              <div className='rounded-md border border-border bg-muted/30 px-3 py-2.5 text-center'>
                <p className='text-xs text-muted-foreground'>Average</p>
                <p className='mt-0.5 text-base font-bold tabular-nums'>{soldData.average}</p>
              </div>
              <div className='rounded-md border border-border bg-muted/30 px-3 py-2.5 text-center'>
                <p className='text-xs text-muted-foreground'>Median</p>
                <p className='mt-0.5 text-base font-bold tabular-nums'>{soldData.median}</p>
              </div>
              <div className='rounded-md border border-border bg-muted/30 px-3 py-2.5 text-center'>
                <p className='text-xs text-muted-foreground'>Current Range</p>
                <p className='mt-0.5 text-base font-bold tabular-nums'>{soldData.currentRange}</p>
              </div>
            </div>

            {soldData.sourceNote && (
              <p className='text-xs text-muted-foreground/60'>{soldData.sourceNote}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
