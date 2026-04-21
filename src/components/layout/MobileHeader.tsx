import BrandMark from './BrandMark'

interface MobileHeaderProps {
  envLabel: string
  modeLabel: string
}

export default function MobileHeader({ envLabel, modeLabel }: MobileHeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 safe-area-inset-top"
      style={{
        background: 'oklch(0.09 0.01 35 / 0.92)',
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        borderBottom: '1px solid oklch(0.65 0.13 60 / 0.15)',
        boxShadow: '0 1px 20px oklch(0 0 0 / 0.5)',
      }}
    >
      <div className="px-3 sm:px-4 py-3 sm:py-3.5">
        <BrandMark size="md" subtitle={`${envLabel} · ${modeLabel}`} />
      </div>
    </header>
  )
}

