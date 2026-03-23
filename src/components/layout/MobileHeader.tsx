import { Disc } from '@phosphor-icons/react'

interface MobileHeaderProps {
  envLabel: string
  modeLabel: string
}

export default function MobileHeader({ envLabel, modeLabel }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-lg bg-slate-950/90 border-b border-slate-800 safe-area-inset-top">
      <div className="px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-accent to-accent/60 rounded-xl flex items-center justify-center flex-shrink-0">
            <Disc className="w-5 h-5 sm:w-6 sm:h-6 text-accent-foreground" weight="bold" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-white truncate">VinylVault</h1>
            <p className="text-[10px] sm:text-xs text-slate-400 truncate">
              {envLabel} · {modeLabel}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
