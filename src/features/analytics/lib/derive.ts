import type {
  ChannelSessions,
  OrderAttribution,
  SessionsDatum,
  TrafficChannel,
} from "@/lib/data/analytics"
import { isSale, type Order } from "@/lib/data/types"

// Read-time joins. Every money figure is computed from the live orders here and
// never seeded, mirroring the customers feature's buildCustomerRows: an
// optimistic order mutation updates these instantly and cannot desync.
//
// Cancelled orders: excluded from money (sales, AOV) the same way
// customerAggregates excludes them from totalSpent, but still counted as
// conversions, because the session did place an order before it was cancelled.
// Orders placed and net sales are deliberately two different counts.

const DAY_MS = 86_400_000

export interface AnalyticsOverview {
  sales: number
  orders: number
  sessions: number
  conversionRate: number
  aov: number
}

export function overview(
  orders: Order[],
  sessions: SessionsDatum[]
): AnalyticsOverview {
  const sold = orders.filter(isSale)
  const sales = sold.reduce((sum, order) => sum + order.totals.total, 0)
  const sessionCount = sessions.reduce((sum, day) => sum + day.sessions, 0)
  return {
    sales,
    orders: orders.length,
    sessions: sessionCount,
    conversionRate: sessionCount > 0 ? (orders.length / sessionCount) * 100 : 0,
    aov: sold.length > 0 ? sales / sold.length : 0,
  }
}

/**
 * Period-over-period change, so the KPI and chart badges carry a real trend
 * instead of the hardcoded percentages the blocks ship with. Compares the last
 * `days` of the window against the `days` before it, both anchored to the data.
 */
export interface AnalyticsDeltas {
  sales: number
  orders: number
  sessions: number
  conversionRate: number
}

export function deltas(
  orders: Order[],
  sessions: SessionsDatum[],
  days = 30
): AnalyticsDeltas {
  if (sessions.length === 0)
    return { sales: 0, orders: 0, sessions: 0, conversionRate: 0 }

  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const endMs = new Date(
    `${sorted[sorted.length - 1].date}T23:59:59.999Z`
  ).getTime()
  const midMs = endMs - days * DAY_MS
  const startMs = midMs - days * DAY_MS

  const slice = (fromMs: number, toMs: number) => {
    const windowOrders = orders.filter((order) => {
      const ms = new Date(order.date).getTime()
      return ms > fromMs && ms <= toMs
    })
    const windowSessions = sorted
      .filter((day) => {
        const ms = new Date(`${day.date}T12:00:00.000Z`).getTime()
        return ms > fromMs && ms <= toMs
      })
      .reduce((sum, day) => sum + day.sessions, 0)
    const sales = windowOrders
      .filter(isSale)
      .reduce((sum, order) => sum + order.totals.total, 0)
    return {
      sales,
      orders: windowOrders.length,
      sessions: windowSessions,
      conversionRate:
        windowSessions > 0 ? (windowOrders.length / windowSessions) * 100 : 0,
    }
  }

  const previous = slice(startMs, midMs)
  const current = slice(midMs, endMs)
  const change = (now: number, before: number) =>
    before > 0 ? ((now - before) / before) * 100 : 0

  return {
    sales: change(current.sales, previous.sales),
    orders: change(current.orders, previous.orders),
    sessions: change(current.sessions, previous.sessions),
    conversionRate: change(current.conversionRate, previous.conversionRate),
  }
}

export interface SalesVsSessionsDatum {
  period: string
  sales: number
  views: number
}

/**
 * Weekly buckets of sales (from the real orders) against sessions (generated).
 * Weeks rather than days: 48 orders over 65 days leaves most days empty.
 */
export function salesVsSessions(
  orders: Order[],
  sessions: SessionsDatum[],
  weeks = 9
): SalesVsSessionsDatum[] {
  if (sessions.length === 0) return []

  const days = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const endMs = new Date(
    `${days[days.length - 1].date}T00:00:00.000Z`
  ).getTime()
  const startMs = endMs - (weeks * 7 - 1) * DAY_MS

  const buckets = Array.from({ length: weeks }, (_, index) => {
    const from = startMs + index * 7 * DAY_MS
    return { from, to: from + 7 * DAY_MS, sales: 0, views: 0 }
  })

  const bucketFor = (ms: number) => {
    const index = Math.floor((ms - startMs) / (7 * DAY_MS))
    return index >= 0 && index < buckets.length ? buckets[index] : undefined
  }

  for (const day of days) {
    const bucket = bucketFor(new Date(`${day.date}T00:00:00.000Z`).getTime())
    if (bucket) bucket.views += day.sessions
  }
  for (const order of orders) {
    if (!isSale(order)) continue
    const bucket = bucketFor(new Date(order.date).getTime())
    if (bucket) bucket.sales += order.totals.total
  }

  return buckets.map((bucket, index) => ({
    period: `Week ${index + 1}`,
    sales: Math.round(bucket.sales),
    views: bucket.views,
  }))
}

// Per-category rollups are the DASHBOARD's (features/dashboard/derive.ts):
// velocityByCategory for units, topCategories for revenue, both grouped through
// OrderLine.productId. This module used to carry its own copy for the category
// chart; the chart now reads the dashboard's, so the two pages cannot report
// different numbers for the same catalog. Add category views there, not here.

export interface ChannelPerformance {
  channel: TrafficChannel
  sessions: number
  orders: number
  revenue: number
  conversionRate: number
  aov: number
}

/**
 * Top channel performance: generated session counts joined to the
 * REAL orders through the per-order attribution map, so revenue per channel
 * always sums to net sales even after an order is edited or deleted.
 */
export function channelPerformance(
  orders: Order[],
  attribution: OrderAttribution,
  channels: ChannelSessions[]
): ChannelPerformance[] {
  const revenue = new Map<TrafficChannel, number>()
  const counts = new Map<TrafficChannel, number>()

  for (const order of orders) {
    const channel = attribution[order.id]?.channel
    if (!channel) continue
    counts.set(channel, (counts.get(channel) ?? 0) + 1)
    if (isSale(order)) {
      revenue.set(channel, (revenue.get(channel) ?? 0) + order.totals.total)
    }
  }

  return channels
    .map(({ channel, sessions }) => {
      const orderCount = counts.get(channel) ?? 0
      const channelRevenue = revenue.get(channel) ?? 0
      return {
        channel,
        sessions,
        orders: orderCount,
        revenue: Math.round(channelRevenue),
        conversionRate: sessions > 0 ? (orderCount / sessions) * 100 : 0,
        aov: orderCount > 0 ? channelRevenue / orderCount : 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}
