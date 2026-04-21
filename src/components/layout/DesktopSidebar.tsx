import type { ElementType } from 'react'
import type { TabValue } from '@/lib/types'
import BrandMark from './BrandMark'

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
        aria-hidden="true"
      />

      {/* Branding */}
      <div
        className="relative px-4 py-5"
        style={{ borderBottom: '1px solid oklch(0.65 0.13 60 / 0.12)' }}
      >
        <BrandMark size="sm" subtitle={`${envLabel} · ${modeLabel}`} />
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

