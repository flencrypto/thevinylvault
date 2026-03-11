import { ScheduledScan } from '@/components/ScanScheduleDialog'
import { searchAllMarketplaces, MarketplaceConfig } from '@/lib/marketplace-scanner'
import { analyzeBargain } from '@/lib/bargain-detection-ai'
import { BargainCard } from '@/lib/types'

export class ScanSchedulerService {
  private checkInterval: number | null = null
  private readonly CHECK_FREQUENCY_MS = 60000

  constructor() {
    this.startScheduler = this.startScheduler.bind(this)
    this.stopScheduler = this.stopScheduler.bind(this)
    this.checkSchedules = this.checkSchedules.bind(this)
  }

  startScheduler() {
    if (this.checkInterval !== null) {
      return
    }

    this.checkSchedules()
    
    this.checkInterval = window.setInterval(() => {
      this.checkSchedules()
    }, this.CHECK_FREQUENCY_MS)

    console.log('[ScanScheduler] Started')
  }

  stopScheduler() {
    if (this.checkInterval !== null) {
      window.clearInterval(this.checkInterval)
      this.checkInterval = null
      console.log('[ScanScheduler] Stopped')
    }
  }

  private async checkSchedules() {
    try {
      const schedulesJson = await spark.kv.get<ScheduledScan[]>('scan-schedules')
      
      if (!schedulesJson || schedulesJson.length === 0) {
        return
      }

      const now = new Date()

      for (const schedule of schedulesJson) {
        if (!schedule.enabled) {
          continue
        }

        if (this.shouldRunNow(schedule, now)) {
          console.log(`[ScanScheduler] Running scheduled scan: ${schedule.name}`)
          await this.executeScheduledScan(schedule)
          await this.updateLastRun(schedule, now)
        }
      }
    } catch (error) {
      console.error('[ScanScheduler] Error checking schedules:', error)
    }
  }

  private shouldRunNow(schedule: ScheduledScan, now: Date): boolean {
    if (!schedule.nextRun) {
      return false
    }

    const nextRun = new Date(schedule.nextRun)
    
    if (now < nextRun) {
      return false
    }

    if (schedule.lastRun) {
      const lastRun = new Date(schedule.lastRun)
      const timeSinceLastRun = now.getTime() - lastRun.getTime()
      const oneHourMs = 60 * 60 * 1000
      
      if (timeSinceLastRun < oneHourMs) {
        return false
      }
    }

    return this.matchesScheduleDay(schedule, now)
  }

  private matchesScheduleDay(schedule: ScheduledScan, now: Date): boolean {
    const dayOfWeek = now.getDay()

    if (schedule.frequency === 'daily') {
      return true
    }

    if (schedule.frequency === 'weekdays') {
      return dayOfWeek >= 1 && dayOfWeek <= 5
    }

    if (schedule.frequency === 'weekends') {
      return dayOfWeek === 0 || dayOfWeek === 6
    }

    if (schedule.frequency === 'custom' && schedule.daysOfWeek) {
      return schedule.daysOfWeek.includes(dayOfWeek)
    }

    return false
  }

  private async executeScheduledScan(schedule: ScheduledScan) {
    try {
      const apiKeys = await spark.kv.get<any>('vinyl-vault-api-keys')
      
      if (!apiKeys) {
        console.warn(`[ScanScheduler] No API keys found for scan: ${schedule.name}`)
        return
      }

      const enabledSources: Array<'ebay' | 'discogs'> = []
      const config: MarketplaceConfig = {
        enabledSources: [],
      }

      if (schedule.includeEbay && apiKeys.ebayClientId) {
        enabledSources.push('ebay')
        config.ebay = { appId: apiKeys.ebayClientId }
      }

      if (schedule.includeDiscogs && apiKeys.discogsUserToken) {
        enabledSources.push('discogs')
        config.discogs = { userToken: apiKeys.discogsUserToken }
      }

      if (enabledSources.length === 0) {
        console.warn(`[ScanScheduler] No enabled sources for scan: ${schedule.name}`)
        return
      }

      config.enabledSources = enabledSources

      const listings = await searchAllMarketplaces(
        schedule.searchQuery,
        config,
        {
          maxPrice: schedule.maxPrice,
          maxResults: schedule.maxResults,
        }
      )

      console.log(`[ScanScheduler] Found ${listings.length} listings for scan: ${schedule.name}`)

      const discogsConfig = apiKeys.discogsUserToken ? { userToken: apiKeys.discogsUserToken } : undefined
      const existingBargains = await spark.kv.get<BargainCard[]>('bargains') || []
      let newBargainsFound = 0

      for (const listing of listings) {
        try {
          const analysis = await analyzeBargain({
            listing,
            discogsConfig,
            useDiscogsPricing: !!apiKeys.discogsUserToken,
          })

          if (analysis.bargainScore >= schedule.minScore) {
            const existingBargain = existingBargains.find(
              b => b.listing.externalId === listing.externalId
            )

            if (!existingBargain) {
              existingBargains.unshift({
                id: `bargain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                listing,
                bargainScore: analysis.bargainScore,
                estimatedValue: analysis.estimatedValue,
                estimatedUpside: analysis.estimatedUpside,
                signals: analysis.signals || [],
                savedAt: new Date().toISOString(),
                viewed: false,
              })
              newBargainsFound++
            }
          }
        } catch (error) {
          console.error(`[ScanScheduler] Error analyzing listing:`, error)
        }
      }

      if (newBargainsFound > 0) {
        await spark.kv.set('bargains', existingBargains)
        console.log(`[ScanScheduler] Added ${newBargainsFound} new bargains from scan: ${schedule.name}`)
        
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('VinylVault - New Bargains Found!', {
            body: `Found ${newBargainsFound} new bargains from "${schedule.name}"`,
            icon: '/icon-192.png',
            tag: 'vinyl-vault-bargains',
          })
        }
      }

    } catch (error) {
      console.error(`[ScanScheduler] Error executing scan "${schedule.name}":`, error)
    }
  }

  private async updateLastRun(schedule: ScheduledScan, now: Date) {
    try {
      const schedules = await spark.kv.get<ScheduledScan[]>('scan-schedules')
      
      if (!schedules) return

      const updatedSchedules = schedules.map(s => {
        if (s.id === schedule.id) {
          return {
            ...s,
            lastRun: now.toISOString(),
            nextRun: this.calculateNextRun(s, now),
          }
        }
        return s
      })

      await spark.kv.set('scan-schedules', updatedSchedules)
    } catch (error) {
      console.error('[ScanScheduler] Error updating last run:', error)
    }
  }

  private calculateNextRun(schedule: ScheduledScan, fromDate: Date): string {
    const [hours, minutes] = schedule.time.split(':').map(Number)
    
    let nextRun = new Date(fromDate)
    nextRun.setHours(hours, minutes, 0, 0)

    nextRun.setDate(nextRun.getDate() + 1)

    if (schedule.frequency === 'weekdays') {
      while (nextRun.getDay() === 0 || nextRun.getDay() === 6) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
    } else if (schedule.frequency === 'weekends') {
      while (nextRun.getDay() !== 0 && nextRun.getDay() !== 6) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
    } else if (schedule.frequency === 'custom' && schedule.daysOfWeek) {
      while (!schedule.daysOfWeek.includes(nextRun.getDay())) {
        nextRun.setDate(nextRun.getDate() + 1)
      }
    }

    return nextRun.toISOString()
  }
}

export const scanSchedulerService = new ScanSchedulerService()
