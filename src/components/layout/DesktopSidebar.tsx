import { Disc } from '@phosphor-icons/react'
import type { ElementType } from 'react'
import type { TabValue } from '@/lib/types'

interface NavItem {
  value: TabValue
  icon: ElementType
  label: string
}

interface DesktopSidebarProps {
  navItems: readonly NavItem[]
  activeTab: TabValue
  onTabChange: (tab: TabValue) => void
  envLabel: string
  modeLabel: string
}

export default function DesktopSidebar({ navItems, activeTab, onTabChange, envLabel, modeLabel }: DesktopSidebarProps) {
  return (
    <aside
      className="relative flex flex-col w-56 flex-shrink-0 h-screen overflow-y-auto"
      style={{
        background: 'linear-gradient(180deg, oklch(0.10 0.01 35 / 0.98) 0%, oklch(0.09 0.01 30 / 0.98) 100%)',
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        borderRight: '1px solid oklch(0.65 0.13 60 / 0.14)',
        boxShadow: '1px 0 20px oklch(0 0 0 / 0.5)',
      }}
    >
      {/* Subtle groove texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-radial-gradient(circle at 50% 50%, transparent 0px, transparent 8px, oklch(0.65 0.13 60) 8px, oklch(0.65 0.13 60) 9px)',
          backgroundSize: '120px 120px',
        }}
      />

      {/* Branding */}
      <div
        className="relative flex items-center gap-3 px-4 py-5"
        style={{ borderBottom: '1px solid oklch(0.65 0.13 60 / 0.12)' }}
      >
        {/* Vinyl disc logo with gold glow */}
        <div className="relative flex-shrink-0">
          <div
            className="absolute inset-0 rounded-xl blur-md"
            style={{ background: 'oklch(0.65 0.13 60 / 0.3)' }}
          />
          <div
            className="relative w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, oklch(0.65 0.13 60) 0%, oklch(0.50 0.10 58) 100%)',
              boxShadow: '0 0 16px oklch(0.65 0.13 60 / 0.35)',
            }}
          >
            <Disc className="w-5 h-5" weight="bold" style={{ color: 'oklch(0.08 0.01 35)' }} />
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold leading-tight truncate gold-foil-text" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: '1.125rem', letterSpacing: '0.04em' }}>
            Vinylasis
          </h1>
          <p className="text-[10px] truncate leading-tight" style={{ color: 'oklch(0.50 0.04 55)' }}>
            {envLabel} · {modeLabel}
          </p>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Navigation */}
      <nav className="flex flex-col p-3 gap-0.5" style={{ borderTop: '1px solid oklch(0.65 0.13 60 / 0.12)' }}>
        <p className="text-[9px] font-semibold tracking-widest uppercase px-3 pb-2 pt-0.5" style={{ color: 'oklch(0.45 0.04 55)' }}>
          Navigation
        </p>
        {navItems.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => onTabChange(value)}
            className={`lux-nav-item ${activeTab === value ? 'active' : ''}`}
          >
            <Icon
              className="w-4 h-4 flex-shrink-0 transition-all duration-200"
              weight={activeTab === value ? 'fill' : 'regular'}
              style={activeTab === value ? { filter: 'drop-shadow(0 0 5px oklch(0.80 0.11 70 / 0.7))' } : {}}
            />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}

