import { TrendUp, TrendDown, Minus } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface TrendIndicatorProps {
  value: number
  threshold?: number
  showIcon?: boolean
  showValue?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TrendIndicator({ 
  value, 
  threshold = 0, 
  showIcon = true, 
  showValue = false,
  size = 'md',
  className 
}: TrendIndicatorProps) {
  const isRising = value > threshold
  const isFalling = value < -threshold
  const isFlat = !isRising && !isFalling

  const iconSize = size === 'sm' ? 14 : size === 'md' ? 16 : 20
  const textSize = size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'

  const colorClass = isRising 
    ? 'text-green-500' 
    : isFalling 
    ? 'text-red-500' 
    : 'text-muted-foreground'

  return (
    <div className={cn('inline-flex items-center gap-1', textSize, colorClass, className)}>
      {showIcon && (
        <>
          {isRising && <TrendUp size={iconSize} weight="bold" />}
          {isFalling && <TrendDown size={iconSize} weight="bold" />}
          {isFlat && <Minus size={iconSize} weight="bold" />}
        </>
      )}
      {showValue && (
        <span className="font-semibold">
          {value > 0 ? '+' : ''}{value.toFixed(1)}%
        </span>
      )}
    </div>
  )
}

interface TrendBadgeProps {
  value: number
  threshold?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TrendBadge({ value, threshold = 0, size = 'md', className }: TrendBadgeProps) {
  const isRising = value > threshold
  const isFalling = value < -threshold
  const isFlat = !isRising && !isFalling

  const iconSize = size === 'sm' ? 12 : size === 'md' ? 14 : 16
  const textSize = size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
  const padding = size === 'sm' ? 'px-2 py-0.5' : size === 'md' ? 'px-2.5 py-1' : 'px-3 py-1.5'

  const bgClass = isRising 
    ? 'bg-green-500/20 text-green-500 border-green-500/30' 
    : isFalling 
    ? 'bg-red-500/20 text-red-500 border-red-500/30' 
    : 'bg-muted/50 text-muted-foreground border-border/50'

  return (
    <div className={cn(
      'inline-flex items-center gap-1 rounded-full border font-semibold',
      textSize,
      padding,
      bgClass,
      className
    )}>
      {isRising && <TrendUp size={iconSize} weight="bold" />}
      {isFalling && <TrendDown size={iconSize} weight="bold" />}
      {isFlat && <Minus size={iconSize} weight="bold" />}
      <span>
        {value > 0 ? '+' : ''}{value.toFixed(1)}%
      </span>
    </div>
  )
}
