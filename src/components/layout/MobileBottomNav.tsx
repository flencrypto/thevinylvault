import type { ElementType } from 'react'
import type { TabValue } from '@/lib/types'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
    <nav
      className="flex-shrink-0 pb-safe-area-inset-bottom"
      style={{
        background: 'oklch(0.09 0.01 35 / 0.94)',
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        borderTop: '1px solid oklch(0.65 0.13 60 / 0.18)',
        boxShadow: '0 -1px 20px oklch(0 0 0 / 0.5)',
      }}
    >
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as TabValue)}>
        <TabsList className="w-full min-h-[64px] grid grid-cols-11 bg-transparent border-0 p-0 gap-0">
          {navItems.map(({ value, icon: Icon, label }) => {
            const isActive = activeTab === value
            return (
              <TabsTrigger
                key={value}
                value={value}
                className="relative flex-col gap-1 h-full min-h-[64px] rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none border-0 px-0.5 sm:px-1 touch-manipulation active:scale-95 transition-all duration-200"
                style={{ color: isActive ? 'oklch(0.80 0.11 70)' : 'oklch(0.50 0.03 55)' }}
              >
                {/* Active gold top indicator */}
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-full transition-all duration-300"
                  style={{
                    height: '2px',
                    width: isActive ? '24px' : '0px',
                    background: isActive ? 'linear-gradient(90deg, oklch(0.65 0.13 60), oklch(0.80 0.11 70))' : 'transparent',
                    boxShadow: isActive ? '0 0 8px oklch(0.65 0.13 60 / 0.8)' : 'none',
                  }}
                />
                <Icon
                  className="w-5 h-5 sm:w-[22px] sm:h-[22px] transition-all duration-200"
                  weight={isActive ? 'fill' : 'regular'}
                  style={isActive ? { filter: 'drop-shadow(0 0 4px oklch(0.80 0.11 70 / 0.7))' } : {}}
                />
                <span className="text-[9px] sm:text-[10px] leading-tight font-medium">{label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>
    </nav>
  )
}

