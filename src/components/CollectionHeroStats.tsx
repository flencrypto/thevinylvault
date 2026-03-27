/**
 * CollectionHeroStats — world-class animated stats hero for the collection view.
 *
 * Shows at a glance:
 *   • Total records in the collection
 *   • Estimated total value with sparkline trend
 *   • Format breakdown (LP / 7" / 12" / EP / Boxset)
 *   • Recent additions count (last 30 days)
 *   • Condition distribution (NM+ ratio)
 *   • Most valuable record callout
 *
 * All numbers animate in on mount using framer-motion counters.
 * Uses GlassCard for the frosted glass aesthetic.
 */

import { useId, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'
import { TrendUp, TrendDown, Disc, Lightning, Star, MusicNote } from '@phosphor-icons/react'
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card'
import { VinylDisc } from '@/components/ui/vinyl-disc'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/helpers'
import { components } from '@/lib/design-tokens'
import type { CollectionItem } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CollectionHeroStatsProps {
  items: CollectionItem[]
  className?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FORMAT_SHORT: Record<string, string> = {
  LP:     'LP',
  '7in':  '7"',
  '12in': '12"',
  EP:     'EP',
  Boxset: 'Box',
}

const GRADE_ORDER = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'F', 'P']

function isNmOrBetter(grade: string): boolean {
  const idx = GRADE_ORDER.indexOf(grade)
  return idx !== -1 && idx <= 1
}

function buildSparklineData(items: CollectionItem[]): Array<{ v: number }> {
  // Build a 12-point trend from priceHistory across the whole collection
  const now = Date.now()
  const buckets: number[] = Array(12).fill(0)
  const counts: number[] = Array(12).fill(0)

  for (const item of items) {
    const history = item.priceHistory ?? []
    for (const entry of history) {
      const ageMs = now - new Date(entry.timestamp).getTime()
      const monthsAgo = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 30))
      if (monthsAgo >= 0 && monthsAgo < 12) {
        const bucket = 11 - monthsAgo
        buckets[bucket] += entry.estimatedValue
        counts[bucket]++
      }
    }
  }

  // Fill empty buckets with interpolated value from neighbours
  const result = buckets.map((b, i) => ({ v: counts[i] > 0 ? b / counts[i] : 0 }))

  // Replace zeros with linear interpolation between known values
  let lastKnown = 0
  for (let i = 0; i < result.length; i++) {
    if (result[i].v > 0) { lastKnown = result[i].v }
    else if (lastKnown > 0) { result[i].v = lastKnown }
  }

  return result
}

// ─── Sub: Animated counter ───────────────────────────────────────────────────

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {prefix}{value.toLocaleString()}{suffix}
    </motion.span>
  )
}

// ─── Sub: Mini sparkline ─────────────────────────────────────────────────────

function MiniSparkline({ data, positive }: { data: Array<{ v: number }>; positive: boolean }) {
  const uid = useId().replace(/:/g, '')
  const gradId = `sparkGrad-${uid}`
  const strokeColor = positive ? 'oklch(0.70 0.18 60)' : 'oklch(0.55 0.22 25)'

  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={strokeColor} stopOpacity={0.5} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={strokeColor}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          isAnimationActive
        />
        <Tooltip
          content={() => null}
          cursor={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CollectionHeroStats({ items, className }: CollectionHeroStatsProps) {
  const stats = useMemo(() => {
    if (!items.length) {
      return {
        total: 0,
        totalValue: 0,
        currency: 'GBP',
        valueTrend: 0,
        formatBreakdown: [] as Array<{ label: string; count: number; pct: number }>,
        recentCount: 0,
        nmRatio: 0,
        topRecord: null as CollectionItem | null,
        sparkline: [] as Array<{ v: number }>,
      }
    }

    // Total value — multiply by quantity so multi-copy items are counted correctly
    const currency = items[0].purchaseCurrency ?? 'GBP'
    const totalValue = items.reduce(
      (sum, i) => sum + (i.estimatedValue?.estimateMid ?? 0) * (i.quantity ?? 1),
      0
    )

    // Value trend: compare last 30 days to 30-60 days ago.
    // Single pass per item avoids sorting intermediate arrays.
    const now = Date.now()
    const { recent30, prev30 } = items.reduce(
      (acc, item) => {
        const history = item.priceHistory ?? []

        let latestRecentTs = -1
        let latestRecentVal = 0
        let latestPrevTs = -1
        let latestPrevVal = 0

        for (const entry of history) {
          const ts  = new Date(entry.timestamp).getTime()
          const age = now - ts
          if (age < 0) continue

          if (age < 30 * MS_PER_DAY) {
            if (ts > latestRecentTs) {
              latestRecentTs  = ts
              latestRecentVal = entry.estimatedValue ?? 0
            }
          } else if (age < 60 * MS_PER_DAY) {
            if (ts > latestPrevTs) {
              latestPrevTs  = ts
              latestPrevVal = entry.estimatedValue ?? 0
            }
          }
        }

        return {
          recent30: acc.recent30 + latestRecentVal,
          prev30:   acc.prev30   + latestPrevVal,
        }
      },
      { recent30: 0, prev30: 0 }
    )
    const valueTrend = prev30 > 0 ? ((recent30 - prev30) / prev30) * 100 : 0

    // Format breakdown
    const formatCounts: Record<string, number> = {}
    for (const item of items) {
      formatCounts[item.format] = (formatCounts[item.format] ?? 0) + 1
    }
    const formatBreakdown = Object.entries(formatCounts)
      .map(([fmt, count]) => ({
        label: FORMAT_SHORT[fmt] ?? fmt,
        count,
        pct: Math.round((count / items.length) * 100),
      }))
      .sort((a, b) => b.count - a.count)

    // Recent additions (last 30 days)
    const recentCount = items.filter(
      i => now - new Date(i.createdAt).getTime() < 30 * MS_PER_DAY
    ).length

    // NM or better ratio
    const nmCount = items.filter(i => isNmOrBetter(i.condition.mediaGrade)).length
    const nmRatio = Math.round((nmCount / items.length) * 100)

    // Top record by estimated value
    const topRecord = items.reduce<CollectionItem | null>((best, i) => {
      const v = i.estimatedValue?.estimateMid ?? 0
      const bv = best?.estimatedValue?.estimateMid ?? 0
      return v > bv ? i : best
    }, null)

    return {
      total: items.length,
      totalValue,
      currency,
      valueTrend,
      formatBreakdown,
      recentCount,
      nmRatio,
      topRecord,
      sparkline: buildSparklineData(items),
    }
  }, [items])

  const trendPositive = stats.valueTrend >= 0

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!items.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={className}
      >
        <GlassCard glow="accent" className="p-8 flex flex-col items-center gap-4 text-center">
          <VinylDisc size="xl" labelText="?" />
          <div>
            <p className="text-lg font-semibold text-foreground">Your collection is empty</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first record to get started.
            </p>
          </div>
        </GlassCard>
      </motion.div>
    )
  }

  // ── Full hero ──────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={className}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">

        {/* ── Card 1: Total records ───────────────────────────────────────── */}
        <GlassCard glow="accent" interactive className="sm:col-span-1">
          <GlassCardContent className="p-5 flex items-center gap-4">
            <div className="shrink-0">
              <VinylDisc
                size="md"
                labelColor={components.vinylDisc.colorLabel}
                labelText={String(stats.total)}
                playing={stats.recentCount > 0}
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Total Records
              </p>
              <p className="text-3xl font-bold text-foreground leading-none mt-1">
                <AnimatedNumber value={stats.total} />
              </p>
              {stats.recentCount > 0 && (
                <Badge variant="outline" className="mt-2 text-xs border-amber-400/40 text-amber-400 gap-1">
                  <Lightning size={10} weight="fill" />
                  +{stats.recentCount} this month
                </Badge>
              )}
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* ── Card 2: Total value + sparkline ────────────────────────────── */}
        <GlassCard glow="primary" interactive className="sm:col-span-1">
          <GlassCardContent className="p-5">
            <div className="flex items-start justify-between mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Collection Value
              </p>
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${trendPositive ? 'text-green-400' : 'text-red-400'}`}>
                {trendPositive
                  ? <TrendUp size={12} weight="bold" />
                  : <TrendDown size={12} weight="bold" />}
                {Math.abs(stats.valueTrend).toFixed(1)}%
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground leading-none">
              <AnimatedNumber
                value={Math.round(stats.totalValue)}
                prefix={stats.currency === 'GBP' ? '£' : stats.currency === 'USD' ? '$' : '€'}
              />
            </p>
            <div className="mt-3 -mx-1">
              <MiniSparkline data={stats.sparkline} positive={trendPositive} />
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* ── Card 3: Format breakdown ────────────────────────────────────── */}
        <GlassCard className="sm:col-span-1">
          <GlassCardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Disc size={14} className="text-accent" weight="fill" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                By Format
              </p>
            </div>
            <div className="space-y-2">
              {stats.formatBreakdown.slice(0, 4).map(({ label, count, pct }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-7 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-7 text-right shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* ── Card 4: Highlights ─────────────────────────────────────────── */}
        <GlassCard className="sm:col-span-1">
          <GlassCardContent className="p-5 space-y-4">
            {/* NM ratio */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star size={14} className="text-amber-400" weight="fill" />
                <span className="text-xs text-muted-foreground">NM+ condition</span>
              </div>
              <span className="text-sm font-bold text-foreground">{stats.nmRatio}%</span>
            </div>

            {/* Separator */}
            <div className="h-px bg-border/50" />

            {/* Top record */}
            {stats.topRecord && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <MusicNote size={14} className="text-accent" weight="fill" />
                  <span className="text-xs text-muted-foreground">Top Record</span>
                </div>
                <p className="text-sm font-semibold text-foreground truncate leading-tight">
                  {stats.topRecord.releaseTitle}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {stats.topRecord.artistName}
                </p>
                <p className="text-xs font-bold text-accent mt-1">
                  {formatCurrency(
                    stats.topRecord.estimatedValue?.estimateMid ?? 0,
                    stats.topRecord.purchaseCurrency,
                  )}
                </p>
              </div>
            )}
          </GlassCardContent>
        </GlassCard>

      </div>
    </motion.div>
  )
}
