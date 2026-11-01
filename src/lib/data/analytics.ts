import { ORDERS } from "./orders"
import { mulberry32 } from "./seed-utils"

// Storefront analytics, modelled as an event-tracking seam rather than a
// built-in reporting engine.
//
// A headless backend owns no storefront, so it cannot measure traffic itself.
// It exposes a track({ event, actorId, properties }) seam instead, forwards the
// events to an analytics provider, and the reporting lives there. This admin
// has no storefront either, so the event stream below is generated, not
// observed.
//
// What is NOT invented: every money figure on /analytics derives at read time
// from the real ORDERS entity. Only the traffic side (sessions, funnel,
// channels) comes from here, and each of the 48 real orders gets a converting
// session carrying its real order id, so conversion rate = real orders /
// generated sessions.
//
// We persist AGGREGATES, not the raw stream: a real dashboard queries its
// provider for aggregates, it never ships millions of raw events to the browser.
// The live adapter (repositories/live/analytics.ts) is where you swap this for
// a real provider query.

// ── Types (the track() event shape) ──

export type AnalyticsEventName =
  | "page_viewed"
  | "product_viewed"
  | "cart_updated"
  | "checkout_started"
  | "order_placed"

export type TrafficChannel =
  "direct" | "organic" | "paid" | "social" | "email" | "referral"

export type DeviceType = "desktop" | "mobile" | "tablet"

export interface AnalyticsEvent {
  id: string
  event: AnalyticsEventName
  /** The Customer handle, or null for an anonymous visitor. */
  actorId: string | null
  /** Analytics providers key anonymous traffic by an anonymous id; this is it. */
  sessionId: string
  /** ISO 8601, UTC. */
  timestamp: string
  properties: {
    channel: TrafficChannel
    device: DeviceType
    /** Present only on order_placed; references a real Order.id. */
    orderId?: string
  }
}

// ── Aggregate shapes (what the page actually reads) ──

export interface SessionsDatum {
  /** UTC calendar day, YYYY-MM-DD. */
  date: string
  sessions: number
}

/**
 * One week of the conversion funnel. The four stages are the standard commerce
 * funnel (sessions, added to cart, reached checkout, converted) rather than
 * every tracked event: product_viewed is measured but not charted, because the
 * funnel a merchant acts on is the path to a purchase.
 */
export interface FunnelPoint {
  period: string
  sessions: number
  addedToCart: number
  reachedCheckout: number
  converted: number
}

export interface ChannelSessions {
  channel: TrafficChannel
  sessions: number
}

/** orderId -> where that order's session came from. Keyed by id, never
 *  pre-summed, so channel revenue joins to live orders and cannot desync.
 *  Sparse: only orders that came from a tracked session have an entry, so a
 *  lookup can miss and callers must handle undefined. */
export type OrderAttribution = Record<
  string,
  { channel: TrafficChannel; device: DeviceType } | undefined
>

export interface AnalyticsRecord {
  key: string
  value: unknown
}

export const ANALYTICS_KEYS = {
  sessionsOverTime: "sessions-over-time",
  funnel: "funnel",
  channelSessions: "channel-sessions",
  orderAttribution: "order-attribution",
} as const

/**
 * Weighted pick: entries are [value, weight]. Local on purpose - the canonical
 * `pick` in seed-utils is uniform, and nothing else needs a weighted draw.
 */
function weighted<T>(rng: () => number, entries: readonly [T, number][]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let r = rng() * total
  for (const [value, w] of entries) {
    r -= w
    if (r <= 0) return value
  }
  return entries[entries.length - 1][0]
}

// Channel mix roughly matching a small DTC store: organic and direct lead,
// paid and email convert above their share.
const CHANNEL_WEIGHTS: readonly [TrafficChannel, number][] = [
  ["organic", 32],
  ["direct", 24],
  ["paid", 18],
  ["social", 12],
  ["email", 9],
  ["referral", 5],
]

const DEVICE_WEIGHTS: readonly [DeviceType, number][] = [
  ["mobile", 58],
  ["desktop", 34],
  ["tablet", 8],
]

const FUNNEL_ORDER: readonly AnalyticsEventName[] = [
  "page_viewed",
  "product_viewed",
  "cart_updated",
  "checkout_started",
  "order_placed",
]

// ── The window: taken from the real orders, never from Date.now() ──
//
// The orders seed walks back from a fixed base, so a window computed from the
// wall clock would drift off the data and render an empty page. Everything here
// is anchored to the orders themselves.

const ORDER_TIMES = ORDERS.map((order) => new Date(order.date).getTime())
export const ANALYTICS_WINDOW_START_MS = Math.min(...ORDER_TIMES)
export const ANALYTICS_WINDOW_END_MS = Math.max(...ORDER_TIMES)

const DAY_MS = 86_400_000
const MINUTE_MS = 60_000

/**
 * Total sessions. 48 real orders against this count lands conversion at ~2.8%,
 * which is a realistic DTC storefront rate.
 */
const SESSION_COUNT = 1_700

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

// ── Generator ──

function convertingSessions(): AnalyticsEvent[] {
  const events: AnalyticsEvent[] = []

  ORDERS.forEach((order, index) => {
    const rng = mulberry32((0x9e3779b9 + index * 2654435761) >>> 0)
    const channel = weighted(rng, CHANNEL_WEIGHTS)
    const device = weighted(rng, DEVICE_WEIGHTS)
    const sessionId = `ses-ord-${order.id}`
    const placedMs = new Date(order.date).getTime()

    // Walk the funnel backwards from the order: the visit started a few minutes
    // before the purchase.
    FUNNEL_ORDER.forEach((event, step) => {
      const offset =
        (FUNNEL_ORDER.length - 1 - step) * (2 + rng() * 6) * MINUTE_MS
      events.push({
        id: `evt-${sessionId}-${step}`,
        event,
        actorId: order.customer.handle,
        sessionId,
        timestamp: new Date(placedMs - offset).toISOString(),
        properties: {
          channel,
          device,
          ...(event === "order_placed" ? { orderId: order.id } : {}),
        },
      })
    })
  })

  return events
}

function browsingSessions(): AnalyticsEvent[] {
  const events: AnalyticsEvent[] = []
  const count = SESSION_COUNT - ORDERS.length

  for (let index = 0; index < count; index++) {
    const rng = mulberry32((0x85ebca6b + index * 1597334677) >>> 0)
    const channel = weighted(rng, CHANNEL_WEIGHTS)
    const device = weighted(rng, DEVICE_WEIGHTS)
    const sessionId = `ses-${String(index + 1).padStart(5, "0")}`

    // Traffic has to track sales, or the store reads as if it took thousands of
    // visits in a week with no orders. The orders seed is deliberately uneven
    // (it ramps up over the window), so anchor each browsing session near a real
    // order and jitter it, rather than spreading sessions uniformly. That keeps
    // conversion roughly steady across the window, the way a real store behaves.
    const anchor = ORDER_TIMES[Math.floor(rng() * ORDER_TIMES.length)]
    const jitter = (rng() - 0.5) * 8 * DAY_MS
    const startMs = Math.min(
      Math.max(anchor + jitter, ANALYTICS_WINDOW_START_MS),
      ANALYTICS_WINDOW_END_MS
    )

    // How deep this visit got before dropping out. Tuned so the funnel reads
    // like a real storefront: most sessions never reach a product page.
    const depth = weighted(rng, [
      [1, 45], // bounced on the landing page
      [2, 33], // viewed a product
      [3, 15], // added to cart
      [4, 7], // reached checkout, then abandoned
    ])

    for (let step = 0; step < depth; step++) {
      events.push({
        id: `evt-${sessionId}-${step}`,
        event: FUNNEL_ORDER[step],
        actorId: null,
        sessionId,
        timestamp: new Date(
          startMs + step * (1 + rng() * 4) * MINUTE_MS
        ).toISOString(),
        properties: { channel, device },
      })
    }
  }

  return events
}

/**
 * The full generated event stream. Exported for transparency and tests: the
 * page never reads it, it reads the aggregates below.
 */
export const ANALYTICS_EVENTS: AnalyticsEvent[] = [
  ...convertingSessions(),
  ...browsingSessions(),
]

// ── Aggregation (runs once at module load, the way a provider would) ──

type SessionMeta = {
  channel: TrafficChannel
  device: DeviceType
  firstMs: number
  reached: Set<AnalyticsEventName>
  orderId?: string
}

function sessionIndex(events: AnalyticsEvent[]): Map<string, SessionMeta> {
  const sessions = new Map<string, SessionMeta>()
  for (const event of events) {
    const ms = new Date(event.timestamp).getTime()
    let meta = sessions.get(event.sessionId)
    if (!meta) {
      meta = {
        channel: event.properties.channel,
        device: event.properties.device,
        firstMs: ms,
        reached: new Set(),
      }
      sessions.set(event.sessionId, meta)
    }
    meta.firstMs = Math.min(meta.firstMs, ms)
    meta.reached.add(event.event)
    if (event.properties.orderId) meta.orderId = event.properties.orderId
  }
  return sessions
}

const SESSIONS = sessionIndex(ANALYTICS_EVENTS)

function buildSessionsOverTime(): SessionsDatum[] {
  const byDay = new Map<string, number>()
  // Pre-fill every day in the window so the series has no gaps.
  for (
    let ms = ANALYTICS_WINDOW_START_MS;
    ms <= ANALYTICS_WINDOW_END_MS;
    ms += DAY_MS
  ) {
    byDay.set(utcDay(ms), 0)
  }
  for (const meta of SESSIONS.values()) {
    const day = utcDay(meta.firstMs)
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
  }
  return [...byDay.entries()]
    .map(([date, sessions]) => ({ date, sessions }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** The funnel bucketed by week, so it can be charted over time. */
function buildFunnelOverTime(): FunnelPoint[] {
  const weekMs = 7 * DAY_MS
  const weeks = Math.max(
    1,
    Math.ceil((ANALYTICS_WINDOW_END_MS - ANALYTICS_WINDOW_START_MS) / weekMs)
  )
  const buckets: FunnelPoint[] = Array.from({ length: weeks }, (_, index) => ({
    period: `Week ${index + 1}`,
    sessions: 0,
    addedToCart: 0,
    reachedCheckout: 0,
    converted: 0,
  }))

  for (const meta of SESSIONS.values()) {
    // Clamp both ends: a converting session's first event fires a few minutes
    // BEFORE its order, so the earliest order's session starts just outside the
    // window and would otherwise be dropped from the funnel.
    const index = Math.min(
      weeks - 1,
      Math.max(
        0,
        Math.floor((meta.firstMs - ANALYTICS_WINDOW_START_MS) / weekMs)
      )
    )
    const bucket = buckets[index]
    bucket.sessions += 1
    if (meta.reached.has("cart_updated")) bucket.addedToCart += 1
    if (meta.reached.has("checkout_started")) bucket.reachedCheckout += 1
    if (meta.reached.has("order_placed")) bucket.converted += 1
  }

  return buckets
}

function buildChannelSessions(): ChannelSessions[] {
  const counts = new Map<TrafficChannel, number>()
  for (const [channel] of CHANNEL_WEIGHTS) counts.set(channel, 0)
  for (const meta of SESSIONS.values()) {
    counts.set(meta.channel, (counts.get(meta.channel) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([channel, sessions]) => ({ channel, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
}

function buildOrderAttribution(): OrderAttribution {
  const attribution: OrderAttribution = {}
  for (const meta of SESSIONS.values()) {
    if (!meta.orderId) continue
    attribution[meta.orderId] = { channel: meta.channel, device: meta.device }
  }
  return attribution
}

export const SESSIONS_OVER_TIME: SessionsDatum[] = buildSessionsOverTime()
export const ANALYTICS_FUNNEL: FunnelPoint[] = buildFunnelOverTime()
export const CHANNEL_SESSIONS: ChannelSessions[] = buildChannelSessions()
export const ORDER_ATTRIBUTION: OrderAttribution = buildOrderAttribution()

export const ANALYTICS_SEED: AnalyticsRecord[] = [
  { key: ANALYTICS_KEYS.sessionsOverTime, value: SESSIONS_OVER_TIME },
  { key: ANALYTICS_KEYS.funnel, value: ANALYTICS_FUNNEL },
  { key: ANALYTICS_KEYS.channelSessions, value: CHANNEL_SESSIONS },
  { key: ANALYTICS_KEYS.orderAttribution, value: ORDER_ATTRIBUTION },
]
