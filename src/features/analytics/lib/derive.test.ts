import { describe, expect, it } from "vitest"

import type { SessionsDatum } from "@/lib/data/analytics"
import type { Order, OrderLine } from "@/lib/data/types"
import { overview } from "./derive"

// The analytics money math. Every figure here is joined at read time from the
// live orders, so these tests pin the rule the page cannot get wrong: what
// counts as a sale. How a line finds its category is the dashboard's rollup
// now, pinned by features/dashboard/derive.test.ts.

function makeLine(overrides: Partial<OrderLine> = {}): OrderLine {
  return {
    id: "L-1",
    productId: "boxy-pocket-tee",
    name: "Boxy Pocket Tee",
    sku: "AP-1001",
    color: "Black",
    qty: 2,
    unitPrice: 50,
    weight: 0.3,
    image: "",
    ...overrides,
  }
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  const lines = overrides.lines ?? [makeLine()]
  const subtotal = lines.reduce(
    (sum, line) => sum + line.qty * line.unitPrice,
    0
  )
  return {
    id: "SO-1",
    number: "#1",
    date: "2025-06-01T12:00:00.000Z",
    customer: {
      name: "Camila Reyes",
      email: "c@example.com",
      handle: "camila-reyes",
    },
    status: "fulfilled",
    payment: "paid",
    fulfillment: "fulfilled",
    totals: { subtotal, shipping: 0, tax: 0, total: subtotal },
    shipping: {} as Order["shipping"],
    ...overrides,
    lines,
  }
}

describe("overview", () => {
  const sessions: SessionsDatum[] = [
    { date: "2025-06-01", sessions: 60 },
    { date: "2025-06-02", sessions: 40 },
  ]

  it("counts a cancelled order as a conversion but not as revenue", () => {
    // The session did place an order, so it converted. The money it would have
    // brought in did not arrive, so it is not sales. Two different questions.
    const orders = [
      makeOrder({ id: "SO-1" }),
      makeOrder({ id: "SO-2", status: "cancelled" }),
    ]

    const result = overview(orders, sessions)

    expect(result.sales).toBe(100)
    expect(result.orders).toBe(2)
    expect(result.aov).toBe(100)
    expect(result.conversionRate).toBe(2)
  })

  it("reports zeroes rather than dividing by zero on an empty store", () => {
    expect(overview([], [])).toEqual({
      sales: 0,
      orders: 0,
      sessions: 0,
      conversionRate: 0,
      aov: 0,
    })
  })
})
