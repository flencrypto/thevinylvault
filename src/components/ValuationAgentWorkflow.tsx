import { useState, useEffect } from 'react'
import { CheckCircle, ArrowRight, ArrowsClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import PressingIdentificationAgent from '@/components/agents/PressingIdentificationAgent'
import SoldPricesResearcherAgent from '@/components/agents/SoldPricesResearcherAgent'
import ValuationSynthesizerAgent from '@/components/agents/ValuationSynthesizerAgent'

type AgentStep = 'pressing-identified' | 'sold-data-ready' | 'valuation-complete'

interface StepConfig {
  id: AgentStep
  label: string
  stepNumber: number
}

const STEPS: StepConfig[] = [
  { id: 'pressing-identified', label: 'Pressing Identified', stepNumber: 1 },
  { id: 'sold-data-ready', label: 'Sold Prices Ready', stepNumber: 2 },
  { id: 'valuation-complete', label: 'Valuation Complete', stepNumber: 3 },
]

export default function ValuationAgentWorkflow() {
  const [completedSteps, setCompletedSteps] = useState<Set<AgentStep>>(new Set())

  useEffect(() => {
    function handleAgentOutput(e: Event) {
      const event = e as CustomEvent<{ type: string }>
      const type = event.detail.type as AgentStep | 'workflow-reset'

      if (type === 'workflow-reset') {
        setCompletedSteps(new Set())
        return
      }

      if (type === 'pressing-identified' || type === 'sold-data-ready' || type === 'valuation-complete') {
        setCompletedSteps(prev => new Set([...prev, type]))
      }
    }

    window.addEventListener('agent:output', handleAgentOutput)
    return () => window.removeEventListener('agent:output', handleAgentOutput)
  }, [])

  function handleResetAll() {
    window.dispatchEvent(
      new CustomEvent('agent:output', {
        detail: { type: 'workflow-reset' },
      })
    )
  }

  const allComplete = STEPS.every(s => completedSteps.has(s.id))

  return (
    <div className='mx-auto max-w-2xl space-y-6 p-4'>
      {/* Page header */}
      <div className='space-y-1'>
        <div className='flex items-center justify-between gap-4'>
          <h1 className='text-2xl font-bold tracking-tight'>Valuation Agent Workflow</h1>
          <Button
            variant='outline'
            size='sm'
            onClick={handleResetAll}
            disabled={completedSteps.size === 0}
          >
            <ArrowsClockwise size={14} className='mr-1.5' />
            Reset All
          </Button>
        </div>
        <p className='text-sm text-muted-foreground'>
          Three AI agents working in sequence to identify pressings, research sold prices, and
          deliver a final buy/sell recommendation.
        </p>
      </div>

      {/* Step indicator */}
      <div className='flex items-center gap-1'>
        {STEPS.map((step, idx) => {
          const done = completedSteps.has(step.id)
          const isLast = idx === STEPS.length - 1

          return (
            <div key={step.id} className='flex flex-1 items-center gap-1'>
              <div
                className={cn(
                  'flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-2 py-2 transition-colors',
                  done
                    ? 'border-green-500/40 bg-green-500/10'
                    : 'border-border bg-muted/30'
                )}
              >
                <div className='flex items-center gap-1.5'>
                  {done ? (
                    <CheckCircle
                      size={16}
                      className='text-green-400'
                      weight='fill'
                    />
                  ) : (
                    <span
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold',
                        done
                          ? 'bg-green-500 text-white'
                          : 'bg-muted-foreground/20 text-muted-foreground'
                      )}
                    >
                      {step.stepNumber}
                    </span>
                  )}
                  <span
                    className={cn(
                      'text-xs font-medium',
                      done ? 'text-green-400' : 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </div>

              {!isLast && (
                <ArrowRight
                  size={14}
                  className={cn(
                    'shrink-0 transition-colors',
                    done ? 'text-green-400' : 'text-muted-foreground/40'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {allComplete && (
        <div className='rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm font-medium text-amber-300'>
          ✓ All three agents complete — valuation delivered
        </div>
      )}

      {/* Agent components */}
      <div className='space-y-4'>
        <PressingIdentificationAgent />
        <SoldPricesResearcherAgent />
        <ValuationSynthesizerAgent />
      </div>
    </div>
  )
}
