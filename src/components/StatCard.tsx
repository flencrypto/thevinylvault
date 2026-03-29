import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: {
    direction: 'up' | 'down'
    value: string
  }
  animate?: boolean
}

export function StatCard({ title, value, subtitle, icon, trend, animate = false }: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : value)

  useEffect(() => {
    if (animate && typeof value === 'number') {
      const duration = 1500
      const steps = 60
      const increment = value / steps
      let current = 0

      const timer = setInterval(() => {
        current += increment
        if (current >= value) {
          setDisplayValue(value)
          clearInterval(timer)
        } else {
          setDisplayValue(Math.floor(current))
        }
      }, duration / steps)

      return () => clearInterval(timer)
    }
  }, [value, animate])

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="luxury-card p-5"
    >
      <div className="flex items-center justify-between pb-2">
        <p
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'oklch(0.55 0.04 55)' }}
        >
          {title}
        </p>
        <div style={{ color: 'oklch(0.65 0.13 60)' }}>
          {icon}
        </div>
      </div>
      <div className="mt-1">
        <div
          className="text-3xl font-bold"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            color: 'oklch(0.95 0.02 70)',
            letterSpacing: '-0.01em',
          }}
        >
          {displayValue}
        </div>
        {subtitle && (
          <p className="text-xs mt-1" style={{ color: 'oklch(0.55 0.04 55)' }}>
            {subtitle}
          </p>
        )}
        {trend && (
          <div
            className="flex items-center gap-1 text-xs mt-2 font-medium"
            style={{ color: trend.direction === 'up' ? 'oklch(0.70 0.17 145)' : 'oklch(0.65 0.20 25)' }}
          >
            <span>{trend.direction === 'up' ? '↑' : '↓'}</span>
            <span>{trend.value}</span>
          </div>
        )}
      </div>
      {/* Gold bottom accent line */}
      <div
        className="absolute bottom-0 left-4 right-4 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, oklch(0.65 0.13 60 / 0.4), transparent)' }}
      />
    </motion.div>
  )
}

