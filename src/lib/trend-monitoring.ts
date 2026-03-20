import { CollectionItem, TrendAlert, TrendAlertType, TrendAlertSeverity } from './types'

interface TrendAlertThresholds {
  significantGainPercent: number
  significantLossPercent: number
  criticalGainPercent: number
  criticalLossPercent: number
  rapidChangeWindow: number
}

const DEFAULT_THRESHOLDS: TrendAlertThresholds = {
  significantGainPercent: 15,
  significantLossPercent: 15,
  criticalGainPercent: 30,
  criticalLossPercent: 30,
  rapidChangeWindow: 7,
}

export function generateTrendAlerts(
  items: CollectionItem[],
  existingAlerts: TrendAlert[] = [],
  thresholds: TrendAlertThresholds = DEFAULT_THRESHOLDS
): TrendAlert[] {
  const newAlerts: TrendAlert[] = []
  const now = new Date().toISOString()

  items.forEach((item) => {
    if (!item.priceHistory || item.priceHistory.length < 2) {
      return
    }

    const sortedHistory = [...item.priceHistory].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    const currentEntry = sortedHistory[sortedHistory.length - 1]
    const previousEntry = sortedHistory[sortedHistory.length - 2]
    const currentValue = currentEntry.estimatedValue
    const previousValue = previousEntry.estimatedValue
    const changeAmount = currentValue - previousValue
    const changePercent = (changeAmount / previousValue) * 100

    const alertAlreadyExists = existingAlerts.some(
      (alert) =>
        alert.itemId === item.id &&
        !alert.dismissed &&
        Math.abs(alert.currentValue - currentValue) < 0.01
    )

    if (alertAlreadyExists) {
      return
    }

    let alertType: TrendAlertType | null = null
    let severity: TrendAlertSeverity = 'low'
    let message = ''

    const isRapidChange =
      new Date(currentEntry.timestamp).getTime() -
        new Date(previousEntry.timestamp).getTime() <
      thresholds.rapidChangeWindow * 24 * 60 * 60 * 1000

    if (changePercent >= thresholds.criticalGainPercent) {
      alertType = isRapidChange ? 'rapid_increase' : 'significant_gain'
      severity = 'critical'
      message = `${item.artistName} - ${item.releaseTitle} has gained ${changePercent.toFixed(1)}% in value! Now worth ${formatCurrency(currentValue, item.purchaseCurrency)}.`
    } else if (changePercent >= thresholds.significantGainPercent) {
      alertType = isRapidChange ? 'rapid_increase' : 'significant_gain'
      severity = 'high'
      message = `${item.artistName} - ${item.releaseTitle} is up ${changePercent.toFixed(1)}%. Current value: ${formatCurrency(currentValue, item.purchaseCurrency)}.`
    } else if (changePercent <= -thresholds.criticalLossPercent) {
      alertType = isRapidChange ? 'rapid_decrease' : 'significant_loss'
      severity = 'critical'
      message = `${item.artistName} - ${item.releaseTitle} has lost ${Math.abs(changePercent).toFixed(1)}% in value. Now ${formatCurrency(currentValue, item.purchaseCurrency)}.`
    } else if (changePercent <= -thresholds.significantLossPercent) {
      alertType = isRapidChange ? 'rapid_decrease' : 'significant_loss'
      severity = 'high'
      message = `${item.artistName} - ${item.releaseTitle} is down ${Math.abs(changePercent).toFixed(1)}%. Current value: ${formatCurrency(currentValue, item.purchaseCurrency)}.`
    }

    const milestoneValues = [100, 250, 500, 1000, 2500, 5000, 10000]
    const crossedMilestone = milestoneValues.find(
      (milestone) =>
        previousValue < milestone && currentValue >= milestone
    )

    if (crossedMilestone && !alertType) {
      alertType = 'milestone_reached'
      severity = crossedMilestone >= 1000 ? 'high' : 'medium'
      message = `${item.artistName} - ${item.releaseTitle} has crossed the ${formatCurrency(crossedMilestone, item.purchaseCurrency)} milestone!`
    }

    if (alertType) {
      newAlerts.push({
        id: `alert-${item.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        itemId: item.id,
        itemTitle: item.releaseTitle,
        artistName: item.artistName,
        type: alertType,
        severity,
        message,
        previousValue,
        currentValue,
        changeAmount,
        changePercent,
        currency: item.purchaseCurrency,
        createdAt: now,
        read: false,
        dismissed: false,
      })
    }
  })

  return newAlerts
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency
  return `${symbol}${amount.toFixed(2)}`
}

export function getTrendAlertSummary(alerts: TrendAlert[]) {
  const summary = {
    total: 0,
    unread: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    gains: 0,
    losses: 0,
  }

  for (const a of alerts) {
    if (a.dismissed) continue
    summary.total++
    if (!a.read) summary.unread++
    if (a.severity === 'critical') summary.critical++
    else if (a.severity === 'high') summary.high++
    else if (a.severity === 'medium') summary.medium++
    else if (a.severity === 'low') summary.low++
    if (a.type === 'significant_gain' || a.type === 'rapid_increase') summary.gains++
    if (a.type === 'significant_loss' || a.type === 'rapid_decrease') summary.losses++
  }

  return summary
}
