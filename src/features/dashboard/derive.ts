import type {
  DateSelectorPeriodType,
  DateSelectorValue,
} from "@/components/reui/date-selector"
import type { Category } from "@/lib/data/categories"
import { round2 } from "@/lib/data/seed-utils"
import { sumLevels } from "@/lib/data/inventory"
import type {
  InventoryItem,
  StockStatus as LedgerStatus,
} from "@/lib/data/inventory"
import type { Review } from "@/lib/data/reviews"
import { productVariantCount, type Product } from "@/lib/data/products"
import { isSale, orderItemCount, type Order } from "@/lib/data/types"
import type {
  CategoryTrendDirection,
  ProductRow,
  StatItem,
  StockStatus,
  TopCategory,
} from "@/lib/data/dashboard"

// Read-time derivation for the dashboard. Every figure on the page comes from
// the live orders / products / inventory entities through these functions; the
// `dashboard` store table used to hold pre-baked blobs of invented numbers,
// which meant an order mutation could never move a tile and the KPIs disagreed
// with /orders. Same seam as the analytics feature's lib/derive.ts.
//
// Pure on purpose: plain arrays in, plain data out, plus an injectable `now` /
// explicit range so the buckets are testable without touching the clock. No
// the store, no react-query - queries.ts is the only thing that knows about either.
//
// Two bucketing schemes live here, deliberately:
//   - RANGE, for the dashboard, whose window the date filter drives.
//   - CALENDAR MONTH, for billing (features/settings reads isCurrentMonth for
//     "orders this month"): a billing cycle is a calendar month, not whatever
//     window the dashboard happens to be showing.

// ── Rounding ──

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ── Month bucketing ──

/**
 * Calendar-month ordinal in LOCAL time, so `a - b === 1` means "exactly one
 * month earlier" and December -> January is not an 11-month jump. Local rather
 * than UTC because the orders seed anchors itself to the viewer's clock, and
 * "this month" on a dashboard means the viewer's calendar month.
 */
export function monthOrdinal(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth()
}

export type MonthBucket = "current" | "previous" | "other"

export function monthBucketOf(iso: string, now: Date): MonthBucket {
  const distance = monthOrdinal(now) - monthOrdinal(new Date(iso))
  if (distance === 0) return "current"
  if (distance === 1) return "previous"
  return "other"
}

/** True when an ISO timestamp falls in `now`'s calendar month. */
export function isCurrentMonth(iso: string, now: Date): boolean {
  return monthBucketOf(iso, now) === "current"
}

export interface OrderSplit {
  current: Order[]
  previous: Order[]
}

export type MonthSplit = OrderSplit

/** Splits orders into this month / last month. Anything older is dropped. */
export function splitOrdersByMonth(orders: Order[], now: Date): MonthSplit {
  const current: Order[] = []
  const previous: Order[] = []
  for (const order of orders) {
    const bucket = monthBucketOf(order.date, now)
    if (bucket === "current") current.push(order)
    else if (bucket === "previous") previous.push(order)
  }
  return { current, previous }
}

// ── Range bucketing (what the date filter drives) ──

export interface DateRange {
  start: Date
  end: Date
}

/**
 * Bounds are INCLUSIVE at day granularity: a window starts at 00:00:00.000 of
 * its first day and ends at 23:59:59.999 of its last, so an order placed at any
 * hour of the last day still counts. Local time throughout, for the same reason
 * monthOrdinal is local - the seed anchors to the viewer's clock.
 */
function startOfDay(date: Date): Date {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day
}

function endOfDay(date: Date): Date {
  const day = new Date(date)
  day.setHours(23, 59, 59, 999)
  return day
}

function dayRange(start: Date, end: Date): DateRange {
  return { start: startOfDay(start), end: endOfDay(end) }
}

/** How many calendar months each selectable period spans. */
const PERIOD_MONTHS: Record<DateSelectorPeriodType, number> = {
  day: 0,
  month: 1,
  quarter: 3,
  "half-year": 6,
  year: 12,
}

/**
 * The whole calendar period `index` of `year` - Q3 2026, Feb 2026, 2026 itself.
 * `index` is the picker's own 0-based ordinal for the period type (month 0-11,
 * quarter 0-3, half-year 0-1; ignored for year). Day 0 of the following month is
 * the last day of the one before it, which is how the end lands on 28/30/31
 * without a leap-year table.
 */
function periodBounds(
  period: DateSelectorPeriodType,
  year: number,
  index: number
): DateRange {
  const span = PERIOD_MONTHS[period]
  const firstMonth = period === "year" ? 0 : index * span
  return {
    start: new Date(year, firstMonth, 1, 0, 0, 0, 0),
    end: endOfDay(new Date(year, firstMonth + span, 0)),
  }
}

/**
 * The single period a non-day value points at. The picker keeps the pieces in
 * separate fields per period type (month / quarter / halfYear), so this is the
 * one place that knows which field to read.
 */
function periodAnchor(
  value: DateSelectorValue
): { year: number; index: number } | null {
  const { period, year } = value
  if (year === undefined) return null
  if (period === "year") return { year, index: 0 }
  const index =
    period === "month"
      ? value.month
      : period === "quarter"
        ? value.quarter
        : value.halfYear
  return index === undefined ? null : { year, index }
}

/**
 * Resolve the picker's value to a bounded, inclusive range.
 *
 * `extent` clamps the open-ended operators: "before X" has no start of its own
 * and "after X" has no end, and an unbounded window has no equal-length
 * predecessor to compare against (see previousRange), so each borrows the data's
 * own edge. Pass the orders' extent - ordersExtent.
 *
 *   between -> both dates, inclusive of each.
 *   is      -> the WHOLE period containing the pick: the day, month, quarter,
 *              half-year, or year, per `value.period`.
 *   before  -> extent.start .. the end of the period picked.
 *   after   -> the start of the period picked .. extent.end.
 *
 * A value with nothing picked yet (the picker clears its selection when the
 * period type changes) resolves to the extent: all the data, rather than an
 * empty dashboard.
 */
export function toDateRange(
  value: DateSelectorValue,
  extent: DateRange
): DateRange {
  const { period, operator } = value

  if (period === "day") {
    const { startDate, endDate } = value
    if (!startDate) return extent
    if (operator === "before")
      return { start: extent.start, end: endOfDay(startDate) }
    if (operator === "after")
      return { start: startOfDay(startDate), end: extent.end }
    // "between" with only one end committed is still a single day, same as "is".
    return dayRange(
      startDate,
      operator === "between" && endDate ? endDate : startDate
    )
  }

  if (operator === "between") {
    const { rangeStart, rangeEnd } = value
    if (rangeStart && rangeEnd) {
      return {
        start: periodBounds(period, rangeStart.year, rangeStart.value).start,
        end: periodBounds(period, rangeEnd.year, rangeEnd.value).end,
      }
    }
    // Only one end picked: falls through to the single-period anchor below.
  }

  const anchor = periodAnchor(value)
  if (!anchor) return extent
  const bounds = periodBounds(period, anchor.year, anchor.index)
  if (operator === "before") return { start: extent.start, end: bounds.end }
  if (operator === "after") return { start: bounds.start, end: extent.end }
  return bounds
}

/**
 * The equal-length window immediately before `range` - what the tiles' deltas
 * compare against. It ends one millisecond before `range` starts, so the two
 * windows are the same length and cannot overlap: no order is counted twice.
 */
export function previousRange(range: DateRange): DateRange {
  const span = range.end.getTime() - range.start.getTime()
  const end = new Date(range.start.getTime() - 1)
  return { start: new Date(end.getTime() - span), end }
}

/**
 * Earliest..latest order date, the clamp for the open-ended operators. Widened
 * to whole days, matching every other window here. An empty ledger has no
 * extent, so today stands in - "before X" over no orders is empty either way.
 */
export function ordersExtent(
  orders: Order[],
  now: Date = new Date()
): DateRange {
  let earliest: number | null = null
  let latest: number | null = null
  for (const order of orders) {
    const time = new Date(order.date).getTime()
    if (Number.isNaN(time)) continue
    if (earliest === null || time < earliest) earliest = time
    if (latest === null || time > latest) latest = time
  }
  if (earliest === null || latest === null) return dayRange(now, now)
  return dayRange(new Date(earliest), new Date(latest))
}

/** The picker's default window, and therefore the dashboard's: the last 30 days
 * (today and the 29 before it). Defined once, here, so the control and the data
 * it filters cannot drift: the dashboard seeds its state with this value, hands
 * that same value to the picker, and resolves it through toDateRange for the
 * queries. */
export function lastThirtyDays(now: Date = new Date()): DateSelectorValue {
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - 29)
  return {
    period: "day",
    operator: "between",
    startDate,
    endDate: new Date(now),
  }
}

function contains(range: DateRange, time: number): boolean {
  return time >= range.start.getTime() && time <= range.end.getTime()
}

/**
 * Splits orders into the selected window and the equal-length one before it.
 * Anything outside both is dropped, exactly as splitOrdersByMonth drops
 * anything older than last month.
 */
export function splitOrdersByRange(
  orders: Order[],
  range: DateRange
): OrderSplit {
  const preceding = previousRange(range)
  const current: Order[] = []
  const previous: Order[] = []
  for (const order of orders) {
    const time = new Date(order.date).getTime()
    if (Number.isNaN(time)) continue
    if (contains(range, time)) current.push(order)
    else if (contains(preceding, time)) previous.push(order)
  }
  return { current, previous }
}

/**
 * Period-over-period change, rounded to the one decimal the badges render.
 *
 * A zero (or absent) baseline has no defined growth rate, so this reports 0
 * rather than Infinity or NaN - callers read 0 as non-negative. That case is
 * real: a category can have its first sale in the selected period.
 */
export function percentChange(current: number, previous: number): number {
  if (previous <= 0) return 0
  return round1(((current - previous) / previous) * 100)
}

// ── Sales KPIs ──

interface PeriodTotals {
  revenue: number
  orders: number
  aov: number
  units: number
}

function periodTotals(orders: Order[]): PeriodTotals {
  // Money and goods come from the sales only; the order COUNT is every order
  // placed. See isSale: cancelled is not a sale, but it was still an order.
  const sales = orders.filter(isSale)
  const revenue = sales.reduce((sum, order) => sum + order.totals.total, 0)
  const units = sales.reduce((sum, order) => sum + orderItemCount(order), 0)
  return {
    revenue: round2(revenue),
    orders: orders.length,
    // Net sales over orders placed - the standard average order value. Dividing
    // by the sales instead would leave the three tiles unable to reconcile: a
    // reader doing Revenue / Orders in their head must land on this number.
    // A month with no orders has no average. 0 rather than NaN.
    aov: orders.length > 0 ? round2(revenue / orders.length) : 0,
    units,
  }
}

function tile(
  title: string,
  value: number,
  // The baseline is the PREVIOUS PERIOD, whatever length the filter selected.
  // The field is still named lastMonth because StatItem (lib/data/dashboard) is
  // shared with tiles elsewhere; only the dashboard's own copy calls it that.
  previousPeriod: number,
  format?: "currency"
): StatItem {
  const delta = percentChange(value, previousPeriod)
  return {
    title,
    value,
    delta,
    lastMonth: previousPeriod,
    positive: delta >= 0,
    prefix: "",
    suffix: "",
    ...(format ? { format } : {}),
  }
}

/**
 * The four tiles across the top: the selected period's sales, each against the
 * equal-length period before it.
 *
 * Revenue, avg order value, and units sold are net of cancelled orders (see
 * isSale, the rule /analytics and the customer totals share). Orders counts
 * every order placed, cancelled included, because it was still placed.
 */
export function salesStats(orders: Order[], range: DateRange): StatItem[] {
  const { current, previous } = splitOrdersByRange(orders, range)
  const selected = periodTotals(current)
  const preceding = periodTotals(previous)
  return [
    tile("Revenue", selected.revenue, preceding.revenue, "currency"),
    tile("Orders", selected.orders, preceding.orders),
    tile("Avg order value", selected.aov, preceding.aov, "currency"),
    tile("Units sold", selected.units, preceding.units),
  ]
}

/** Period-over-period change in total units sold - the velocity chart's badge. */
export function unitsSoldTrend(orders: Order[], range: DateRange): number {
  const { current, previous } = splitOrdersByRange(orders, range)
  return percentChange(
    periodTotals(current).units,
    periodTotals(previous).units
  )
}

/**
 * SKUs in the catalog. A sku identifies a VARIANT, not a product, so this
 * counts variants - the header's "N SKUs" used to read the invented "Total
 * SKUs" tile, which no longer exists.
 */
export function skuCount(products: Product[]): number {
  return products.reduce(
    (sum, product) => sum + productVariantCount(product),
    0
  )
}

// ── Category rollups ──

interface CategoryTotals {
  revenue: number
  units: number
  /** Line revenue per product, so a category can pick a representative image. */
  revenueByProduct: Map<string, number>
}

/**
 * Groups order lines by the category of the product each line was bought from.
 *
 * The join key is `line.productId` (Product.id). Line `name` and `sku` are NOT
 * reliable keys on their own - seed-integrity.test.ts guards that every line
 * resolves. A line that somehow does not resolve is bucketed as "Unknown"
 * rather than dropped, so the rollup always reconciles with total revenue
 * instead of silently understating it.
 */
function categoryTotals(
  orders: Order[],
  products: Product[]
): Map<string, CategoryTotals> {
  const categoryByProduct = new Map(products.map((p) => [p.id, p.category]))
  const totals = new Map<string, CategoryTotals>()

  // Category revenue and units are money and goods, so cancelled is not a sale.
  for (const order of orders.filter(isSale)) {
    for (const line of order.lines) {
      const category = categoryByProduct.get(line.productId) ?? "Unknown"
      let entry = totals.get(category)
      if (!entry) {
        entry = { revenue: 0, units: 0, revenueByProduct: new Map() }
        totals.set(category, entry)
      }
      const lineRevenue = line.qty * line.unitPrice
      entry.revenue += lineRevenue
      entry.units += line.qty
      entry.revenueByProduct.set(
        line.productId,
        (entry.revenueByProduct.get(line.productId) ?? 0) + lineRevenue
      )
    }
  }
  return totals
}

export interface VelocityDatum {
  category: string
  velocity: number
}

/**
 * Units sold per category over the selected period, ranked. Feeds the velocity
 * bar chart.
 */
export function velocityByCategory(
  orders: Order[],
  products: Product[],
  range: DateRange
): VelocityDatum[] {
  const { current } = splitOrdersByRange(orders, range)
  return [...categoryTotals(current, products).entries()]
    .map(([category, totals]) => ({ category, velocity: totals.units }))
    .sort(
      (a, b) => b.velocity - a.velocity || a.category.localeCompare(b.category)
    )
}

/**
 * "$182.4K" - the string shape the ranked list already rendered. Deliberately
 * not formatCurrency (the tiles' formatter), which drops the decimal on
 * thousands: this keeps the list's typography identical to before.
 */
function formatCategoryRevenue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${Math.round(value)}`
}

/**
 * The image standing in for a category: the thumbnail of the product that sold
 * the most of it over the selected period. Ties break on product id so the pick
 * is stable across reads. "" only when no line resolved to a product, which the
 * seed integrity tests rule out.
 */
function representativeThumbnail(
  totals: CategoryTotals,
  productById: Map<string, Product>
): string {
  let best: { id: string; revenue: number } | null = null
  for (const [id, revenue] of totals.revenueByProduct) {
    if (!productById.has(id)) continue
    if (
      !best ||
      revenue > best.revenue ||
      (revenue === best.revenue && id < best.id)
    ) {
      best = { id, revenue }
    }
  }
  return best ? (productById.get(best.id)?.thumbnail ?? "") : ""
}

/**
 * Revenue per category over the selected period, ranked, each with a real
 * period-over-period trend. Revenue is summed from the lines (qty x unitPrice)
 * rather than order totals, because an order's shipping and tax do not belong to
 * any category.
 */
export function topCategories(
  orders: Order[],
  products: Product[],
  categories: Category[],
  range: DateRange
): TopCategory[] {
  const { current, previous } = splitOrdersByRange(orders, range)
  const selected = categoryTotals(current, products)
  const preceding = categoryTotals(previous, products)
  const productById = new Map(products.map((p) => [p.id, p]))
  // Products link to a category by NAME, so that is the key here too.
  const imageByCategory = new Map(
    categories
      .filter((category) => category.image)
      .map((category) => [category.name, category.image as string])
  )
  // Same name key, resolving to the id the category detail route takes.
  const idByCategory = new Map(
    categories.map((category) => [category.name, category.id])
  )

  return [...selected.entries()]
    .sort(
      ([aLabel, a], [bLabel, b]) =>
        b.revenue - a.revenue || aLabel.localeCompare(bLabel)
    )
    .map(([label, totals]) => {
      const previousRevenue = preceding.get(label)?.revenue ?? 0
      const trend = percentChange(totals.revenue, previousRevenue)
      const direction: CategoryTrendDirection = trend >= 0 ? "up" : "down"
      // With nothing to compare against, a percentage is meaningless: the
      // category sold for the first time in this window. percentChange returns
      // 0 there, which would render as a flat "0.0%" and read as "no change".
      const isNew = previousRevenue <= 0
      return {
        label,
        // The category's own page. Null when this product category name matches
        // no Category record, and the row falls back to the catalog.
        categoryId: idByCategory.get(label) ?? null,
        value: formatCategoryRevenue(totals.revenue),
        trend: isNew ? "New" : `${Math.abs(trend).toFixed(1)}%`,
        trendDirection: direction,
        // The category owns its art. Fall back to the best-selling product's
        // photo only when it has none: that fallback is sales-dependent, so a
        // category with no image can change picture as sales move.
        thumbnail:
          imageByCategory.get(label) ??
          representativeThumbnail(totals, productById),
        unitsSold: totals.units,
      }
    })
}

// ── Activity rows (the "Inventory stocks" grid) ──

interface ProductRating {
  average: number
  count: number
}

/**
 * Average rating and review count per product, from APPROVED reviews only -
 * the rule the reviews module defines (a pending or rejected submission must
 * never move a product's score). Products with no approved review are absent,
 * so callers report no data rather than a 0-star average.
 */
export function ratingsByProduct(
  reviews: Review[]
): Map<string, ProductRating> {
  const sums = new Map<string, { total: number; count: number }>()
  for (const review of reviews) {
    if (review.status !== "approved") continue
    const entry = sums.get(review.productId) ?? { total: 0, count: 0 }
    entry.total += review.rating
    entry.count += 1
    sums.set(review.productId, entry)
  }
  return new Map(
    [...sums.entries()].map(([productId, { total, count }]) => [
      productId,
      { average: round1(total / count), count },
    ])
  )
}

/** onHand against the reorder point - the rule the tab descriptions describe. */
function stockLevel(onHand: number, reorderPoint: number): StockStatus {
  if (onHand <= 0) return "out_of_stock"
  return onHand <= reorderPoint ? "low_stock" : "in_stock"
}

const TILE_STATUS: Partial<Record<LedgerStatus, StockStatus>> = {
  "In stock": "in_stock",
  "Low stock": "low_stock",
  "Out of stock": "out_of_stock",
}

/**
 * The ledger tracks five states; the grid's vocabulary has three. The three
 * that map, map. Backordered and Discontinued are not stock levels at all (one
 * is "below reorder point, PO already raised", the other is "we stopped selling
 * it"), so they fall back to what is actually on hand - the same rule the other
 * three already follow in the seed.
 */
function tileStatus(item: InventoryItem): StockStatus {
  return (
    TILE_STATUS[item.status] ?? stockLevel(itemOnHand(item), item.reorderPoint)
  )
}

/** Stock is held per location now, so the dashboard's figure is the total the
 *  store holds for that SKU, wherever it sits. */
function itemOnHand(item: InventoryItem): number {
  return sumLevels(item.levels, (level) => level.onHand)
}

/**
 * The tracked stock rows, joined to the catalog on `productId`.
 *
 * Driven by inventory, not products: the grid is "Inventory stocks", and onHand
 * / reorderPoint only exist on the ledger. Products with no stock row are not
 * tracked stock and do not appear. The product wins on catalog facts (title,
 * category, image) with the ledger's own denormalized copy as the fallback;
 * both are real, and seed-integrity.test.ts guards that every row resolves so
 * the fallback is unreachable in practice.
 *
 * Vendor is the exception: it has NO ledger fallback. It used to fall back to
 * the row's supplier, which quietly printed the distributor in a column that
 * means "brand" - two different companies, so the fallback was never a fallback,
 * it was a wrong answer. A row whose product has been deleted simply has no
 * brand to report.
 */
export function activityRows(
  products: Product[],
  inventory: InventoryItem[],
  reviews: Review[]
): ProductRow[] {
  const productById = new Map(products.map((p) => [p.id, p]))
  const ratingByProduct = ratingsByProduct(reviews)

  return inventory.map((item) => {
    const product = productById.get(item.productId)
    const variant = product?.variants.find((v) => v.sku === item.sku)
    const rating = ratingByProduct.get(item.productId)
    return {
      itemId: item.id,
      productId: item.productId,
      sku: item.sku,
      name: product?.title ?? item.name,
      category: product?.category ?? item.category,
      vendor: product?.vendor ?? "",
      onHand: itemOnHand(item),
      reorderPoint: item.reorderPoint,
      status: tileStatus(item),
      // Cost is the ledger's; the shelf price is the catalog's. A row is one
      // sku, so the price is that variant's own: siblings of a product differ
      // in price, and any of theirs is a price this row is not sold at.
      unitPrice: item.unitCost,
      retailPrice: variant ? round2(variant.price) : 0,
      // Approved reviews only, matching how the reviews module defines a
      // product's rating: pending and rejected submissions must not count.
      // A product with none reports no data rather than a fabricated score.
      rating: rating?.average ?? 0,
      reviewCount: rating?.count ?? 0,
      // The variant's photo for the same reason the price is the variant's: a
      // row is one sku. The product thumbnail is the fallback rather than the
      // answer, because it is one photo for every colour the product comes in.
      thumbnail: variant?.image || product?.thumbnail || item.thumbnail || "",
      // The ledger's newest movement (movements are stored newest first).
      updatedAt: item.movements[0]?.timeLabel ?? "",
    }
  })
}
