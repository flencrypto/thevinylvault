import type { ElementType } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type TabValue = 'new-listing' | 'collection' | 'bargains' | 'watchlist' | 'comparison' | 'nfts' | 'deals' | 'ebay-dev' | 'agents' | 'settings' | 'setup'

interface NavItem {
  value: TabValue
  icon: ElementType
  label: string
}

interface MobileBottomNavProps {
  navItems: readonly NavItem[]
  activeTab: TabValue
  onTabChange: (tab: TabValue) => void
}

export default function MobileBottomNav({ navItems, activeTab, onTabChange }: MobileBottomNavProps) {
  return (
    <nav className="flex-shrink-0 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 pb-safe-area-inset-bottom">
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as TabValue)}>
        <TabsList className="w-full min-h-[64px] grid grid-cols-11 bg-transparent border-0 p-0 gap-0">
          {navItems.map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-col gap-0.5 h-full min-h-[64px] rounded-none data-[state=active]:bg-slate-800/50 data-[state=active]:text-accent border-0 px-0.5 sm:px-1 touch-manipulation active:scale-95 transition-transform"
            >
              <Icon className="w-5 h-5 sm:w-6 sm:h-6" weight="fill" />
              <span className="text-[9px] sm:text-[10px] leading-tight">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </nav>
  )
}
