import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { X, Download, ArrowClockwise } from '@phosphor-icons/react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): void
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAUpdatePrompt() {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowInstallPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg)
        
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setShowUpdatePrompt(true)
              }
            })
          }
        })
      })

      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true
          window.location.reload()
        }
      })
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setShowInstallPrompt(false)
    }
  }

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
  }

  if (showUpdatePrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-5 duration-300">
        <Card className="p-4 bg-card border-accent shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              <ArrowClockwise className="w-5 h-5 text-accent" weight="bold" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Update Available
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                A new version of VinylVault is ready. Update now for the latest features and improvements.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleUpdate}
                  className="flex-1"
                >
                  Update Now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowUpdatePrompt(false)}
                >
                  Later
                </Button>
              </div>
            </div>
            <button
              onClick={() => setShowUpdatePrompt(false)}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </Card>
      </div>
    )
  }

  if (showInstallPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-5 duration-300">
        <Card className="p-4 bg-card border-primary shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Download className="w-5 h-5 text-primary" weight="bold" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Install VinylVault
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Install this app on your device for quick access and offline support.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleInstall}
                  className="flex-1"
                >
                  Install
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowInstallPrompt(false)}
                >
                  Not Now
                </Button>
              </div>
            </div>
            <button
              onClick={() => setShowInstallPrompt(false)}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return null
}
