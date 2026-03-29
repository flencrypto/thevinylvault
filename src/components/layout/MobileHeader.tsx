import { Disc } from '@phosphor-icons/react'

interface MobileHeaderProps {
  envLabel: string
  modeLabel: string
}

export default function MobileHeader({ envLabel, modeLabel }: MobileHeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 safe-area-inset-top"
      style={{
        background: 'oklch(0.09 0.01 35 / 0.92)',
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        borderBottom: '1px solid oklch(0.65 0.13 60 / 0.15)',
        boxShadow: '0 1px 20px oklch(0 0 0 / 0.5)',
      }}
    >
      <div className="px-3 sm:px-4 py-3 sm:py-3.5">
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Vinyl disc logo */}
          <div className="relative flex-shrink-0">
            <div
              className="absolute inset-0 rounded-xl blur-md"
              style={{ background: 'oklch(0.65 0.13 60 / 0.28)' }}
            />
            <div
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-md"
              style={{
                background: 'linear-gradient(135deg, oklch(0.65 0.13 60) 0%, oklch(0.50 0.10 58) 100%)',
                boxShadow: '0 0 14px oklch(0.65 0.13 60 / 0.30)',
              }}
            >
              <Disc className="w-5 h-5" weight="bold" style={{ color: 'oklch(0.08 0.01 35)' }} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1
              className="text-lg sm:text-xl font-bold leading-tight truncate gold-foil-text"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', letterSpacing: '0.04em' }}
            >
              Vinylasis
            </h1>
            <p className="text-[10px] sm:text-xs truncate leading-tight" style={{ color: 'oklch(0.50 0.04 55)' }}>
              {envLabel} · {modeLabel}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}

