import { Disc } from '@phosphor-icons/react'
import type { ElementType } from 'react'

type TabValue = 'new-listing' | 'collection' | 'bargains' | 'watchlist' | 'comparison' | 'nfts' | 'deals' | 'ebay-dev' | 'agents' | 'settings' | 'setup'

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
    <aside className="flex flex-col w-56 flex-shrink-0 h-screen bg-slate-950/95 border-r border-slate-800 overflow-y-auto">
      {/* Branding */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
        <div className="w-9 h-9 bg-gradient-to-br from-accent to-accent/60 rounded-xl flex items-center justify-center flex-shrink-0">
          <Disc className="w-5 h-5 text-accent-foreground" weight="bold" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-white leading-tight truncate">VinylVault</h1>
          <p className="text-[10px] text-slate-400 truncate leading-tight">
            {envLabel} · {modeLabel}
          </p>
        </div>
      </div>

      {/* Spacer pushes nav to bottom */}
      <div className="flex-1" />

      {/* Nav items pinned to bottom */}
      <nav className="flex flex-col p-2 gap-0.5 border-t border-slate-800">
        {navItems.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => onTabChange(value)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors w-full ${
              activeTab === value
                ? 'bg-slate-800/60 text-accent'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" weight="fill" />
            <span className="text-sm font-medium">{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
