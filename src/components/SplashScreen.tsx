import { useEffect, useState } from 'react'

interface SplashScreenProps {
  onComplete: () => void
}

/**
 * SplashScreen — Vinylasis intro animation.
 *
 * Uses the app's luxury oklch charcoal/gold palette so the first frame a user
 * sees already feels consistent with the main UI (see `BrandMark` and
 * `DesktopSidebar` for the same tokens). A single SVG draws the vinyl record
 * and tonearm so the whole scene is vector-crisp on every display.
 */
export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [loaded, setLoaded] = useState(false)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    // Ensure DOM is ready and animations can start on the next paint.
    requestAnimationFrame(() => {
      setLoaded(true)
    })

    const fadeTimer = setTimeout(() => setFading(true), 2800)
    const completeTimer = setTimeout(() => onComplete(), 3500)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(completeTimer)
    }
  }, [onComplete])

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-screen w-screen flex-col items-center justify-center overflow-hidden"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(24px, 4vw, 48px)',
        // Deep charcoal radial backdrop matching app chrome
        background:
          'radial-gradient(ellipse at 50% 35%, oklch(0.14 0.01 35) 0%, oklch(0.09 0.01 30) 55%, oklch(0.06 0.005 30) 100%)',
        opacity: fading ? 0 : 1,
        transition: fading ? 'opacity 0.7s ease-out' : 'none',
        pointerEvents: fading ? 'none' : 'auto',
      }}
      role="status"
      aria-live="polite"
      aria-label="Vinylasis is loading"
    >
      {/* Subtle groove/noise texture overlay to add depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 6px, oklch(0.65 0.13 60) 6px, oklch(0.65 0.13 60) 7px)',
          backgroundSize: '140px 140px',
        }}
      />

      {/* Ambient gold glow behind record */}
      <div
        aria-hidden="true"
        className="splash-glow absolute rounded-full"
        style={{
          width: 'clamp(320px, 55vw, 560px)',
          height: 'clamp(320px, 55vw, 560px)',
          background:
            'radial-gradient(circle, oklch(0.65 0.13 60 / 0.28) 0%, oklch(0.55 0.10 55 / 0.14) 35%, oklch(0.40 0.08 50 / 0.06) 60%, transparent 78%)',
          animation: loaded ? 'splashPulse 2.8s ease-in-out infinite' : 'none',
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'scale(1)' : 'scale(0.85)',
          transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
          filter: 'blur(2px)',
        }}
      />

      {/* Record + Tonearm wrapper */}
      <div
        className="relative"
        style={{
          width: 'clamp(220px, 38vw, 320px)',
          height: 'clamp(220px, 38vw, 320px)',
        }}
      >
        {/* Spinning Record */}
        <svg
          viewBox="0 0 200 200"
          width="100%"
          height="100%"
          className="splash-record"
          style={{
            animation: loaded ? 'splashSpin 2.4s linear infinite' : 'none',
            opacity: loaded ? 1 : 0,
            transform: loaded ? 'scale(1)' : 'scale(0.85)',
            transition: 'opacity 0.5s ease-out 0.2s, transform 0.5s ease-out 0.2s',
          }}
        >
          <defs>
            <filter id="recordShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="rgba(0,0,0,0.65)" />
            </filter>

            {/* Vinyl body — off-center radial for subtle illumination */}
            <radialGradient id="vinylGrad" cx="32%" cy="28%" r="78%">
              <stop offset="0%" stopColor="oklch(0.18 0.005 30)" />
              <stop offset="55%" stopColor="oklch(0.09 0.005 30)" />
              <stop offset="100%" stopColor="oklch(0.05 0.002 30)" />
            </radialGradient>

            {/* Gold label — matches BrandMark disc gradient */}
            <radialGradient id="labelGrad" cx="38%" cy="32%" r="72%">
              <stop offset="0%" stopColor="oklch(0.88 0.09 75)" />
              <stop offset="45%" stopColor="oklch(0.72 0.13 65)" />
              <stop offset="100%" stopColor="oklch(0.50 0.10 58)" />
            </radialGradient>

            {/* Thin gold rim stroke */}
            <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="oklch(0.78 0.12 70 / 0.85)" />
              <stop offset="50%" stopColor="oklch(0.55 0.10 58 / 0.50)" />
              <stop offset="100%" stopColor="oklch(0.78 0.12 70 / 0.85)" />
            </linearGradient>

            {/* Static light sweep across the vinyl */}
            <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="45%" stopColor="rgba(255,255,255,0.10)" />
              <stop offset="55%" stopColor="rgba(255,255,255,0.16)" />
              <stop offset="65%" stopColor="rgba(255,255,255,0.06)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>

          {/* Drop-shadowed vinyl body */}
          <circle cx="100" cy="100" r="96" fill="url(#vinylGrad)" filter="url(#recordShadow)" />

          {/* Gold outer rim — premium edge */}
          <circle
            cx="100"
            cy="100"
            r="95.25"
            fill="none"
            stroke="url(#rimGrad)"
            strokeWidth="0.75"
          />

          {/* Vinyl grooves — concentric rings with alternating highlight */}
          {Array.from({ length: 24 }, (_, i) => {
            const r = 48 + i * 2
            const isHighlight = i % 2 === 0
            return (
              <circle
                key={i}
                cx="100"
                cy="100"
                r={r}
                fill="none"
                stroke={isHighlight ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.35)'}
                strokeWidth={isHighlight ? 0.6 : 0.8}
              />
            )
          })}

          {/* Light sweep reflection (rotates with record) */}
          <circle cx="100" cy="100" r="96" fill="url(#sweepGrad)" />

          {/* Label background */}
          <circle cx="100" cy="100" r="34" fill="url(#labelGrad)" />

          {/* Label inner rings */}
          <circle
            cx="100"
            cy="100"
            r="34"
            fill="none"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="1.25"
          />
          <circle
            cx="100"
            cy="100"
            r="27"
            fill="none"
            stroke="rgba(0,0,0,0.22)"
            strokeWidth="0.75"
          />

          {/* Label wordmark — VINYLASIS, split across the spindle */}
          <text
            x="100"
            y="93"
            textAnchor="middle"
            fill="oklch(0.15 0.02 35)"
            fontSize="10"
            fontWeight="700"
            fontFamily='"Cormorant Garamond", Georgia, serif'
            letterSpacing="3"
          >
            VINYL
          </text>
          <text
            x="100"
            y="116"
            textAnchor="middle"
            fill="oklch(0.15 0.02 35)"
            fontSize="8"
            fontWeight="600"
            fontFamily='"Cormorant Garamond", Georgia, serif'
            letterSpacing="4"
          >
            ASIS
          </text>

          {/* Spindle hole */}
          <circle cx="100" cy="100" r="3.5" fill="oklch(0.04 0.002 30)" />
          <circle cx="100" cy="100" r="1.75" fill="oklch(0.14 0.005 30)" />
        </svg>

        {/* Tonearm — static overlay so it doesn't spin with the record */}
        <svg
          viewBox="0 0 200 200"
          width="100%"
          height="100%"
          className="splash-tonearm pointer-events-none absolute inset-0"
          style={{
            transformOrigin: '168px 28px',
            transformBox: 'view-box',
            animation: loaded ? 'tonearmSwing 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both' : 'none',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.4s ease-out 0.3s',
          }}
        >
          <defs>
            <linearGradient id="armGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="oklch(0.82 0.02 70)" />
              <stop offset="55%" stopColor="oklch(0.58 0.015 55)" />
              <stop offset="100%" stopColor="oklch(0.40 0.01 50)" />
            </linearGradient>
            <radialGradient id="pivotGrad" cx="35%" cy="30%" r="80%">
              <stop offset="0%" stopColor="oklch(0.75 0.02 65)" />
              <stop offset="100%" stopColor="oklch(0.32 0.01 45)" />
            </radialGradient>
            <filter id="armShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="rgba(0,0,0,0.55)" />
            </filter>
          </defs>

          <g filter="url(#armShadow)">
            {/* Counterweight */}
            <rect x="170" y="18" width="18" height="10" rx="2.5" fill="url(#armGrad)" />
            <rect
              x="170"
              y="18"
              width="18"
              height="10"
              rx="2.5"
              fill="none"
              stroke="oklch(0.25 0.01 45)"
              strokeWidth="0.6"
            />

            {/* Pivot base */}
            <circle cx="168" cy="28" r="7.5" fill="url(#pivotGrad)" stroke="oklch(0.30 0.01 45)" strokeWidth="1" />
            <circle cx="168" cy="28" r="3.25" fill="oklch(0.65 0.13 60)" />

            {/* Arm body — pivot → headshell */}
            <line
              x1="168"
              y1="28"
              x2="122"
              y2="88"
              stroke="url(#armGrad)"
              strokeWidth="3.25"
              strokeLinecap="round"
            />

            {/* Headshell / cartridge */}
            <line
              x1="122"
              y1="88"
              x2="114"
              y2="99"
              stroke="oklch(0.78 0.02 65)"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Stylus tip — gold */}
            <circle cx="113" cy="100" r="2.75" fill="oklch(0.80 0.11 70)" />
            <circle cx="113" cy="100" r="1" fill="oklch(0.95 0.04 80)" />
          </g>
        </svg>
      </div>

      {/* Branding */}
      <div
        className="mt-10 text-center"
        style={{
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.7s ease-out 0.5s, transform 0.7s ease-out 0.5s',
        }}
      >
        <h1
          className="gold-foil-text text-5xl md:text-6xl font-bold"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            letterSpacing: '0.04em',
          }}
        >
          Vinylasis
        </h1>
        <p
          className="mt-3 text-[11px] md:text-xs font-semibold uppercase"
          style={{
            color: 'oklch(0.60 0.04 55)',
            letterSpacing: '0.35em',
          }}
        >
          Premium Collection Manager
        </p>
      </div>

      {/* Progress bar — replaces bouncing dots for a more premium finish */}
      <div
        className="mt-8 relative overflow-hidden rounded-full"
        style={{
          width: 'clamp(140px, 22vw, 200px)',
          height: '2px',
          background: 'oklch(0.20 0.01 35)',
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.6s ease-out 0.8s, transform 0.6s ease-out 0.8s',
        }}
        role="progressbar"
        aria-label="Loading Vinylasis"
        aria-valuetext="Loading"
      >
        <span
          aria-hidden="true"
          className="splash-progress-bar absolute inset-y-0 w-1/2 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, oklch(0.65 0.13 60) 40%, oklch(0.88 0.09 75) 50%, oklch(0.65 0.13 60) 60%, transparent 100%)',
            boxShadow: '0 0 10px oklch(0.65 0.13 60 / 0.6)',
            animation: loaded ? 'splashProgress 1.6s ease-in-out infinite' : 'none',
          }}
        />
      </div>
    </div>
  )
}
