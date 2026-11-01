import { describe, expect, it } from "vitest"

import {
  applyTransition,
  canCancel,
  canDelete,
  canFulfill,
  canRefund,
  cancelOrder,
  checkDelete,
  fulfillOrder,
  planTransition,
  refundOrder,
  type OrderTransition,
} from "./order-lifecycle"
import type {
  FulfillmentStatus,
  Order,
  OrderStatus,
  PaymentStatus,
} from "./types"

// The order lifecycle: which transitions are legal, and what each one writes.
//
// The invariant behind every case here: a transition reads the order before it
// decides. The three call sites this module replaced each typed a patch literal
// by hand without looking at the order at all, which is how a cancelled order
// kept a live capture, a shipped order was cancelled into "unfulfilled", and a
// bulk fulfil un-cancelled a cancelled order back into revenue.

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "fulfilled",
  "cancelled",
]
const PAYMENT_STATUSES: PaymentStatus[] = ["paid", "pending", "refunded"]
const FULFILLMENT_STATUSES: FulfillmentStatus[] = [
  "unfulfilled",
  "partial",
  "fulfilled",
]

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "SO-1042",
    number: "#1042",
    date: "2026-07-01T10:00:00.000Z",
    customer: {
      name: "Avery Chen",
      email: "avery@example.com",
      handle: "avery-chen",
    },
    status: "processing",
    payment: "paid",
    fulfillment: "unfulfilled",
    lines: [],
    totals: { subtotal: 100, shipping: 10, tax: 8, total: 118 },
    shipping: {
      priority: "Standard",
      method: "Ground",
      carrier: "UPS",
      locationId: "loc_main",
      from: "Main DC",
      to: "Brooklyn, NY",
      destinationLabel: "Home",
      destinationLines: ["1 Example St"],
    },
    ...overrides,
  }
}

describe("cancelOrder", () => {
  it("refunds the payment when the order was paid", () => {
    const result = cancelOrder(
      makeOrder({ status: "processing", payment: "paid" })
    )

    expect(result).toEqual({
      ok: true,
      patch: { status: "cancelled", payment: "refunded" },
    })
  })

  it("leaves an unpaid order pending, rather than inventing a refund", () => {
    // Money that was never taken cannot come back. derivePayment says the same:
    // a cancelled order is refunded OR pending.
    const result = cancelOrder(
      makeOrder({ status: "pending", payment: "pending" })
    )

    expect(result).toEqual({ ok: true, patch: { status: "cancelled" } })
  })

  it("never writes fulfillment, so a cancel cannot erase a shipment", () => {
    // The old patch force-wrote fulfillment: "unfulfilled". The guard below makes
    // that field already correct, so the write is gone entirely - which is what
    // makes the defect unrepresentable rather than merely fixed.
    const result = cancelOrder(makeOrder())

    expect(result.ok).toBe(true)
    expect(result.ok && "fulfillment" in result.patch).toBe(false)
  })

  it("refuses once anything has shipped", () => {
    for (const fulfillment of ["partial", "fulfilled"] as const) {
      expect(cancelOrder(makeOrder({ fulfillment }))).toEqual({
        ok: false,
        reason: "shipped-cannot-cancel",
      })
    }
  })

  it("refuses a fulfilled order, whose answer is a refund instead", () => {
    const order = makeOrder({ status: "fulfilled", fulfillment: "fulfilled" })

    expect(cancelOrder(order)).toEqual({
      ok: false,
      reason: "shipped-cannot-cancel",
    })
    expect(canRefund(order)).toBe(true)
  })

  it("refuses an order that is already cancelled", () => {
    expect(cancelOrder(makeOrder({ status: "cancelled" }))).toEqual({
      ok: false,
      reason: "already-cancelled",
    })
  })
})

describe("fulfillOrder", () => {
  it("refuses a cancelled order, so a bulk fulfil cannot resurrect its revenue", () => {
    // The bug this exists for: bulk fulfil patched {status:"fulfilled"} onto every
    // selected id. A cancelled order silently became a sale again, and its total
    // reappeared on /dashboard and /analytics, because every money surface derives
    // from isSale at read time.
    expect(fulfillOrder(makeOrder({ status: "cancelled" }))).toEqual({
      ok: false,
      reason: "cancelled-cannot-fulfill",
    })
  })

  it("refuses an order that is already fulfilled", () => {
    expect(fulfillOrder(makeOrder({ status: "fulfilled" }))).toEqual({
      ok: false,
      reason: "already-fulfilled",
    })
  })

  it("moves both the status and the fulfillment axis", () => {
    expect(fulfillOrder(makeOrder({ status: "processing" }))).toEqual({
      ok: true,
      patch: { status: "fulfilled", fulfillment: "fulfilled" },
    })
  })
})

describe("refundOrder", () => {
  it("leaves the status alone: a refunded order is not a cancelled one", () => {
    const result = refundOrder(
      makeOrder({ status: "fulfilled", payment: "paid" })
    )

    expect(result).toEqual({ ok: true, patch: { payment: "refunded" } })
    expect(result.ok && "status" in result.patch).toBe(false)
  })

  it("refuses an order that was never paid", () => {
    expect(refundOrder(makeOrder({ payment: "pending" }))).toEqual({
      ok: false,
      reason: "not-paid",
    })
  })

  it("refuses an order that is already refunded", () => {
    expect(refundOrder(makeOrder({ payment: "refunded" }))).toEqual({
      ok: false,
      reason: "already-refunded",
    })
  })
})

describe("checkDelete", () => {
  it("refuses while the order still carries revenue", () => {
    // Deleting a live order rewrites already-reported revenue with no record it
    // ever existed: every money figure derives from the order book at read time.
    expect(
      checkDelete(makeOrder({ status: "fulfilled", payment: "paid" }))
    ).toEqual({
      ok: false,
      reason: "carries-revenue",
    })
  })

  it("allows a cancelled order", () => {
    expect(
      checkDelete(makeOrder({ status: "cancelled", payment: "refunded" }))
    ).toEqual({
      ok: true,
    })
  })

  it("allows a refunded order, whose money has already gone back", () => {
    expect(
      checkDelete(makeOrder({ status: "fulfilled", payment: "refunded" }))
    ).toEqual({
      ok: true,
    })
  })
})

describe("the transition rules as a whole", () => {
  const everyOrder = ORDER_STATUSES.flatMap((status) =>
    PAYMENT_STATUSES.flatMap((payment) =>
      FULFILLMENT_STATUSES.map((fulfillment) =>
        makeOrder({ status, payment, fulfillment })
      )
    )
  )
  const actions: OrderTransition[] = ["cancel", "fulfill", "refund"]

  it("answers every status x payment x fulfillment with a patch or a reason", () => {
    // A total function: no combination falls through to undefined. 4 x 3 x 3.
    for (const order of everyOrder) {
      for (const action of actions) {
        const result = applyTransition(order, action)
        expect(typeof result.ok).toBe("boolean")
        if (result.ok) expect(result.patch).toBeTruthy()
        else expect(result.reason).toBeTruthy()
      }
    }
  })

  it("keeps each predicate in step with its transition", () => {
    // The predicate drives `disabled=` and the transition drives the write. If
    // they can ever disagree, the UI offers an action the store then refuses.
    const pairs = [
      [canCancel, cancelOrder],
      [canFulfill, fulfillOrder],
      [canRefund, refundOrder],
    ] as const

    for (const order of everyOrder) {
      for (const [can, transition] of pairs) {
        expect(can(order)).toBe(transition(order).ok)
      }
      expect(canDelete(order)).toBe(checkDelete(order).ok)
    }
  })

  it("never returns a patch that leaves a cancelled order holding a capture", () => {
    // The headline defect, stated as a property rather than a case.
    for (const order of everyOrder) {
      const result = cancelOrder(order)
      if (!result.ok) continue
      const next = { ...order, ...result.patch }
      expect(next.payment).not.toBe("paid")
    }
  })
})

describe("planTransition", () => {
  it("splits a selection into what it will do and what it will not", () => {
    const live = makeOrder({ id: "SO-1", status: "processing" })
    const cancelled = makeOrder({ id: "SO-2", status: "cancelled" })
    const done = makeOrder({ id: "SO-3", status: "fulfilled" })

    const plan = planTransition([live, cancelled, done], "fulfill")

    expect(plan.applied.map((a) => a.order.id)).toEqual(["SO-1"])
    expect(plan.skipped).toEqual([
      { order: cancelled, reason: "cancelled-cannot-fulfill" },
      { order: done, reason: "already-fulfilled" },
    ])
  })

  it("plans nothing for an empty selection", () => {
    expect(planTransition([], "cancel")).toEqual({ applied: [], skipped: [] })
  })
})
