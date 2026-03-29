import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface LuxuryCardProps extends HTMLAttributes<HTMLDivElement> {
  groove?: boolean
  glow?: boolean
  polaroid?: boolean
  sleeve?: boolean
}

export const LuxuryCard = forwardRef<HTMLDivElement, LuxuryCardProps>(
  ({ className, groove, glow, polaroid, sleeve, children, ...props }, ref) => {
    const baseClass = sleeve ? 'sleeve-card' : polaroid ? 'polaroid-card' : 'luxury-card'
    return (
      <div
        ref={ref}
        className={cn(
          baseClass,
          groove && 'vinyl-groove-bg',
          glow && 'gold-pulse',
          'relative',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)
LuxuryCard.displayName = 'LuxuryCard'
