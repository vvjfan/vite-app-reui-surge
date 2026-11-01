import type { AnalyticsRepository } from "../types"

// LIVE adapter template. This is the seam where the generated demo traffic is
// replaced by real storefront analytics.
//
// The demo seed models the event-tracking approach: the storefront emits events
// via track({ event, actorId, properties }) and a provider aggregates them. So a
// real implementation here does NOT read a database table - it queries whatever
// provider those events were forwarded to, and maps the response onto the same
// key/value shapes the demo adapter returns:
//
//   "sessions-over-time" -> { date, sessions }[]         (provider trend report)
//   "funnel"             -> { step, label, sessions }[]  (provider funnel query)
//   "channel-sessions"   -> { channel, sessions }[]      (break down by UTM source)
//   "device-sessions"    -> { device, sessions }[]
//   "order-attribution"  -> { [orderId]: { channel, device } }
//
// Money metrics are NOT here on purpose: /analytics derives sales, orders and
// AOV from the orders repository at read time, so they always match the store.

const NOT_IMPLEMENTED =
  "Live analytics repository is not implemented. Point src/lib/data/repositories/live/analytics.ts at your analytics provider or keep VITE_DATA_MODE unset to use the demo store."

export const liveAnalyticsRepository: AnalyticsRepository = {
  get: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
}
