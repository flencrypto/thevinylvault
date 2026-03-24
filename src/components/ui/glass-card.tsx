/**
 * GlassCard — premium glassmorphism card primitive.
 *
 * Builds on the shadcn/ui Card API so it's a drop-in upgrade:
 *   <GlassCard>  →  <Card> but with backdrop-blur + frosted glass surface
 *
 * Variants
 * ────────
 * glow: 'none' | 'accent' | 'primary'   — coloured border + outer glow
 * blur: 'sm' | 'md' | 'lg'              — backdrop-blur intensity
 *
 * Usage
 * ─────
 * <GlassCard glow="accent" className="p-6">
 *   <h3>Hello</h3>
 * </GlassCard>
 *
 * <GlassCard blur="lg" glow="primary" asChild>
 *   <section>…</section>
 * </GlassCard>
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

// ─── Variant definitions ─────────────────────────────────────────────────────

const glassCardVariants = cva(
  // Base — frosted surface, subtle border, smooth transitions
  [
    'relative rounded-xl border',
    'bg-slate-900/70',
    'backdrop-blur-md',
    'transition-all duration-300',
    'overflow-hidden',
  ],
  {
    variants: {
      glow: {
        none:    'border-white/8',
        accent:  [
          'border-amber-400/25',
          'shadow-[0_0_24px_oklch(0.70_0.18_60_/_0.18),0_4px_12px_oklch(0_0_0_/_0.35)]',
          'hover:shadow-[0_0_32px_oklch(0.70_0.18_60_/_0.28),0_8px_20px_oklch(0_0_0_/_0.4)]',
          'hover:border-amber-400/40',
        ],
        primary: [
          'border-violet-500/25',
          'shadow-[0_0_24px_oklch(0.35_0.15_265_/_0.25),0_4px_12px_oklch(0_0_0_/_0.35)]',
          'hover:shadow-[0_0_32px_oklch(0.35_0.15_265_/_0.35),0_8px_20px_oklch(0_0_0_/_0.4)]',
          'hover:border-violet-500/40',
        ],
      },
      blur: {
        sm: 'backdrop-blur-sm',
        md: 'backdrop-blur-md',
        lg: 'backdrop-blur-xl',
      },
      interactive: {
        true:  'cursor-pointer hover:scale-[1.015] active:scale-[0.99]',
        false: '',
      },
    },
    defaultVariants: {
      glow:        'none',
      blur:        'md',
      interactive: false,
    },
  },
)

// ─── Props ───────────────────────────────────────────────────────────────────

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {
  /** Render as a different element using Radix Slot. */
  asChild?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, glow, blur, interactive, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'div'

    return (
      <Comp
        ref={ref}
        className={cn(glassCardVariants({ glow, blur, interactive }), className)}
        {...props}
      >
        {/* Subtle inner top-edge highlight — gives "glass depth" feel */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />

        {children}
      </Comp>
    )
  },
)
GlassCard.displayName = 'GlassCard'

// ─── Sub-components (mirrors shadcn/ui Card pattern) ─────────────────────────

const GlassCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  ),
)
GlassCardHeader.displayName = 'GlassCardHeader'

const GlassCardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-semibold leading-none tracking-tight text-foreground', className)}
      {...props}
    />
  ),
)
GlassCardTitle.displayName = 'GlassCardTitle'

const GlassCardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  ),
)
GlassCardDescription.displayName = 'GlassCardDescription'

const GlassCardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
)
GlassCardContent.displayName = 'GlassCardContent'

const GlassCardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  ),
)
GlassCardFooter.displayName = 'GlassCardFooter'

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
  GlassCardFooter,
}
