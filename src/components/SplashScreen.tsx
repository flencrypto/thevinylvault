import { useEffect, useState } from 'react'

interface SplashScreenProps {
  onComplete: () => void
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [loaded, setLoaded] = useState(false)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    // Ensure DOM is ready and animations can start
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
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        opacity: fading ? 0 : 1,
        transition: fading ? 'opacity 0.7s ease-out' : 'none',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      {/* Ambient glow behind record */}
      <div
        className="absolute rounded-full"
        style={{
          width: '380px',
          height: '380px',
          background: 'radial-gradient(circle, rgba(251,191,36,0.2) 0%, rgba(139,92,246,0.12) 40%, rgba(59,130,246,0.08) 60%, transparent 75%)',
          animation: loaded ? 'splashPulse 2.5s ease-in-out infinite' : 'none',
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'scale(1)' : 'scale(0.8)',
          transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
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
          style={{
            animation: loaded ? 'splashSpin 2s linear infinite' : 'none',
            opacity: loaded ? 1 : 0,
            transform: loaded ? 'scale(1)' : 'scale(0.85)',
            transition: 'opacity 0.5s ease-out 0.2s, transform 0.5s ease-out 0.2s',
          }}
        >
          {/* Drop shadow filter */}
          <defs>
            <filter id="recordShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="rgba(0,0,0,0.6)" />
            </filter>
            <radialGradient id="vinylGrad" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#2a2a2a" />
              <stop offset="100%" stopColor="#0a0a0a" />
            </radialGradient>
            <radialGradient id="labelGrad" cx="40%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="60%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#92400e" />
            </radialGradient>
            <radialGradient id="shineGrad" cx="30%" cy="25%" r="60%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>

          {/* Outer vinyl body */}
          <circle cx="100" cy="100" r="96" fill="url(#vinylGrad)" filter="url(#recordShadow)" />

          {/* Groove band outer edge highlight */}
          <circle cx="100" cy="100" r="96" fill="none" stroke="#333" strokeWidth="1" />

          {/* Vinyl grooves — concentric rings */}
          {Array.from({ length: 22 }, (_, i) => {
            const r = 52 + i * 2
            return (
              <circle
                key={i}
                cx="100"
                cy="100"
                r={r}
                fill="none"
                stroke={i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.3)'}
                strokeWidth="1"
              />
            )
          })}

          {/* Label background */}
          <circle cx="100" cy="100" r="36" fill="url(#labelGrad)" />

          {/* Label inner ring */}
          <circle cx="100" cy="100" r="36" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="28" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />

          {/* Label text - VA monogram */}
          <text
            x="100"
            y="96"
            textAnchor="middle"
            fill="rgba(0,0,0,0.7)"
            fontSize="13"
            fontWeight="bold"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            letterSpacing="1"
          >
            VINYL
          </text>
          <text
            x="100"
            y="110"
            textAnchor="middle"
            fill="rgba(0,0,0,0.7)"
            fontSize="11"
            fontWeight="600"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            letterSpacing="2"
          >
            AYSIS
          </text>

          {/* Spindle hole */}
          <circle cx="100" cy="100" r="4" fill="#080808" />
          <circle cx="100" cy="100" r="2" fill="#1a1a1a" />

          {/* Vinyl shine overlay */}
          <circle cx="100" cy="100" r="96" fill="url(#shineGrad)" />
        </svg>

        {/* Tonearm */}
        <svg
          viewBox="0 0 200 200"
          width="100%"
          height="100%"
          className="absolute inset-0 pointer-events-none"
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
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
          </defs>

          {/* Pivot base circle */}
          <circle cx="168" cy="28" r="7" fill="#334155" stroke="#475569" strokeWidth="1.5" />
          <circle cx="168" cy="28" r="3.5" fill="#64748b" />

          {/* Arm body — from pivot to headshell */}
          <line
            x1="168"
            y1="28"
            x2="122"
            y2="88"
            stroke="url(#armGrad)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Headshell / cartridge angled section */}
          <line
            x1="122"
            y1="88"
            x2="114"
            y2="99"
            stroke="#94a3b8"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Stylus tip */}
          <circle cx="113" cy="100" r="2.5" fill="#fbbf24" />
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
          className="text-5xl md:text-6xl font-bold tracking-tight"
          style={{
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: loaded ? 'goldShimmer 3s linear infinite' : 'none',
          }}
        >
          Vinyl<span style={{ color: '#fff' }}>aysis</span>
        </h1>
        <p className="mt-3 text-sm md:text-base text-slate-300 tracking-[0.25em] uppercase font-medium">
          Premium Collection Manager
        </p>
      </div>

      {/* Loading dots */}
      <div
        className="mt-8 flex gap-2.5"
        style={{
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.6s ease-out 0.8s, transform 0.6s ease-out 0.8s',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-2 h-2 rounded-full bg-amber-400"
            style={{
              animation: loaded ? `splashDot 1.4s ease-in-out ${i * 0.25}s infinite` : 'none',
              boxShadow: '0 0 8px rgba(251, 191, 36, 0.6)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
