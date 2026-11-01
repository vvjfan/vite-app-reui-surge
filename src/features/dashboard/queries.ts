import { queryOptions } from "@tanstack/react-query"

import {
  categoriesRepository,
  inventoryRepository,
  ordersRepository,
  productsRepository,
  reviewsRepository,
} from "@/lib/data/repositories"
import {
  activityRows,
  ordersExtent,
  salesStats,
  topCategories,
  unitsSoldTrend,
  velocityByCategory,
} from "./derive"
import type { DateRange } from "./derive"

export type { DateRange, VelocityDatum } from "./derive"

// The dashboard is a READ-TIME VIEW of the real entities. Nothing here is
// seeded: each query pulls orders / products / inventory through the same
// repositories the rest of the app writes to, then runs them through derive.ts.
// Edit an order and the tiles move, because there is no second copy of the
// numbers to drift from. (The `dashboard` store table these queries used to
// read is now vestigial - see lib/data/dashboard.ts.)
//
// No `initialData`: the UI reads only from the store, so every query is pending
// on the first client paint and its component holds a skeleton until the read
// settles. `staleTime: 0` revalidates after mutations, matching the orders and
// products list queries.
//
// The period-based queries are PARAMETERISED BY RANGE, which the date filter
// drives (dashboard.tsx owns the state). The range is part of every one of their
// keys: without it, react-query would serve the first window's figures for every
// window after it, and the picker would look wired while changing nothing.

/**
 * A range as a cache key. ISO bounds rather than the Date objects themselves:
 * two equal windows must hash the same, and a fresh Date instance per render
 * would otherwise miss the cache on every re-render.
 */
const rangeKey = (range: DateRange) =>
  [range.start.toISOString(), range.end.toISOString()] as const

export const dashboardStatsQuery = (range: DateRange) =>
  queryOptions({
    queryKey: ["dashboard", "stats", rangeKey(range)] as const,
    queryFn: async () => salesStats(await ordersRepository.list(), range),
    staleTime: 0,
  })

/**
 * The orders' own earliest..latest, which clamps the picker's open-ended
 * operators ("before X" has no start of its own). Not time-filtered: it is the
 * extent OF the data, so it reads the whole ledger.
 */
export const dashboardOrdersExtentQuery = () =>
  queryOptions({
    queryKey: ["dashboard", "orders-extent"] as const,
    queryFn: async () => ordersExtent(await ordersRepository.list()),
    staleTime: 0,
  })

export const dashboardVelocityQuery = (range: DateRange) =>
  queryOptions({
    queryKey: ["dashboard", "velocity", rangeKey(range)] as const,
    queryFn: async () => {
      const [orders, products] = await Promise.all([
        ordersRepository.list(),
        productsRepository.list(),
      ])
      return velocityByCategory(orders, products, range)
    },
    staleTime: 0,
  })

export const dashboardVelocityTrendQuery = (range: DateRange) =>
  queryOptions({
    queryKey: ["dashboard", "velocity-trend", rangeKey(range)] as const,
    queryFn: async () => unitsSoldTrend(await ordersRepository.list(), range),
    staleTime: 0,
  })

export const dashboardTopCategoriesQuery = (range: DateRange) =>
  queryOptions({
    queryKey: ["dashboard", "top-categories", rangeKey(range)] as const,
    queryFn: async () => {
      const [orders, products, categories] = await Promise.all([
        ordersRepository.list(),
        productsRepository.list(),
        categoriesRepository.list(),
      ])
      return topCategories(orders, products, categories, range)
    },
    staleTime: 0,
  })

export const dashboardProductsQuery = () =>
  queryOptions({
    queryKey: ["dashboard", "products"] as const,
    queryFn: async () => {
      const [products, inventory, reviews] = await Promise.all([
        productsRepository.list(),
        inventoryRepository.list(),
        reviewsRepository.list(),
      ])
      return activityRows(products, inventory, reviews)
    },
    staleTime: 0,
  })
