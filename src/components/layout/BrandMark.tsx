import { Disc } from '@phosphor-icons/react'

type BrandMarkSize = 'sm' | 'md'

interface BrandMarkProps {
  /**
   * Subtitle rendered under the wordmark. Typically a concatenated
   * env/mode label (e.g. "iOS · App").
   */
  subtitle?: string
  /**
   * Visual size. `md` (default) is used by the mobile header and renders a
   * slightly larger title/disc at the `sm:` breakpoint. `sm` is used by the
   * desktop sidebar, which has a narrower column and no breakpoint scaling.
   */
  size?: BrandMarkSize
  className?: string
}

/**
 * BrandMark — shared vinyl-disc logo + Vinylasis wordmark.
 *
 * Used by both `DesktopSidebar` and `MobileHeader` so the brand presentation
 * stays consistent across breakpoints. The gold-foil wordmark and vinyl-disc
 * glow are driven by existing utilities in `src/index.css` (`gold-foil-text`)
 * and the oklch gold palette.
 */
export default function BrandMark({ subtitle, size = 'md', className = '' }: BrandMarkProps) {
  const discSize = size === 'md' ? 'w-9 h-9 sm:w-10 sm:h-10' : 'w-10 h-10'
  const titleSize = size === 'md' ? 'text-lg sm:text-xl' : 'text-lg'
  const subtitleSize = size === 'md' ? 'text-[10px] sm:text-xs' : 'text-[10px]'

  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 min-w-0 ${className}`}>
      {/* Vinyl disc logo with gold glow */}
      <div className="relative flex-shrink-0">
        <div
          className="absolute inset-0 rounded-xl blur-md"
          style={{ background: 'oklch(0.65 0.13 60 / 0.28)' }}
          aria-hidden="true"
        />
        <div
          className={`relative ${discSize} rounded-xl flex items-center justify-center shadow-md`}
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
          className={`${titleSize} font-bold leading-tight truncate gold-foil-text`}
          style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', letterSpacing: '0.04em' }}
        >
          Vinylasis
        </h1>
        {subtitle && (
          <p
            className={`${subtitleSize} truncate leading-tight`}
            style={{ color: 'oklch(0.50 0.04 55)' }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}
