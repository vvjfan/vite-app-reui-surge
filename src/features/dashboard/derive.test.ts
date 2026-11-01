import { describe, expect, it } from "vitest"

import { INVENTORY_ITEMS } from "@/lib/data/inventory"
import { ORDERS } from "@/lib/data/orders"
import { PRODUCTS } from "@/lib/data/products"
import { CATEGORIES, type Category } from "@/lib/data/categories"
import type { Review } from "@/lib/data/reviews"
import type { InventoryItem } from "@/lib/data/inventory"
import type { Product } from "@/lib/data/products"
import type { Order, OrderLine } from "@/lib/data/types"

import {
  activityRows,
  isCurrentMonth,
  lastThirtyDays,
  ordersExtent,
  percentChange,
  previousRange,
  salesStats,
  skuCount,
  splitOrdersByMonth,
  splitOrdersByRange,
  toDateRange,
  topCategories,
  unitsSoldTrend,
  velocityByCategory,
} from "./derive"
import type { DateRange } from "./derive"

// The dashboard is a read-time view of orders / products / inventory, so these
// tests are the only thing standing between a join going wrong and the page
// quietly reporting a plausible wrong number. Fixtures are hand-built and `now`
// is pinned, so the buckets never depend on when the suite runs.

/** Pinned clock: mid-March, far from any month boundary. */
const NOW = new Date(2026, 2, 15, 12, 0, 0)

/**
 * The pinned month as an explicit window - what the date filter would resolve to
 * for "March 2026". Its equal-length predecessor (previousRange) is Jan 29 ..
 * Feb 28, which is where LAST_MONTH sits and monthsBefore(2) does not, so the
 * KPI fixtures below keep the current/previous split they were written for.
 */
const RANGE: DateRange = {
  start: new Date(2026, 2, 1, 0, 0, 0, 0),
  end: new Date(2026, 2, 31, 23, 59, 59, 999),
}

/** An ISO timestamp `monthsAgo` calendar months before NOW, on the 10th. */
function monthsBefore(monthsAgo: number, day = 10): string {
  return new Date(2026, 2 - monthsAgo, day, 9, 0, 0).toISOString()
}

const THIS_MONTH = monthsBefore(0)
const LAST_MONTH = monthsBefore(1)

// ── Fixtures ──

function makeLine(overrides: Partial<OrderLine> = {}): OrderLine {
  return {
    id: "line_1",
    productId: "tee",
    name: "Tee",
    sku: "AP-1",
    color: "Black",
    qty: 1,
    unitPrice: 100,
    weight: 0.3,
    image: "",
    ...overrides,
  }
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  const lines = overrides.lines ?? [makeLine()]
  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0)
  return {
    id: "SO-1",
    number: "#1",
    date: THIS_MONTH,
    customer: { name: "A", email: "a@x.com", handle: "a" },
    status: "fulfilled",
    payment: "paid",
    fulfillment: "fulfilled",
    totals: { subtotal, shipping: 0, tax: 0, total: subtotal },
    shipping: {
      priority: "Standard",
      method: "Ground",
      carrier: "UPS",
      locationId: "loc_main",
      from: "A",
      to: "B",
      destinationLabel: "B",
      destinationLines: [],
    },
    ...overrides,
    lines,
  }
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "tee",
    title: "Tee",
    subtitle: "",
    description: "",
    status: "active",
    category: "Apparel",
    kind: "Physical",
    vendor: "Northline",
    thumbnail: "tee.jpg",
    images: [],
    tags: [],
    collections: [],
    variants: [
      {
        id: "AP-1",
        sku: "AP-1",
        title: "Black",
        options: {},
        price: 40,
        image: "tee-black.jpg",
      },
    ],
    ...overrides,
  }
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "apparel",
    name: "Apparel",
    handle: "apparel",
    description: "",
    image: null,
    isActive: true,
    isInternal: false,
    rank: 0,
    parentId: null,
    ...overrides,
  }
}

/** Categories that own no art, so the product-photo fallback is exercised. */
const NO_ART: Category[] = []

/** Reviews that do not exist, so the "no rating data" path is exercised. */
const NO_REVIEWS: Review[] = []

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "rev_1",
    productId: "tee",
    rating: 5,
    title: "",
    body: "",
    customerName: "A",
    customerId: null,
    status: "approved",
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as Review
}

// Stock is per location now, so `onHand` is a convenience: it builds the single
// level these dashboard tests care about. Tests that assert on a total should
// keep saying `onHand: N` rather than spelling out a levels array.
function makeInventory(
  overrides: Partial<InventoryItem> & { onHand?: number } = {}
): InventoryItem {
  const { onHand, ...rest } = overrides
  return {
    id: "inv_1",
    productId: "tee",
    name: "Ledger name",
    sku: "AP-1",
    thumbnail: "ledger.jpg",
    category: "Ledger category",
    supplierId: "sup_meridian",
    levels: [{ locationId: "loc_main", bin: "A-1", onHand: onHand ?? 100 }],
    reorderPoint: 20,
    unitCost: 12,
    status: "In stock",
    safetyStock: 10,
    leadTimeDays: 7,
    dailyVelocity: 2,
    upc: "0",
    lots: [],
    movements: [],
    ...rest,
  }
}

const statByTitle = (orders: Order[], title: string) => {
  const stat = salesStats(orders, RANGE).find((s) => s.title === title)
  if (!stat) throw new Error(`no stat titled ${title}`)
  return stat
}

// ── Month bucketing ──

describe("month bucketing", () => {
  it("puts an order from last month in the previous bucket, not the current one", () => {
    const split = splitOrdersByMonth(
      [
        makeOrder({ id: "now", date: THIS_MONTH }),
        makeOrder({ id: "then", date: LAST_MONTH }),
      ],
      NOW
    )
    expect(split.current.map((o) => o.id)).toEqual(["now"])
    expect(split.previous.map((o) => o.id)).toEqual(["then"])
  })

  it("drops orders older than last month from both buckets", () => {
    const split = splitOrdersByMonth(
      [makeOrder({ date: monthsBefore(2) })],
      NOW
    )
    expect(split.current).toHaveLength(0)
    expect(split.previous).toHaveLength(0)
  })

  it("treats December as the previous month of January, not eleven months out", () => {
    const january = new Date(2026, 0, 15, 12, 0, 0)
    const december = new Date(2025, 11, 20, 9, 0, 0).toISOString()
    const split = splitOrdersByMonth([makeOrder({ date: december })], january)
    expect(split.previous).toHaveLength(1)
  })

  it("counts the first instant of the month as current, and the one before it as previous", () => {
    const firstInstant = new Date(2026, 2, 1, 0, 0, 0).toISOString()
    const lastInstant = new Date(2026, 1, 28, 23, 59, 59).toISOString()
    expect(isCurrentMonth(firstInstant, NOW)).toBe(true)
    expect(isCurrentMonth(lastInstant, NOW)).toBe(false)
  })
})

// ── The range model (what the date filter drives) ──

describe("previousRange", () => {
  it("returns an equal-length window that ends immediately before the range", () => {
    const previous = previousRange(RANGE)
    expect(previous.end.getTime()).toBe(RANGE.start.getTime() - 1)
    expect(previous.end.getTime() - previous.start.getTime()).toBe(
      RANGE.end.getTime() - RANGE.start.getTime()
    )
  })

  it("does not overlap the range it precedes", () => {
    const previous = previousRange(RANGE)
    expect(previous.end.getTime()).toBeLessThan(RANGE.start.getTime())
    expect(previous.start.getTime()).toBeLessThan(previous.end.getTime())
  })

  it("gives a single day the day before it", () => {
    const day: DateRange = {
      start: new Date(2026, 2, 10, 0, 0, 0, 0),
      end: new Date(2026, 2, 10, 23, 59, 59, 999),
    }
    const previous = previousRange(day)
    expect(previous.start).toEqual(new Date(2026, 2, 9, 0, 0, 0, 0))
    expect(previous.end).toEqual(new Date(2026, 2, 9, 23, 59, 59, 999))
  })
})

describe("splitOrdersByRange", () => {
  const at = (date: Date) => makeOrder({ date: date.toISOString() })

  it("includes an order on the first and last instant of the range", () => {
    const { current } = splitOrdersByRange(
      [at(RANGE.start), at(RANGE.end)],
      RANGE
    )
    expect(current).toHaveLength(2)
  })

  it("excludes an order a millisecond outside either end", () => {
    const justBefore = new Date(RANGE.start.getTime() - 1)
    const justAfter = new Date(RANGE.end.getTime() + 1)
    const { current } = splitOrdersByRange(
      [at(justBefore), at(justAfter)],
      RANGE
    )
    expect(current).toHaveLength(0)
  })

  it("puts an order in the preceding window in previous, never current", () => {
    const previousWindow = previousRange(RANGE)
    const inside = new Date(
      (previousWindow.start.getTime() + previousWindow.end.getTime()) / 2
    )
    const split = splitOrdersByRange(
      [makeOrder({ id: "now", date: THIS_MONTH }), at(inside)],
      RANGE
    )
    expect(split.current.map((o) => o.id)).toEqual(["now"])
    expect(split.previous).toHaveLength(1)
    expect(split.current).toHaveLength(1)
  })

  it("hands the millisecond before the range to the previous window, losing no order", () => {
    // The two windows touch exactly: previous.end is range.start - 1ms.
    const split = splitOrdersByRange(
      [at(new Date(RANGE.start.getTime() - 1))],
      RANGE
    )
    expect(split.current).toHaveLength(0)
    expect(split.previous).toHaveLength(1)
  })

  it("drops orders older than the previous window", () => {
    const ancient = new Date(previousRange(RANGE).start.getTime() - 1)
    const split = splitOrdersByRange([at(ancient)], RANGE)
    expect(split.current).toHaveLength(0)
    expect(split.previous).toHaveLength(0)
  })
})

describe("toDateRange", () => {
  /** An extent well outside the picks below, so a clamp is unmistakable. */
  const EXTENT: DateRange = {
    start: new Date(2025, 0, 1, 0, 0, 0, 0),
    end: new Date(2026, 11, 31, 23, 59, 59, 999),
  }

  it("uses both dates of a between, inclusive of each whole day", () => {
    const range = toDateRange(
      {
        period: "day",
        operator: "between",
        startDate: new Date(2026, 2, 10, 14, 30),
        endDate: new Date(2026, 2, 20, 9, 15),
      },
      EXTENT
    )
    expect(range.start).toEqual(new Date(2026, 2, 10, 0, 0, 0, 0))
    expect(range.end).toEqual(new Date(2026, 2, 20, 23, 59, 59, 999))
  })

  it("expands an `is` day to the whole day containing it", () => {
    const range = toDateRange(
      {
        period: "day",
        operator: "is",
        startDate: new Date(2026, 2, 10, 14, 30),
      },
      EXTENT
    )
    expect(range.start).toEqual(new Date(2026, 2, 10, 0, 0, 0, 0))
    expect(range.end).toEqual(new Date(2026, 2, 10, 23, 59, 59, 999))
  })

  it("expands an `is` month to the whole month containing it", () => {
    const range = toDateRange(
      { period: "month", operator: "is", year: 2026, month: 1 },
      EXTENT
    )
    // February 2026: 28 days, found without a leap-year table.
    expect(range.start).toEqual(new Date(2026, 1, 1, 0, 0, 0, 0))
    expect(range.end).toEqual(new Date(2026, 1, 28, 23, 59, 59, 999))
  })

  it("expands an `is` quarter, half-year, and year to their whole periods", () => {
    const quarter = toDateRange(
      { period: "quarter", operator: "is", year: 2026, quarter: 2 },
      EXTENT
    )
    expect(quarter.start).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0)) // Q3 starts in July
    expect(quarter.end).toEqual(new Date(2026, 8, 30, 23, 59, 59, 999))

    const half = toDateRange(
      { period: "half-year", operator: "is", year: 2026, halfYear: 1 },
      EXTENT
    )
    expect(half.start).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0))
    expect(half.end).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999))

    const year = toDateRange(
      { period: "year", operator: "is", year: 2026 },
      EXTENT
    )
    expect(year.start).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0))
    expect(year.end).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999))
  })

  it("clamps `before` to the extent's start", () => {
    const range = toDateRange(
      {
        period: "day",
        operator: "before",
        startDate: new Date(2026, 2, 10, 14, 30),
      },
      EXTENT
    )
    expect(range.start).toEqual(EXTENT.start)
    expect(range.end).toEqual(new Date(2026, 2, 10, 23, 59, 59, 999))
  })

  it("clamps `after` to the extent's end", () => {
    const range = toDateRange(
      {
        period: "day",
        operator: "after",
        startDate: new Date(2026, 2, 10, 14, 30),
      },
      EXTENT
    )
    expect(range.start).toEqual(new Date(2026, 2, 10, 0, 0, 0, 0))
    expect(range.end).toEqual(EXTENT.end)
  })

  it("clamps an open-ended month to the extent, not to the month", () => {
    const range = toDateRange(
      { period: "month", operator: "after", year: 2026, month: 1 },
      EXTENT
    )
    expect(range.start).toEqual(new Date(2026, 1, 1, 0, 0, 0, 0))
    expect(range.end).toEqual(EXTENT.end)
  })

  it("spans a between over whole periods from the first to the last", () => {
    const range = toDateRange(
      {
        period: "month",
        operator: "between",
        rangeStart: { year: 2026, value: 0 },
        rangeEnd: { year: 2026, value: 2 },
      },
      EXTENT
    )
    expect(range.start).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0))
    expect(range.end).toEqual(new Date(2026, 2, 31, 23, 59, 59, 999))
  })

  it("falls back to the extent when nothing is picked", () => {
    // The picker clears its selection when the period type changes.
    expect(toDateRange({ period: "day", operator: "is" }, EXTENT)).toEqual(
      EXTENT
    )
    expect(toDateRange({ period: "month", operator: "is" }, EXTENT)).toEqual(
      EXTENT
    )
  })
})

describe("ordersExtent", () => {
  it("spans the earliest to the latest order date, widened to whole days", () => {
    const extent = ordersExtent([
      makeOrder({ id: "b", date: new Date(2026, 1, 20, 9, 0).toISOString() }),
      makeOrder({ id: "a", date: new Date(2026, 0, 5, 17, 0).toISOString() }),
      makeOrder({ id: "c", date: new Date(2026, 2, 10, 3, 0).toISOString() }),
    ])
    expect(extent.start).toEqual(new Date(2026, 0, 5, 0, 0, 0, 0))
    expect(extent.end).toEqual(new Date(2026, 2, 10, 23, 59, 59, 999))
  })

  it("falls back to today when there are no orders", () => {
    const extent = ordersExtent([], NOW)
    expect(extent.start).toEqual(new Date(2026, 2, 15, 0, 0, 0, 0))
    expect(extent.end).toEqual(new Date(2026, 2, 15, 23, 59, 59, 999))
  })
})

describe("the default window", () => {
  const EXTENT = { start: new Date(2025, 0, 1), end: new Date(2026, 11, 31) }

  it("covers today and the 29 days before it", () => {
    const range = toDateRange(lastThirtyDays(NOW), EXTENT)
    expect(range.start).toEqual(new Date(2026, 1, 14, 0, 0, 0, 0))
    expect(range.end).toEqual(new Date(2026, 2, 15, 23, 59, 59, 999))
  })

  it("is a between, so it never depends on the extent it is handed", () => {
    // Why the dashboard can resolve its default window before the orders read
    // settles: the clamp is irrelevant to it.
    const wild = { start: new Date(1999, 0, 1), end: new Date(2099, 0, 1) }
    expect(toDateRange(lastThirtyDays(NOW), wild)).toEqual(
      toDateRange(lastThirtyDays(NOW), EXTENT)
    )
  })

  it("yields the same figures as an explicit equivalent range", () => {
    const orders = [
      makeOrder({ id: "in", date: new Date(2026, 2, 1, 9, 0).toISOString() }),
      makeOrder({ id: "out", date: new Date(2026, 0, 5, 9, 0).toISOString() }),
    ]
    const explicit: DateRange = {
      start: new Date(2026, 1, 14, 0, 0, 0, 0),
      end: new Date(2026, 2, 15, 23, 59, 59, 999),
    }
    expect(
      salesStats(orders, toDateRange(lastThirtyDays(NOW), EXTENT))
    ).toEqual(salesStats(orders, explicit))
  })
})

describe("the range drives the figures", () => {
  // The regression guard for the whole bug this wiring fixes: the picker used to
  // surface a range that nothing consumed, so every window showed one month's
  // numbers. Two different windows over the SAME orders must not agree.
  const orders = [
    // February gives March a baseline to compare against; June's own baseline
    // (May) is empty, so the two windows differ in their trend as well.
    makeOrder({
      id: "feb",
      date: new Date(2026, 1, 10, 9, 0).toISOString(),
      lines: [makeLine({ qty: 2, unitPrice: 100 })],
    }),
    makeOrder({
      id: "march",
      date: new Date(2026, 2, 10, 9, 0).toISOString(),
      lines: [makeLine({ qty: 1, unitPrice: 100 })],
    }),
    makeOrder({
      id: "june",
      date: new Date(2026, 5, 10, 9, 0).toISOString(),
      lines: [makeLine({ qty: 7, unitPrice: 500 })],
    }),
  ]
  const march = toDateRange(
    { period: "month", operator: "is", year: 2026, month: 2 },
    RANGE
  )
  const june = toDateRange(
    { period: "month", operator: "is", year: 2026, month: 5 },
    RANGE
  )

  const revenueOf = (range: DateRange) =>
    salesStats(orders, range).find((s) => s.title === "Revenue")!.value

  it("reports different revenue for different ranges", () => {
    expect(revenueOf(march)).toBe(100)
    expect(revenueOf(june)).toBe(3500)
    expect(revenueOf(march)).not.toBe(revenueOf(june))
  })

  it("moves the category rollups with the range too", () => {
    expect(velocityByCategory(orders, CATALOG, march)).toEqual([
      { category: "Apparel", velocity: 1 },
    ])
    expect(velocityByCategory(orders, CATALOG, june)).toEqual([
      { category: "Apparel", velocity: 7 },
    ])
    // March: 1 unit against February's 2. June: 7 against an empty May.
    expect(unitsSoldTrend(orders, march)).toBe(-50)
    expect(unitsSoldTrend(orders, june)).toBe(0)
  })
})

describe("percentChange", () => {
  it("reports growth and decline", () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(80, 100)).toBe(-20)
  })

  it("returns 0 rather than Infinity when the baseline is zero", () => {
    const change = percentChange(500, 0)
    expect(change).toBe(0)
    expect(Number.isFinite(change)).toBe(true)
  })

  it("returns 0 rather than NaN when both sides are zero", () => {
    const change = percentChange(0, 0)
    expect(change).toBe(0)
    expect(Number.isNaN(change)).toBe(false)
  })
})

// ── KPIs ──

describe("salesStats", () => {
  const orders = [
    // This month: 2 orders, 300 + 100 = 400 revenue, 3 + 1 = 4 units.
    makeOrder({
      id: "SO-1",
      date: THIS_MONTH,
      lines: [makeLine({ qty: 3, unitPrice: 100 })],
    }),
    makeOrder({
      id: "SO-2",
      date: THIS_MONTH,
      lines: [makeLine({ qty: 1, unitPrice: 100 })],
    }),
    // Last month: 1 order, 200 revenue, 2 units.
    makeOrder({
      id: "SO-3",
      date: LAST_MONTH,
      lines: [makeLine({ qty: 2, unitPrice: 100 })],
    }),
  ]

  it("reports the four sales tiles", () => {
    expect(salesStats(orders, RANGE).map((s) => s.title)).toEqual([
      "Revenue",
      "Orders",
      "Avg order value",
      "Units sold",
    ])
  })

  it("sums this month's revenue and compares it to last month", () => {
    const stat = statByTitle(orders, "Revenue")
    expect(stat.value).toBe(400)
    expect(stat.lastMonth).toBe(200)
    expect(stat.delta).toBe(100)
    expect(stat.positive).toBe(true)
    expect(stat.format).toBe("currency")
  })

  it("counts this month's orders and compares them to last month", () => {
    const stat = statByTitle(orders, "Orders")
    expect(stat.value).toBe(2)
    expect(stat.lastMonth).toBe(1)
    expect(stat.delta).toBe(100)
  })

  it("averages this month's order value and compares it to last month", () => {
    const stat = statByTitle(orders, "Avg order value")
    expect(stat.value).toBe(200) // 400 / 2
    expect(stat.lastMonth).toBe(200) // 200 / 1
    expect(stat.delta).toBe(0)
    expect(stat.format).toBe("currency")
  })

  it("sums this month's units and compares them to last month", () => {
    const stat = statByTitle(orders, "Units sold")
    expect(stat.value).toBe(4)
    expect(stat.lastMonth).toBe(2)
    expect(stat.delta).toBe(100)
  })

  it("sums every line of a multi-line order into units", () => {
    const stat = statByTitle(
      [
        makeOrder({
          lines: [
            makeLine({ id: "a", qty: 2, unitPrice: 10 }),
            makeLine({ id: "b", qty: 5, unitPrice: 10 }),
          ],
        }),
      ],
      "Units sold"
    )
    expect(stat.value).toBe(7)
  })

  it("marks a decline as not positive", () => {
    const declining = [
      makeOrder({
        id: "SO-1",
        date: THIS_MONTH,
        lines: [makeLine({ qty: 1, unitPrice: 50 })],
      }),
      makeOrder({
        id: "SO-2",
        date: LAST_MONTH,
        lines: [makeLine({ qty: 1, unitPrice: 100 })],
      }),
    ]
    const stat = statByTitle(declining, "Revenue")
    expect(stat.delta).toBe(-50)
    expect(stat.positive).toBe(false)
  })

  it("reports a 0 average order value instead of NaN when the month has no orders", () => {
    const stats = salesStats([], RANGE)
    for (const stat of stats) {
      expect(Number.isNaN(stat.value)).toBe(false)
      expect(Number.isFinite(stat.delta)).toBe(true)
      expect(stat.value).toBe(0)
      expect(stat.delta).toBe(0)
    }
  })

  it("holds every delta finite and non-negative when last month was empty", () => {
    const firstMonthEver = [makeOrder({ date: THIS_MONTH })]
    for (const stat of salesStats(firstMonthEver, RANGE)) {
      expect(Number.isFinite(stat.delta)).toBe(true)
      expect(stat.delta).toBe(0)
      expect(stat.positive).toBe(true)
      expect(stat.lastMonth).toBe(0)
    }
  })
})

describe("unitsSoldTrend", () => {
  it("compares this month's units to last month's", () => {
    const orders = [
      makeOrder({ id: "a", date: THIS_MONTH, lines: [makeLine({ qty: 6 })] }),
      makeOrder({ id: "b", date: LAST_MONTH, lines: [makeLine({ qty: 4 })] }),
    ]
    expect(unitsSoldTrend(orders, RANGE)).toBe(50)
  })
})

// ── Category rollups ──

const CATALOG = [
  makeProduct({ id: "tee", category: "Apparel", thumbnail: "tee.jpg" }),
  makeProduct({ id: "boot", category: "Footwear", thumbnail: "boot.jpg" }),
  makeProduct({
    id: "sneaker",
    category: "Footwear",
    thumbnail: "sneaker.jpg",
  }),
]

describe("velocityByCategory", () => {
  it("groups units by the JOINED product category, not the line's own text", () => {
    // The line says "Tee" / "AP-1" but points at a Footwear product: the
    // productId is the join key, so it must land in Footwear.
    const orders = [
      makeOrder({
        lines: [
          makeLine({ productId: "boot", name: "Tee", sku: "AP-1", qty: 3 }),
        ],
      }),
    ]
    expect(velocityByCategory(orders, CATALOG, RANGE)).toEqual([
      { category: "Footwear", velocity: 3 },
    ])
  })

  it("sums sibling products of one category together and ranks descending", () => {
    const orders = [
      makeOrder({
        id: "a",
        lines: [
          makeLine({ id: "1", productId: "boot", qty: 2 }),
          makeLine({ id: "2", productId: "sneaker", qty: 3 }),
          makeLine({ id: "3", productId: "tee", qty: 4 }),
        ],
      }),
    ]
    expect(velocityByCategory(orders, CATALOG, RANGE)).toEqual([
      { category: "Footwear", velocity: 5 },
      { category: "Apparel", velocity: 4 },
    ])
  })

  it("ignores last month's orders", () => {
    const orders = [
      makeOrder({
        id: "a",
        date: THIS_MONTH,
        lines: [makeLine({ productId: "tee", qty: 1 })],
      }),
      makeOrder({
        id: "b",
        date: LAST_MONTH,
        lines: [makeLine({ productId: "boot", qty: 9 })],
      }),
    ]
    expect(velocityByCategory(orders, CATALOG, RANGE)).toEqual([
      { category: "Apparel", velocity: 1 },
    ])
  })

  it("buckets a line whose product is missing as Unknown rather than dropping it", () => {
    const orders = [
      makeOrder({ lines: [makeLine({ productId: "ghost", qty: 2 })] }),
    ]
    expect(velocityByCategory(orders, CATALOG, RANGE)).toEqual([
      { category: "Unknown", velocity: 2 },
    ])
  })
})

describe("topCategories", () => {
  it("ranks categories by this month's line revenue", () => {
    const orders = [
      makeOrder({
        lines: [
          makeLine({ id: "1", productId: "tee", qty: 1, unitPrice: 10 }),
          makeLine({ id: "2", productId: "boot", qty: 2, unitPrice: 100 }),
        ],
      }),
    ]
    const rows = topCategories(orders, CATALOG, NO_ART, RANGE)
    expect(rows.map((r) => r.label)).toEqual(["Footwear", "Apparel"])
    expect(rows[0].value).toBe("$200")
    expect(rows[0].unitsSold).toBe(2)
  })

  it("excludes shipping and tax by summing lines, not order totals", () => {
    const orders = [
      makeOrder({
        lines: [makeLine({ productId: "tee", qty: 1, unitPrice: 100 })],
        totals: { subtotal: 100, shipping: 25, tax: 8, total: 133 },
      }),
    ]
    expect(topCategories(orders, CATALOG, NO_ART, RANGE)[0].value).toBe("$100")
  })

  it("reports an upward trend when a category grew since last month", () => {
    const orders = [
      makeOrder({
        id: "a",
        date: THIS_MONTH,
        lines: [makeLine({ productId: "tee", qty: 3, unitPrice: 100 })],
      }),
      makeOrder({
        id: "b",
        date: LAST_MONTH,
        lines: [makeLine({ productId: "tee", qty: 2, unitPrice: 100 })],
      }),
    ]
    const [apparel] = topCategories(orders, CATALOG, NO_ART, RANGE)
    expect(apparel.trendDirection).toBe("up")
    expect(apparel.trend).toBe("50.0%")
  })

  it("reports a downward trend when a category shrank since last month", () => {
    const orders = [
      makeOrder({
        id: "a",
        date: THIS_MONTH,
        lines: [makeLine({ productId: "tee", qty: 1, unitPrice: 100 })],
      }),
      makeOrder({
        id: "b",
        date: LAST_MONTH,
        lines: [makeLine({ productId: "tee", qty: 4, unitPrice: 100 })],
      }),
    ]
    const [apparel] = topCategories(orders, CATALOG, NO_ART, RANGE)
    expect(apparel.trendDirection).toBe("down")
    expect(apparel.trend).toBe("75.0%")
  })

  it("does not report Infinity for a category with its first sale this month", () => {
    const orders = [
      makeOrder({
        lines: [makeLine({ productId: "tee", qty: 1, unitPrice: 100 })],
      }),
    ]
    const [apparel] = topCategories(orders, CATALOG, NO_ART, RANGE)
    // Reads as "New", never Infinity or a flat 0.0% that would imply no change.
    expect(apparel.trend).toBe("New")
    expect(apparel.trendDirection).toBe("up")
  })

  it("represents a category with its highest-revenue product's thumbnail", () => {
    const orders = [
      makeOrder({
        lines: [
          makeLine({ id: "1", productId: "boot", qty: 1, unitPrice: 10 }),
          makeLine({ id: "2", productId: "sneaker", qty: 1, unitPrice: 500 }),
        ],
      }),
    ]
    expect(topCategories(orders, CATALOG, NO_ART, RANGE)[0].thumbnail).toBe(
      "sneaker.jpg"
    )
  })

  it("uses the category's own art when it has some", () => {
    const orders = [makeOrder({ lines: [makeLine({ productId: "sneaker" })] })]
    const cats = [
      makeCategory({
        id: "footwear",
        name: "Footwear",
        image: "footwear-art.jpg",
      }),
    ]
    expect(topCategories(orders, CATALOG, cats, RANGE)[0].thumbnail).toBe(
      "footwear-art.jpg"
    )
  })

  it("prefers the category's art over the best-selling product's photo", () => {
    // Regression guard: the art must not move with sales. Sneaker outsells boot
    // here, but the row still shows the category's own image.
    const orders = [
      makeOrder({
        lines: [
          makeLine({ id: "1", productId: "boot", qty: 1, unitPrice: 10 }),
          makeLine({ id: "2", productId: "sneaker", qty: 1, unitPrice: 500 }),
        ],
      }),
    ]
    const cats = [
      makeCategory({
        id: "footwear",
        name: "Footwear",
        image: "footwear-art.jpg",
      }),
    ]
    expect(topCategories(orders, CATALOG, cats, RANGE)[0].thumbnail).toBe(
      "footwear-art.jpg"
    )
  })

  it("falls back to a product photo when the category's art is null", () => {
    const orders = [makeOrder({ lines: [makeLine({ productId: "sneaker" })] })]
    const cats = [
      makeCategory({ id: "footwear", name: "Footwear", image: null }),
    ]
    expect(topCategories(orders, CATALOG, cats, RANGE)[0].thumbnail).toBe(
      "sneaker.jpg"
    )
  })

  it("gives every top-level category in the real seed its own art", () => {
    for (const category of CATEGORIES.filter((c) => c.parentId === null)) {
      expect(category.image, category.name).toBeTruthy()
    }
  })

  it("carries no category id when no Category record matches", () => {
    // NO_ART holds no categories, so a product's category name resolves to
    // nothing and the row falls back to the catalog rather than linking to a
    // detail page that does not exist.
    const orders = [makeOrder({ lines: [makeLine({ productId: "tee" })] })]
    for (const row of topCategories(orders, CATALOG, NO_ART, RANGE)) {
      expect(row.categoryId).toBeNull()
    }
  })
})

// ── Activity rows ──

describe("activityRows", () => {
  it("joins the ledger row to its product on productId", () => {
    const [row] = activityRows(
      CATALOG,
      [makeInventory({ productId: "boot" })],
      NO_REVIEWS
    )
    // Catalog facts win over the ledger's denormalized copies.
    expect(row.name).toBe("Tee") // makeProduct's title for id "boot"
    expect(row.category).toBe("Footwear")
    expect(row.vendor).toBe("Northline")
    // The matched variant's photo, not the ledger's copy: catalog facts win.
    expect(row.thumbnail).toBe("tee-black.jpg")
    // Ledger facts have no catalog equivalent.
    expect(row.sku).toBe("AP-1")
    expect(row.onHand).toBe(100)
    expect(row.reorderPoint).toBe(20)
    expect(row.unitPrice).toBe(12)
  })

  it("prices the row from its own variant, not a cheaper sibling", () => {
    const product = makeProduct({
      id: "tee",
      variants: [
        {
          id: "a",
          sku: "a",
          title: "S",
          options: {},
          price: 90,
          image: "a.jpg",
        },
        {
          id: "b",
          sku: "b",
          title: "M",
          options: {},
          price: 70,
          image: "b.jpg",
        },
      ],
    })
    const [row] = activityRows(
      [product],
      [makeInventory({ productId: "tee", sku: "a" })],
      NO_REVIEWS
    )
    expect(row.retailPrice).toBe(90)
  })

  it("shows the row's own colourway, not one photo for every colour", () => {
    const product = makeProduct({
      id: "tee",
      thumbnail: "tee-sand.jpg",
      variants: [
        {
          id: "a",
          sku: "a",
          title: "Sand",
          options: {},
          price: 90,
          image: "tee-sand.jpg",
        },
        {
          id: "b",
          sku: "b",
          title: "Moss",
          options: {},
          price: 90,
          image: "tee-moss.jpg",
        },
      ],
    })
    const rows = activityRows(
      [product],
      [
        makeInventory({ id: "inv_a", productId: "tee", sku: "a" }),
        makeInventory({ id: "inv_b", productId: "tee", sku: "b" }),
      ],
      NO_REVIEWS
    )
    expect(rows.map((row) => row.thumbnail)).toEqual([
      "tee-sand.jpg",
      "tee-moss.jpg",
    ])
  })

  it("falls back to the product photo when the sku matches no variant", () => {
    const [row] = activityRows(
      CATALOG,
      [makeInventory({ productId: "tee", sku: "gone" })],
      NO_REVIEWS
    )
    expect(row.thumbnail).toBe("tee.jpg")
  })

  it("reports no retail price when the sku matches no variant", () => {
    // Same signal as a missing product: the row's price is unknown, and a
    // sibling's would be a number this sku is not sold at.
    const [row] = activityRows(
      CATALOG,
      [makeInventory({ productId: "tee", sku: "gone" })],
      NO_REVIEWS
    )
    expect(row.retailPrice).toBe(0)
  })

  it("falls back to the ledger's own fields when the product is missing", () => {
    const [row] = activityRows(
      CATALOG,
      [makeInventory({ productId: "ghost" })],
      NO_REVIEWS
    )
    expect(row.name).toBe("Ledger name")
    expect(row.category).toBe("Ledger category")
    expect(row.retailPrice).toBe(0)
  })

  it("reports no vendor when the product is missing, rather than the supplier", () => {
    // Vendor is the brand; the ledger's supplier is the distributor it is
    // restocked through. They are different companies, so the ledger has no
    // fallback to offer here: printing the supplier under a "Vendor" heading
    // was a wrong answer dressed as a fallback.
    const [row] = activityRows(
      CATALOG,
      [makeInventory({ productId: "ghost" })],
      NO_REVIEWS
    )
    expect(row.vendor).toBe("")
  })

  it("emits one row per tracked ledger row, not per product", () => {
    const rows = activityRows(
      CATALOG,
      [
        makeInventory({ id: "inv_1", productId: "tee" }),
        makeInventory({ id: "inv_2", productId: "boot" }),
      ],
      NO_REVIEWS
    )
    expect(rows).toHaveLength(2)
  })

  it("maps the ledger's stock states onto the grid's three", () => {
    const status = (item: Partial<InventoryItem> & { onHand?: number }) =>
      activityRows(CATALOG, [makeInventory(item)], NO_REVIEWS)[0].status
    expect(status({ status: "In stock" })).toBe("in_stock")
    expect(status({ status: "Low stock" })).toBe("low_stock")
    expect(status({ status: "Out of stock" })).toBe("out_of_stock")
  })

  it("reads Backordered and Discontinued by what is actually on hand", () => {
    const status = (item: Partial<InventoryItem> & { onHand?: number }) =>
      activityRows(CATALOG, [makeInventory(item)], NO_REVIEWS)[0].status
    // Backordered: below the reorder point with a PO raised.
    expect(
      status({ status: "Backordered", onHand: 24, reorderPoint: 110 })
    ).toBe("low_stock")
    // Discontinued: not a stock level; 60 on hand is still stock.
    expect(
      status({ status: "Discontinued", onHand: 60, reorderPoint: 0 })
    ).toBe("in_stock")
    expect(status({ status: "Discontinued", onHand: 0, reorderPoint: 0 })).toBe(
      "out_of_stock"
    )
  })

  it("takes updatedAt from the newest ledger movement", () => {
    const [row] = activityRows(
      CATALOG,
      [
        makeInventory({
          movements: [
            {
              id: "m1",
              kind: "Restock",
              title: "t",
              timeLabel: "Jun 14",
              author: { name: "A", initials: "A" },
            },
            {
              id: "m2",
              kind: "Sale",
              title: "t",
              timeLabel: "Jun 2",
              author: { name: "A", initials: "A" },
            },
          ],
        }),
      ],
      NO_REVIEWS
    )
    expect(row.updatedAt).toBe("Jun 14")
  })

  it("reports no rating rather than inventing one when a product has no reviews", () => {
    const [row] = activityRows(CATALOG, [makeInventory()], NO_REVIEWS)
    expect(row.rating).toBe(0)
    expect(row.reviewCount).toBe(0)
  })

  it("averages a product's approved reviews", () => {
    const rows = activityRows(
      CATALOG,
      [makeInventory({ productId: "tee" })],
      [
        makeReview({ id: "a", productId: "tee", rating: 5 }),
        makeReview({ id: "b", productId: "tee", rating: 4 }),
      ]
    )
    expect(rows[0].rating).toBe(4.5)
    expect(rows[0].reviewCount).toBe(2)
  })

  it("counts approved reviews only, so moderation cannot be bypassed", () => {
    // Regression guard: a pending or rejected submission must never move a
    // product's score, which is how the reviews module defines the rating.
    const rows = activityRows(
      CATALOG,
      [makeInventory({ productId: "tee" })],
      [
        makeReview({
          id: "a",
          productId: "tee",
          rating: 5,
          status: "approved",
        }),
        makeReview({ id: "b", productId: "tee", rating: 1, status: "pending" }),
        makeReview({
          id: "c",
          productId: "tee",
          rating: 1,
          status: "rejected",
        }),
      ]
    )
    expect(rows[0].rating).toBe(5)
    expect(rows[0].reviewCount).toBe(1)
  })

  it("does not credit one product's reviews to another", () => {
    const rows = activityRows(
      CATALOG,
      [makeInventory({ productId: "tee" })],
      [makeReview({ id: "a", productId: "sneaker", rating: 1 })]
    )
    expect(rows[0].rating).toBe(0)
    expect(rows[0].reviewCount).toBe(0)
  })
})

describe("cancelled orders (the money rule)", () => {
  const sale = makeOrder({
    id: "sold",
    lines: [makeLine({ id: "l1", productId: "tee", qty: 2, unitPrice: 50 })],
    totals: { subtotal: 100, shipping: 0, tax: 0, total: 100 },
  })
  const cancelled = makeOrder({
    id: "void",
    status: "cancelled",
    lines: [
      makeLine({ id: "l2", productId: "sneaker", qty: 4, unitPrice: 100 }),
    ],
    totals: { subtotal: 400, shipping: 0, tax: 0, total: 400 },
  })

  it("keeps a cancelled order out of revenue and units", () => {
    const [revenue, , , units] = salesStats([sale, cancelled], RANGE)
    expect(revenue.value).toBe(100)
    expect(units.value).toBe(2)
  })

  it("still counts a cancelled order as an order placed", () => {
    // The order happened, the sale did not.
    const [, orders] = salesStats([sale, cancelled], RANGE)
    expect(orders.value).toBe(2)
  })

  it("keeps the revenue, orders, and value tiles reconcilable", () => {
    // Average order value: net sales over orders PLACED. The three
    // tiles sit side by side, so a reader doing Revenue / Orders must land on
    // the number shown. Dividing by the sales instead (100/1 = 100) would read
    // as an arithmetic error on the page.
    const [revenue, orders, aov] = salesStats([sale, cancelled], RANGE)
    expect(aov.value).toBe(50)
    expect(aov.value).toBeCloseTo(revenue.value / orders.value, 2)
  })

  it("keeps a cancelled order out of category revenue and velocity", () => {
    const cats = topCategories([sale, cancelled], CATALOG, NO_ART, RANGE)
    expect(cats.map((c) => c.label)).toEqual(["Apparel"])
    expect(cats[0].unitsSold).toBe(2)
    expect(velocityByCategory([sale, cancelled], CATALOG, RANGE)).toEqual([
      { category: "Apparel", velocity: 2 },
    ])
  })

  it("reads a category that only sold this month as New, not a flat 0%", () => {
    const cats = topCategories([sale], CATALOG, NO_ART, RANGE)
    expect(cats[0].trend).toBe("New")
    expect(cats[0].trendDirection).toBe("up")
  })
})

// ── The real seed, end to end ──
//
// The fixtures above pin the math; these pin it to the SEED that actually ships,
// which anchors its dates to the current clock. If the rolling anchor stops
// putting orders in the dashboard's default window, the dashboard goes blank -
// and only this block would notice.

describe("real seed", () => {
  const now = new Date()
  /** Exactly what the dashboard shows on a cold load. */
  const DEFAULT = toDateRange(lastThirtyDays(now), ordersExtent(ORDERS, now))

  it("has orders in the current month to derive from", () => {
    const { current, previous } = splitOrdersByMonth(ORDERS, now)
    expect(current.length).toBeGreaterThan(0)
    expect(previous.length).toBeGreaterThan(0)
  })

  it("has orders in the default window, and in the one before it to compare against", () => {
    const { current, previous } = splitOrdersByRange(ORDERS, DEFAULT)
    expect(current.length).toBeGreaterThan(0)
    expect(previous.length).toBeGreaterThan(0)
  })

  it("produces sane, finite KPIs", () => {
    const stats = salesStats(ORDERS, DEFAULT)
    expect(stats).toHaveLength(4)
    for (const stat of stats) {
      expect(Number.isFinite(stat.value)).toBe(true)
      expect(Number.isFinite(stat.delta)).toBe(true)
      expect(Number.isFinite(stat.lastMonth)).toBe(true)
      expect(stat.value).toBeGreaterThan(0)
    }
    const revenue = stats[0]
    const orderCount = stats[1]
    const aov = stats[2]
    expect(revenue.title).toBe("Revenue")
    // AOV must reconcile with the other two tiles.
    expect(aov.value).toBeCloseTo(revenue.value / orderCount.value, 1)
  })

  it("resolves every order line in the default window to a real category", () => {
    const rows = velocityByCategory(ORDERS, PRODUCTS, DEFAULT)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.map((r) => r.category)).not.toContain("Unknown")
    // Ranked descending.
    const units = rows.map((r) => r.velocity)
    expect([...units].sort((a, b) => b - a)).toEqual(units)
  })

  it("ranks non-empty top categories, each with a real thumbnail", () => {
    const rows = topCategories(ORDERS, PRODUCTS, CATEGORIES, DEFAULT)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.label).not.toBe("Unknown")
      expect(row.thumbnail).not.toBe("")
      expect(row.unitsSold).toBeGreaterThan(0)
      // The whole trend vocabulary: an unsigned percentage (the direction is
      // carried by trendDirection, not the string) or "New". Both are real over
      // a rolling window - the seed reaches ~55 days back, so the 30 days before
      // the default window predate the first order in some categories, and a
      // category that sold for the first time there reads "New". Anything else,
      // "NaN%" or "Infinity%" included, fails here.
      expect(row.trend).toMatch(/^(New|\d+(\.\d)?%)$/)
      // Against the real taxonomy every row resolves to its own category page,
      // so the tile stops sending all of them to the same catalog.
      expect(row.categoryId).toBeTruthy()
      expect(CATEGORIES.some((c) => c.id === row.categoryId)).toBe(true)
    }
  })

  it("joins every ledger row to a product", () => {
    const rows = activityRows(PRODUCTS, INVENTORY_ITEMS, NO_REVIEWS)
    // Stock is held per sku, so the catalog decides the row count: one row per
    // variant of every product, drafts included. Counting INVENTORY_ITEMS here
    // would only assert that map() maps, and would stay green if the seed
    // dropped a variant.
    expect(rows).toHaveLength(skuCount(PRODUCTS))
    // Distinct skus, so the count above is one row per variant rather than one
    // variant counted many times.
    expect(new Set(rows.map((r) => r.sku)).size).toBe(skuCount(PRODUCTS))
    for (const row of rows) {
      expect(row.name).not.toBe("")
      expect(row.thumbnail).not.toBe("")
      // Every ledger row resolves, so none falls back to a 0 retail price.
      expect(row.retailPrice).toBeGreaterThan(0)
      expect(row.retailPrice).toBeGreaterThan(row.unitPrice)
    }
  })

  it("counts a sku for every catalog variant", () => {
    const expected = PRODUCTS.reduce((sum, p) => sum + p.variants.length, 0)
    expect(skuCount(PRODUCTS)).toBe(expected)
    expect(skuCount(PRODUCTS)).toBeGreaterThan(PRODUCTS.length)
  })
})
