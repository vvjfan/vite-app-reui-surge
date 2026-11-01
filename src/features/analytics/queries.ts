import { queryOptions } from "@tanstack/react-query"

import {
  ANALYTICS_KEYS,
  type ChannelSessions,
  type FunnelPoint,
  type OrderAttribution,
  type SessionsDatum,
} from "@/lib/data/analytics"
import { analyticsRepository } from "@/lib/data/repositories"

// Read-only traffic datasets, one query per key. No `initialData`: the UI reads
// only from the store, so every panel shows a skeleton until the read settles.
// Money metrics are NOT here - they derive from ordersListQuery at read time
// (see ./lib/derive.ts), so they always match the orders entity.

const analyticsQuery = <T>(key: string) =>
  queryOptions({
    queryKey: ["analytics", key] as const,
    queryFn: () => analyticsRepository.get<T>(key),
    staleTime: 0,
  })

export const sessionsOverTimeQuery = () =>
  analyticsQuery<SessionsDatum[]>(ANALYTICS_KEYS.sessionsOverTime)

export const analyticsFunnelQuery = () =>
  analyticsQuery<FunnelPoint[]>(ANALYTICS_KEYS.funnel)

export const channelSessionsQuery = () =>
  analyticsQuery<ChannelSessions[]>(ANALYTICS_KEYS.channelSessions)

export const orderAttributionQuery = () =>
  analyticsQuery<OrderAttribution>(ANALYTICS_KEYS.orderAttribution)
