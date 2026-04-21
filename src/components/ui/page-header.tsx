import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  /**
   * Small uppercase label rendered above the title (e.g. "Collection" on a
   * detail page or "Agents · Workflow"). Optional.
   */
  eyebrow?: ReactNode
  /**
   * Primary page title. Rendered in the Vinylasis display face
   * (Cormorant Garamond) with a soft gold-foil treatment when `foil` is true.
   */
  title: ReactNode
  /**
   * Supporting description sitting under the title. Keep it short — this is a
   * header, not a paragraph.
   */
  description?: ReactNode
  /**
   * Right-aligned action slot (typically one or more `Button`s). On small
   * screens actions wrap below the title block.
   */
  actions?: ReactNode
  /**
   * Optional leading icon/visual rendered to the left of the text block.
   */
  icon?: ReactNode
  /**
   * Render the title with the gold-foil gradient utility. Defaults to `true`
   * for the premium Vinylasis feel; set to `false` for dialogs or dense views.
   */
  foil?: boolean
  /**
   * When `true` adds the luxury bottom divider (thin gold gradient line).
   */
  divider?: boolean
  className?: string
}

/**
 * PageHeader — shared view / section header primitive.
 *
 * Codifies the "title + eyebrow + description + actions" pattern so views can
 * stop hand-rolling their own headers. Uses existing design tokens:
 *
 * - Display face: Cormorant Garamond (via inline font-family to match the
 *   rest of the app, which doesn't expose a Tailwind token for it yet).
 * - Gold foil: `.gold-foil-text` utility from `src/index.css`.
 * - Divider: matching gradient used on `.luxury-card` accents.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon,
  foil = true,
  divider = false,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'relative flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6',
        divider && 'border-b',
        className
      )}
      style={divider ? { borderColor: 'oklch(0.65 0.13 60 / 0.14)' } : undefined}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <div className="flex-shrink-0 pt-1" style={{ color: 'oklch(0.65 0.13 60)' }}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: 'oklch(0.55 0.04 55)' }}
            >
              {eyebrow}
            </p>
          )}
          <h1
            className={cn(
              'truncate text-2xl font-bold leading-tight sm:text-3xl',
              foil && 'gold-foil-text'
            )}
            style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              letterSpacing: '0.01em',
              color: foil ? undefined : 'oklch(0.95 0.02 70)',
            }}
          >
            {title}
          </h1>
          {description && (
            <p
              className="mt-1 max-w-2xl text-sm leading-relaxed"
              style={{ color: 'oklch(0.60 0.03 55)' }}
            >
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      )}
      {divider && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, oklch(0.65 0.13 60 / 0.4), transparent)',
          }}
        />
      )}
    </header>
  )
}
