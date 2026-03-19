import { useRegisterSW } from 'virtual:pwa-register/react'
import { ArrowsClockwise, X } from '@phosphor-icons/react'

export default function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 shadow-2xl text-white text-sm max-w-sm w-[calc(100%-2rem)]">
      <ArrowsClockwise className="w-5 h-5 text-accent shrink-0" weight="bold" />
      <span className="flex-1">A new version of VinylVault is ready.</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="px-3 py-1 rounded-lg bg-accent text-accent-foreground font-semibold text-xs hover:bg-accent/90 transition-colors shrink-0"
      >
        Update
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        className="p-1 rounded-lg hover:bg-slate-700 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
