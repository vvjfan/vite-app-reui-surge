import type { ChartConfig } from "@/components/ui/chart"

// ─────────────────────────────────────────────────────────────────────────
// Top stats tiles
// ─────────────────────────────────────────────────────────────────────────

export interface StatItem {
  title: string
  value: number
  delta: number
  lastMonth: number
  positive: boolean
  prefix: string
  suffix: string
  // A formatter tag rather than a function, so the tile stays plain data. The
  // component maps this to a formatter.
  format?: "currency"
}

export function formatNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return n.toLocaleString()
  return n.toString()
}

export function formatCurrency(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

// ─────────────────────────────────────────────────────────────────────────
// Velocity chart (inventory turnover by category)
// ─────────────────────────────────────────────────────────────────────────

export const velocityConfig = {
  velocity: {
    // Scoped to the selected period, not the month. Each bar is colored per
    // category by the chart, so the series carries no color of its own.
    label: "Units sold",
  },
} satisfies ChartConfig

// ─────────────────────────────────────────────────────────────────────────
// Top categories list (right-side companion)
// ─────────────────────────────────────────────────────────────────────────

export type CategoryTrendDirection = "up" | "down"

export interface TopCategory {
  label: string
  /** Category.id, so the row links to that category's own page. Null when the
   *  products' category name matches no Category record; the row then falls
   *  back to the catalog. */
  categoryId: string | null
  value: string
  trend: string
  trendDirection: CategoryTrendDirection
  thumbnail: string
  unitsSold: number
}

// ─────────────────────────────────────────────────────────────────────────
// Tabbed table data: Products / Activities / Orders
// ─────────────────────────────────────────────────────────────────────────

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock"

export interface ProductRow {
  /** The inventory item this row IS - the target of the stock actions. */
  itemId: string
  /** The product it stocks, for linking through to the catalog. */
  productId: string
  sku: string
  name: string
  category: string
  vendor: string
  onHand: number
  reorderPoint: number
  status: StockStatus
  unitPrice: number
  retailPrice: number
  rating: number
  reviewCount: number
  thumbnail: string
  updatedAt: string
}

// ─────────────────────────────────────────────────────────────────────────
// Status / kind helpers
// ─────────────────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<StockStatus, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
}

// ─────────────────────────────────────────────────────────────────────────
// Vestigial demo seed.
//
// The dashboard used to be four pre-baked blobs in a `dashboard` key/value
// table: invented stats, velocity, categories and product rows that no
// mutation could ever move and that disagreed with /orders and /analytics.
// Every one of those figures is now DERIVED from the real orders / products /
// inventory entities at read time - see features/dashboard/derive.ts.
//
// The seam that served those blobs (the store table, its seed, and the
// dashboard repository) is gone; this module is now just the shared types,
// labels and formatters those derived figures are shaped by.
// ─────────────────────────────────────────────────────────────────────────
