import { useState, useEffect } from 'react'
import { CheckCircle, CircleNotch } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { PressingIdentifiedPayload } from './PressingIdentificationAgent'
import type { SoldDataPayload } from './SoldPricesResearcherAgent'

interface FinalValuation {
  pressingConfirmed: string
  conditionVerdict: string
  marketAnalysis: {
    recentAverage: string
    realisticPrice: string
    topEnd: string
  }
  recommendation: {
    buyNow: string
    bestOffer: string
    riskNotes: string
    flipPotential: string
  }
  summary: string
}

function synthesizeValuation(
  pressing: PressingIdentifiedPayload,
  sold: SoldDataPayload
): FinalValuation {
  return {
    pressingConfirmed: `${pressing.catalog} – ${pressing.label} (${pressing.year}, ${pressing.country})`,
    conditionVerdict: 'VG+ (assumed from listing description)',
    marketAnalysis: {
      recentAverage: sold.average,
      realisticPrice: '£110–£160',
      topEnd: '£220+ (perfect condition, misprint variant)',
    },
    recommendation: {
      buyNow: 'Yes — max £145',
      bestOffer: '£125–£135',
      riskNotes: 'Misprint variant can have high variance',
      flipPotential: 'Moderate – strong if NM condition',
    },
    summary: 'This is a strong deal at £130 or below.',
  }
}

interface DependencyStatus {
  pressingDone: boolean
  soldDone: boolean
}

function DependencyIndicator({ status }: { status: DependencyStatus }) {
  return (
    <div className='flex gap-4'>
      <div className='flex items-center gap-1.5 text-xs'>
        {status.pressingDone ? (
          <CheckCircle size={14} className='text-green-400' weight='fill' />
        ) : (
          <CircleNotch size={14} className='animate-spin text-muted-foreground' />
        )}
        <span className={cn(status.pressingDone ? 'text-green-400' : 'text-muted-foreground')}>
          Pressing identified
        </span>
      </div>
      <div className='flex items-center gap-1.5 text-xs'>
        {status.soldDone ? (
          <CheckCircle size={14} className='text-green-400' weight='fill' />
        ) : (
          <CircleNotch size={14} className='animate-spin text-muted-foreground' />
        )}
        <span className={cn(status.soldDone ? 'text-green-400' : 'text-muted-foreground')}>
          Sold prices ready
        </span>
      </div>
    </div>
  )
}

interface InfoRowProps {
  label: string
  value: string
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className='flex items-start justify-between gap-4 py-1.5 text-sm'>
      <span className='shrink-0 text-muted-foreground'>{label}</span>
      <span className='text-right font-medium'>{value}</span>
    </div>
  )
}

export default function ValuationSynthesizerAgent() {
  const [pressing, setPressing] = useState<PressingIdentifiedPayload | null>(null)
  const [soldData, setSoldData] = useState<SoldDataPayload | null>(null)
  const [valuation, setValuation] = useState<FinalValuation | null>(null)

  useEffect(() => {
    function handleAgentOutput(e: Event) {
      const event = e as CustomEvent<{ type: string; payload: unknown }>

      if (event.detail.type === 'pressing-identified') {
        setPressing(event.detail.payload as PressingIdentifiedPayload)
        setValuation(null)
      }

      if (event.detail.type === 'sold-data-ready') {
        setSoldData(event.detail.payload as SoldDataPayload)
        setValuation(null)
      }

      if (event.detail.type === 'workflow-reset') {
        setPressing(null)
        setSoldData(null)
        setValuation(null)
      }
    }

    window.addEventListener('agent:output', handleAgentOutput)
    return () => window.removeEventListener('agent:output', handleAgentOutput)
  }, [])

  // Synthesize once both payloads are available
  useEffect(() => {
    if (pressing && soldData && !valuation) {
      const final = synthesizeValuation(pressing, soldData)
      setValuation(final)

      window.dispatchEvent(
        new CustomEvent('agent:output', {
          detail: { type: 'valuation-complete', payload: final },
        })
      )
    }
  }, [pressing, soldData, valuation])

  const bothReady = !!pressing && !!soldData
  const status: DependencyStatus = { pressingDone: !!pressing, soldDone: !!soldData }

  return (
    <Card className='border border-border bg-card'>
      <CardHeader className='pb-4'>
        <div className='flex items-center gap-2'>
          {/* Custom SVG star/gem icon in amber */}
          <svg
            xmlns='http://www.w3.org/2000/svg'
            width='22'
            height='22'
            viewBox='0 0 256 256'
            className='text-amber-400'
            fill='currentColor'
            aria-hidden='true'
          >
            <path d='M239.2,97.29a16,16,0,0,0-13.81-11L166,81.17,142.72,25.81h0a15.95,15.95,0,0,0-29.44,0L90.07,81.17,30.61,86.32a16,16,0,0,0-9.11,28.06L66.61,153.8,53.09,212.34a16,16,0,0,0,23.84,17.34l51-31,51,31a16,16,0,0,0,23.84-17.34L189.39,153.8l45.11-39.42A16,16,0,0,0,239.2,97.29Zm-15.22,10.47-45.11,39.41a16,16,0,0,0-5.08,15.71L187.27,222l-51-31a15.9,15.9,0,0,0-16.54,0l-51,31,13.47-58.85a16,16,0,0,0-5.08-15.71L32,108.29a.37.37,0,0,1,0-.08l59.44-5.14a16,16,0,0,0,13.35-9.75L128,38l23.2,55.32a16,16,0,0,0,13.35,9.75L224,108.21S224,107.72,224,107.76Z' />
          </svg>
          <CardTitle className='text-lg text-amber-400'>Agent 3 – Final Valuation</CardTitle>
        </div>
      </CardHeader>

      <CardContent>
        {/* Waiting state */}
        {!bothReady && (
          <div className='space-y-4 py-4'>
            <div className='flex flex-col items-center gap-3 text-center'>
              <p className='text-sm text-muted-foreground'>Waiting for agents 1 and 2…</p>
            </div>
            <div className='flex justify-center'>
              <DependencyIndicator status={status} />
            </div>
          </div>
        )}

        {/* Synthesizing indicator */}
        {bothReady && !valuation && (
          <div className='flex flex-col items-center justify-center py-8 text-center'>
            <CircleNotch size={32} className='mb-3 animate-spin text-amber-400' />
            <p className='text-sm font-medium'>Synthesising final valuation…</p>
          </div>
        )}

        {/* Valuation result */}
        {valuation && (
          <div className='space-y-5'>
            {/* Pressing + condition */}
            <div className='rounded-md border border-border bg-muted/30 p-4'>
              <p className='mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                Pressing Confirmed
              </p>
              <p className='font-medium'>{valuation.pressingConfirmed}</p>
              <p className='mt-1 text-sm text-muted-foreground'>
                Condition: {valuation.conditionVerdict}
              </p>
            </div>

            <Separator />

            {/* Market analysis */}
            <div>
              <p className='mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                Market Analysis
              </p>
              <div className='divide-y divide-border/50 rounded-md border border-border'>
                <div className='px-4'>
                  <InfoRow label='Recent Average' value={valuation.marketAnalysis.recentAverage} />
                </div>
                <div className='px-4'>
                  <InfoRow label='Realistic Price' value={valuation.marketAnalysis.realisticPrice} />
                </div>
                <div className='px-4'>
                  <InfoRow label='Top End' value={valuation.marketAnalysis.topEnd} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Recommendation */}
            <div>
              <p className='mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                Recommendation
              </p>
              <div className='divide-y divide-border/50 rounded-md border border-border'>
                <div className='px-4'>
                  <InfoRow label='Buy Now?' value={valuation.recommendation.buyNow} />
                </div>
                <div className='px-4'>
                  <InfoRow label='Best Offer' value={valuation.recommendation.bestOffer} />
                </div>
                <div className='px-4'>
                  <InfoRow label='Risk Notes' value={valuation.recommendation.riskNotes} />
                </div>
                <div className='px-4'>
                  <InfoRow label='Flip Potential' value={valuation.recommendation.flipPotential} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Summary highlight */}
            <div className='rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3'>
              <p className='text-xs font-semibold uppercase tracking-wider text-amber-400'>
                Summary
              </p>
              <p className='mt-1 font-semibold text-amber-100'>{valuation.summary}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
