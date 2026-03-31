/**
 * GlassCard — luxury glassmorphism card for the `src/components/ui/luxury/` sub-system.
 *
 * Uses the `vf.*` design tokens added to tailwind.config.js and mirrors the
 * Shadcn/ui Card API so it works as a drop-in upgrade.
 *
 * Usage
 * ─────
 * import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/ui/luxury/GlassCard'
 *
 * <GlassCard>
 *   <GlassCardHeader>
 *     <GlassCardTitle>My Title</GlassCardTitle>
 *   </GlassCardHeader>
 *   <GlassCardContent>…</GlassCardContent>
 * </GlassCard>
 */

import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative rounded-xl border border-vf-accent/20',
        'bg-vf-surface/75 backdrop-blur-md',
        'shadow-glass',
        'overflow-hidden transition-all duration-300',
        'hover:border-vf-accent/35 hover:shadow-gold-glow',
        className,
      )}
      {...props}
    >
      {/* Inner highlight edge — glass depth effect */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-vf-accent/30 to-transparent"
      />
      {children}
    </div>
  ),
)
GlassCard.displayName = 'GlassCard'

const GlassCardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  ),
)
GlassCardHeader.displayName = 'GlassCardHeader'

const GlassCardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-heading text-lg font-semibold leading-none tracking-tight text-vf-text', className)}
      {...props}
    />
  ),
)
GlassCardTitle.displayName = 'GlassCardTitle'

const GlassCardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-vf-text/60', className)} {...props} />
))
GlassCardDescription.displayName = 'GlassCardDescription'

const GlassCardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
)
GlassCardContent.displayName = 'GlassCardContent'

const GlassCardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  ),
)
GlassCardFooter.displayName = 'GlassCardFooter'

export { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardDescription, GlassCardContent, GlassCardFooter }
export type { GlassCardProps }
