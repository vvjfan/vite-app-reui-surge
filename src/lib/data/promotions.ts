import type { BadgeProps } from "@/components/reui/badge"

// Deterministic promotions (discounts) seed. Themed to the rest of the catalog
// (apparel / goods store, see products.ts): shopper-facing codes plus a couple
// of automatic discounts, a mix of percentage and fixed-amount values, order /
// items / shipping targets, and a spread of lifecycle statuses.
//
// The grid, header, and the create/edit editor read this ONLY through the
// demo store via TanStack Query; production data never touches it.
// `promotionsRepository` is the seam. See docs/DATA-LAYER.md.

// ── Types ──

export type PromotionMethod = "automatic" | "code"
export type PromotionValueType = "percentage" | "fixed"
export type PromotionTarget = "order" | "items" | "shipping"
export type PromotionStatus = "draft" | "active" | "scheduled" | "expired"

export interface Promotion {
  /** Stable id, also the store's primary key. */
  id: string
  /** Shopper-facing code, e.g. "SUMMER20". */
  code: string
  /** Human label, e.g. "Summer sale". */
  name: string
  method: PromotionMethod
  valueType: PromotionValueType
  target: PromotionTarget
  /** Percentage 0-100, or a fixed major-unit amount (read via `currency`). */
  value: number
  /** Currency for a `fixed` value, e.g. "USD". Unused for percentage. */
  currency: string
  status: PromotionStatus
  /** ISO date, or null when unscheduled. */
  startsAt: string | null
  /** ISO date, or null for no end (runs indefinitely). */
  endsAt: string | null
  /** Redemption cap, or null for unlimited. */
  usageLimit: number | null
  usedCount: number
  /** Minimum order subtotal to qualify, or null for none. */
  minSubtotal: number | null
  /**
   * Stacking order, low to high. When more than one promotion matches a cart,
   * the lowest rank wins, so this is the merchandiser's priority list and not a
   * display preference. Contiguous from 0 and rewritten as a block on reorder.
   */
  rank: number
}

/** Stacking order, low rank first. */
export function sortPromotionsByRank(promotions: Promotion[]): Promotion[] {
  return [...promotions].sort((a, b) => a.rank - b.rank)
}

// ── Seed (fixed dates around mid-2026 so the statuses read true to the demo) ──

export const PROMOTIONS: Promotion[] = [
  {
    id: "promo_1",
    code: "SUMMER20",
    name: "Summer sale",
    method: "code",
    valueType: "percentage",
    target: "items",
    value: 20,
    currency: "USD",
    status: "active",
    startsAt: "2026-06-01",
    endsAt: "2026-08-31",
    usageLimit: 1000,
    usedCount: 342,
    minSubtotal: null,
    rank: 0,
  },
  {
    id: "promo_2",
    code: "WELCOME10",
    name: "Welcome offer",
    method: "code",
    valueType: "percentage",
    target: "order",
    value: 10,
    currency: "USD",
    status: "active",
    startsAt: "2026-01-01",
    endsAt: null,
    usageLimit: null,
    usedCount: 1204,
    minSubtotal: null,
    rank: 1,
  },
  {
    id: "promo_3",
    code: "FREESHIP",
    name: "Free shipping over $75",
    method: "automatic",
    valueType: "percentage",
    target: "shipping",
    value: 100,
    currency: "USD",
    status: "active",
    startsAt: "2026-03-01",
    endsAt: null,
    usageLimit: null,
    usedCount: 2890,
    minSubtotal: 75,
    rank: 2,
  },
  {
    id: "promo_4",
    code: "VIP15",
    name: "VIP members",
    method: "code",
    valueType: "percentage",
    target: "order",
    value: 15,
    currency: "USD",
    status: "active",
    startsAt: "2026-05-15",
    endsAt: "2026-09-30",
    usageLimit: 200,
    usedCount: 56,
    minSubtotal: null,
    rank: 3,
  },
  {
    id: "promo_5",
    code: "CLEARANCE25",
    name: "Clearance event",
    method: "code",
    valueType: "percentage",
    target: "items",
    value: 25,
    currency: "USD",
    status: "active",
    startsAt: "2026-06-10",
    endsAt: "2026-08-10",
    usageLimit: null,
    usedCount: 214,
    minSubtotal: null,
    rank: 4,
  },
  {
    id: "promo_6",
    code: "FLASH50",
    name: "Flash weekend",
    method: "code",
    valueType: "percentage",
    target: "items",
    value: 50,
    currency: "USD",
    status: "expired",
    startsAt: "2026-05-01",
    endsAt: "2026-05-15",
    usageLimit: 500,
    usedCount: 500,
    minSubtotal: null,
    rank: 5,
  },
  {
    id: "promo_7",
    code: "BLACKFRIDAY",
    name: "Black Friday",
    method: "automatic",
    valueType: "percentage",
    target: "order",
    value: 30,
    currency: "USD",
    status: "scheduled",
    startsAt: "2026-11-25",
    endsAt: "2026-11-30",
    usageLimit: null,
    usedCount: 0,
    minSubtotal: null,
    rank: 6,
  },
  {
    id: "promo_8",
    code: "NEWYEAR30",
    name: "New Year kickoff",
    method: "code",
    valueType: "percentage",
    target: "order",
    value: 30,
    currency: "USD",
    status: "scheduled",
    startsAt: "2026-12-28",
    endsAt: "2027-01-05",
    usageLimit: 5000,
    usedCount: 0,
    minSubtotal: null,
    rank: 7,
  },
  {
    id: "promo_9",
    code: "EARLYBIRD",
    name: "Early bird",
    method: "code",
    valueType: "fixed",
    target: "order",
    value: 25,
    currency: "USD",
    status: "draft",
    startsAt: "2026-08-01",
    endsAt: "2026-08-15",
    usageLimit: 300,
    usedCount: 0,
    minSubtotal: 100,
    rank: 8,
  },
  {
    id: "promo_10",
    code: "STUDENT10",
    name: "Student discount",
    method: "code",
    valueType: "percentage",
    target: "order",
    value: 10,
    currency: "USD",
    status: "active",
    startsAt: "2026-02-01",
    endsAt: null,
    usageLimit: null,
    usedCount: 431,
    minSubtotal: null,
    rank: 9,
  },
  {
    id: "promo_11",
    code: "BUNDLE15",
    name: "Bundle and save",
    method: "code",
    valueType: "fixed",
    target: "items",
    value: 15,
    currency: "USD",
    status: "active",
    startsAt: "2026-06-20",
    endsAt: "2026-10-31",
    usageLimit: null,
    usedCount: 88,
    minSubtotal: 60,
    rank: 10,
  },
  {
    id: "promo_12",
    code: "LOYALTY5",
    name: "Loyalty reward",
    method: "automatic",
    valueType: "percentage",
    target: "order",
    value: 5,
    currency: "USD",
    status: "active",
    startsAt: "2026-01-15",
    endsAt: null,
    usageLimit: null,
    usedCount: 3120,
    minSubtotal: null,
    rank: 11,
  },
]

// ── Config that stays in code (not persisted; owned by the feature) ──

/** Status -> Badge variant + label. Drives the grid badge and the filter chip. */
export const PROMOTION_STATUS_META: Record<
  PromotionStatus,
  { label: string; variant: BadgeProps["variant"] }
> = {
  active: { label: "Active", variant: "success-light" },
  scheduled: { label: "Scheduled", variant: "info-light" },
  expired: { label: "Expired", variant: "secondary" },
  draft: { label: "Draft", variant: "secondary" },
}

export const PROMOTION_METHOD_OPTIONS: {
  value: PromotionMethod
  label: string
}[] = [
  { value: "code", label: "Code" },
  { value: "automatic", label: "Automatic" },
]

export const PROMOTION_VALUE_TYPE_OPTIONS: {
  value: PromotionValueType
  label: string
}[] = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed amount" },
]

export const PROMOTION_TARGET_OPTIONS: {
  value: PromotionTarget
  label: string
}[] = [
  { value: "order", label: "Order" },
  { value: "items", label: "Items" },
  { value: "shipping", label: "Shipping" },
]

export const PROMOTION_STATUS_OPTIONS: {
  value: PromotionStatus
  label: string
}[] = [
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "expired", label: "Expired" },
  { value: "draft", label: "Draft" },
]

/**
 * Human summary of what a promotion does, e.g. "20% off order", "$15 off items",
 * "Free shipping". Used in the Type column and (later) the create/edit sheet.
 */
export function summarizePromotion(promotion: Promotion): string {
  if (promotion.target === "shipping") return "Free shipping"
  const scope = promotion.target === "order" ? "order" : "items"
  if (promotion.valueType === "fixed") {
    const amount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: promotion.currency,
      maximumFractionDigits: 0,
    }).format(promotion.value)
    return `${amount} off ${scope}`
  }
  return `${promotion.value}% off ${scope}`
}
