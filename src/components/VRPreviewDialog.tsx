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

interface VRPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const VR_FEATURES = [
  {
    emoji: '🎧',
    title: '360° Audio Immersion',
    description: 'Experience your vinyl collection in full spatial audio with room-scale sound staging.',
  },
  {
    emoji: '💿',
    title: '3D Vinyl Grooves Visualization',
    description: 'Watch the needle trace microscopic grooves rendered in stunning 3D detail.',
  },
  {
    emoji: '🏠',
    title: 'Virtual Listening Room',
    description: 'Design your dream listening room and display your collection on virtual shelves.',
  },
  {
    emoji: '🌟',
    title: 'Interactive Vinyl Experience',
    description: 'Pick up, inspect, and play records with realistic physics and haptic feedback.',
  },
] as const

export function VRPreviewDialog({ open, onOpenChange }: VRPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <VinylRecord size={22} weight="fill" />
            VR Listening Room Preview
          </DialogTitle>
          <DialogDescription>
            Step into the future of vinyl collecting
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Hero visual */}
          <div
            className="rounded-xl p-8 text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)' }}
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'radial-gradient(circle at 30% 40%, #00ff88 0%, transparent 50%), radial-gradient(circle at 70% 60%, #06b6d4 0%, transparent 50%)',
              }}
            />
            <div className="relative z-10">
              <div className="text-6xl mb-4">💿</div>
              <h3
                className="text-2xl font-bold mb-2"
                style={{ color: '#00ff88' }}
              >
                VR Listening Room
              </h3>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">
                An immersive virtual reality experience for vinyl collectors — coming soon.
              </p>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {VR_FEATURES.map(feature => (
              <Card
                key={feature.title}
                className="p-4 border-2"
                style={{ borderColor: '#00ff8820', background: '#00ff8808' }}
              >
                <div className="text-2xl mb-2">{feature.emoji}</div>
                <h4
                  className="text-sm font-semibold mb-1"
                  style={{ color: '#00ff88' }}
                >
                  {feature.title}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center">
            <Button
              disabled
              className="gap-2 px-6"
              style={{ backgroundColor: '#00ff8840', color: '#00ff88' }}
            >
              <VinylRecord size={18} weight="fill" />
              Enter VR Mode (Coming Soon)
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
