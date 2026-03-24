/**
 * VinylDisc — animated SVG vinyl record component.
 *
 * Features
 * ─────────
 * • Realistic pressed-vinyl groove rings with alternating opacity
 * • Shiny centre spindle highlight
 * • Customisable label colour, label text (artist / title), and size
 * • CSS-driven spin animation that starts on `playing` prop
 * • Subtle shimmer / reflection stripe that sweeps across the face
 * • Four size variants: sm (64 px) · md (96 px) · lg (128 px) · xl (176 px)
 *
 * Usage
 * ─────
 * <VinylDisc size="lg" playing labelColor="#f59e0b" />
 * <VinylDisc size="md" labelText="Dark Side" />
 */

import { components } from '@/lib/design-tokens'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ─── Variant definitions ─────────────────────────────────────────────────────

const vinylDiscVariants = cva('relative inline-block select-none shrink-0', {
  variants: {
    size: {
      sm:  'w-16 h-16',
      md:  'w-24 h-24',
      lg:  'w-32 h-32',
      xl:  'w-44 h-44',
    },
  },
  defaultVariants: { size: 'md' },
})

// ─── Size → pixel map ────────────────────────────────────────────────────────

const SIZE_PX: Record<string, number> = {
  sm:  64,
  md:  96,
  lg:  128,
  xl:  176,
}

// ─── Groove ring data ────────────────────────────────────────────────────────

/** Returns groove ring radii as a percentage of disc radius (outer → inner). */
function grooveRings(count: number, outerPct: number, innerPct: number): number[] {
  const rings: number[] = []
  for (let i = 0; i < count; i++) {
    rings.push(outerPct - (i * (outerPct - innerPct)) / (count - 1))
  }
  return rings
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface VinylDiscProps extends VariantProps<typeof vinylDiscVariants> {
  /** Whether the disc is spinning. */
  playing?: boolean
  /** Colour of the centre label. Defaults to the accent token. */
  labelColor?: string
  /** Short text rendered inside the label (artist or title). */
  labelText?: string
  /** Additional class names applied to the wrapper. */
  className?: string
  /** aria-label for accessibility. */
  'aria-label'?: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VinylDisc({
  size = 'md',
  playing = false,
  labelColor = 'oklch(0.70 0.18 60)',
  labelText,
  className,
  'aria-label': ariaLabel,
}: VinylDiscProps) {
  const px  = SIZE_PX[size ?? 'md'] ?? 96
  const r   = px / 2            // disc radius
  const cx  = r                 // SVG viewBox centre
  const cy  = r

  // Label / groove layout (as % of px)
  const labelR     = px * 0.18   // label circle radius
  const spindleR   = px * 0.04   // spindle hole radius
  const grooveOuter = px * 0.46  // first groove from edge
  const grooveInner = px * 0.22  // last groove before label

  const grooves = grooveRings(12, grooveOuter, grooveInner)

  // Font size scales with disc size
  const labelFontSize = Math.max(px * 0.055, 5)

  return (
    <div
      className={cn(vinylDiscVariants({ size }), className)}
      role="img"
      aria-label={ariaLabel ?? 'Vinyl record disc'}
    >
      {/* Keyframe injection — scoped to this element via inline style */}
      <style>{`
        @keyframes vd-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes vd-shimmer {
          0%   { opacity: 0; transform: translateX(-60%) rotate(-15deg); }
          15%  { opacity: 0.35; }
          50%  { opacity: 0.12; }
          85%  { opacity: 0.35; }
          100% { opacity: 0; transform: translateX(160%) rotate(-15deg); }
        }
      `}</style>

      {/* SVG disc body */}
      <svg
        viewBox={`0 0 ${px} ${px}`}
        width={px}
        height={px}
        xmlns="http://www.w3.org/2000/svg"
        style={{
          animation: playing
            ? `vd-spin ${components.vinylDisc.spinDurationMs}ms linear infinite`
            : undefined,
          display: 'block',
        }}
        aria-hidden="true"
      >
        <defs>
          {/* Radial gradient: simulate vinyl's slight sheen from edge to centre */}
          <radialGradient id={`vd-base-${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="oklch(0.18 0.015 265)" />
            <stop offset="55%"  stopColor="oklch(0.10 0.012 265)" />
            <stop offset="100%" stopColor="oklch(0.14 0.018 265)" />
          </radialGradient>

          {/* Slight rainbow shimmer overlay */}
          <linearGradient id={`vd-sheen-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0)"    />
            <stop offset="45%"  stopColor="rgba(255,255,255,0.04)" />
            <stop offset="50%"  stopColor="rgba(255,255,255,0.12)" />
            <stop offset="55%"  stopColor="rgba(255,255,255,0.04)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
          </linearGradient>

          {/* Clip: full circle */}
          <clipPath id={`vd-clip-${size}`}>
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
        </defs>

        {/* ── Base disc ──────────────────────────────────────────────────── */}
        <circle cx={cx} cy={cy} r={r} fill={`url(#vd-base-${size})`} />

        {/* ── Groove rings ───────────────────────────────────────────────── */}
        {grooves.map((gr, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={gr}
            fill="none"
            stroke={i % 2 === 0 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.35)'}
            strokeWidth={size === 'sm' ? 0.6 : 1}
          />
        ))}

        {/* ── Sheen overlay ──────────────────────────────────────────────── */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={`url(#vd-sheen-${size})`}
          clipPath={`url(#vd-clip-${size})`}
        />

        {/* ── Centre label ───────────────────────────────────────────────── */}
        <circle cx={cx} cy={cy} r={labelR} fill={labelColor} opacity={0.92} />
        {/* Inner shadow on label */}
        <circle cx={cx} cy={cy} r={labelR} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={size === 'sm' ? 1 : 1.5} />

        {/* Label text */}
        {labelText && (
          <text
            x={cx}
            y={cy + labelFontSize * 0.35}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(0,0,0,0.75)"
            fontSize={labelFontSize}
            fontFamily="Poppins, sans-serif"
            fontWeight={600}
            clipPath={`url(#vd-clip-${size})`}
            style={{ userSelect: 'none' }}
          >
            {labelText.length > 8 ? `${labelText.slice(0, 7)}…` : labelText}
          </text>
        )}

        {/* ── Spindle hole ───────────────────────────────────────────────── */}
        <circle cx={cx} cy={cy} r={spindleR} fill="oklch(0.08 0.01 265)" />
        {/* Spindle highlight */}
        <circle
          cx={cx - spindleR * 0.3}
          cy={cy - spindleR * 0.3}
          r={spindleR * 0.35}
          fill="rgba(255,255,255,0.5)"
        />
      </svg>

      {/* ── Shimmer stripe — animates independently of disc spin ─────────── */}
      {playing && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
          style={{ borderRadius: '50%' }}
        >
          <span
            className="absolute top-0 bottom-0 w-1/4"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
              animation: 'vd-shimmer 2s ease-in-out infinite',
              animationDelay: '0.4s',
            }}
          />
        </span>
      )}
    </div>
  )
}
