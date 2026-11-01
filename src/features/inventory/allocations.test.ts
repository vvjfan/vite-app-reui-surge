import { describe, expect, it } from "vitest"

import type { Order, OrderLine } from "@/lib/data/types"
import { allocatedFor, allocationsFromOrders, isOpenOrder } from "./allocations"

// Allocations derived from the order book.
//
// The invariant behind all of these: an allocation exists because an open order
// exists. There is no other way to make one and no way to strand one - which is
// exactly what the stored field allowed, since only the seed ever wrote it.

function makeLine(overrides: Partial<OrderLine> = {}): OrderLine {
  return {
    id: "L-1",
    productId: "tee",
    name: "Boxy Pocket Tee",
    sku: "AP-1000",
    color: "Black",
    qty: 2,
    unitPrice: 36,
    weight: 0.4,
    image: "",
    ...overrides,
  }
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "SO-1042",
    number: "#1042",
    date: "2026-07-01T10:00:00.000Z",
    customer: {
      name: "Avery Chen",
      email: "a@example.com",
      handle: "avery-chen",
    },
    status: "processing",
    payment: "paid",
    fulfillment: "unfulfilled",
    lines: [makeLine()],
    totals: { subtotal: 72, shipping: 8, tax: 6, total: 86 },
    shipping: {
      priority: "Standard",
      method: "Ground",
      carrier: "UPS",
      locationId: "loc_main",
      from: "Main DC",
      to: "Brooklyn",
      destinationLabel: "Home",
      destinationLines: [],
    },
    ...overrides,
  }
}

describe("isOpenOrder", () => {
  it("holds stock for an order that is placed but not shipped", () => {
    expect(isOpenOrder(makeOrder({ status: "pending" }))).toBe(true)
    expect(isOpenOrder(makeOrder({ status: "processing" }))).toBe(true)
  })

  it("releases a cancelled order: it is not happening", () => {
    expect(isOpenOrder(makeOrder({ status: "cancelled" }))).toBe(false)
  })

  it("releases a fulfilled order: on-hand already recorded the units leaving", () => {
    // The sharp one. A fulfilled order still 'used' the stock, but counting it
    // here would take the units off the shelf a second time - onHand went down
    // when it shipped.
    expect(isOpenOrder(makeOrder({ status: "fulfilled" }))).toBe(false)
  })
})

describe("allocationsFromOrders", () => {
  it("commits a line's units at the location the order ships from", () => {
    const allocations = allocationsFromOrders([makeOrder()])
    expect(allocatedFor(allocations, "AP-1000", "loc_main")).toBe(2)
  })

  it("holds nothing at a location the order does not ship from", () => {
    const allocations = allocationsFromOrders([makeOrder()])
    expect(allocatedFor(allocations, "AP-1000", "loc_east")).toBe(0)
  })

  it("adds up every open order for the same sku at the same location", () => {
    const allocations = allocationsFromOrders([
      makeOrder({ id: "SO-1", lines: [makeLine({ qty: 2 })] }),
      makeOrder({ id: "SO-2", lines: [makeLine({ qty: 3 })] }),
    ])
    expect(allocatedFor(allocations, "AP-1000", "loc_main")).toBe(5)
  })

  it("keeps the same sku apart at two locations", () => {
    const allocations = allocationsFromOrders([
      makeOrder({ id: "SO-1", lines: [makeLine({ qty: 2 })] }),
      makeOrder({
        id: "SO-2",
        lines: [makeLine({ qty: 7 })],
        shipping: { ...makeOrder().shipping, locationId: "loc_east" },
      }),
    ])
    expect(allocatedFor(allocations, "AP-1000", "loc_main")).toBe(2)
    expect(allocatedFor(allocations, "AP-1000", "loc_east")).toBe(7)
  })

  it("counts each line of a multi-line order", () => {
    const allocations = allocationsFromOrders([
      makeOrder({
        lines: [
          makeLine({ id: "L-1", sku: "AP-1000", qty: 2 }),
          makeLine({ id: "L-2", sku: "FT-1040", qty: 1 }),
        ],
      }),
    ])
    expect(allocatedFor(allocations, "AP-1000", "loc_main")).toBe(2)
    expect(allocatedFor(allocations, "FT-1040", "loc_main")).toBe(1)
  })

  it("holds nothing for a cancelled order", () => {
    const allocations = allocationsFromOrders([
      makeOrder({ status: "cancelled" }),
    ])
    expect(allocatedFor(allocations, "AP-1000", "loc_main")).toBe(0)
  })

  it("releases the units when an order is fulfilled, with no release step", () => {
    // The whole point. The same order, one field different, and the allocation
    // is simply gone - nothing had to remember to undo it.
    const open = makeOrder({ status: "processing" })
    const shipped = { ...open, status: "fulfilled" as const }

    expect(
      allocatedFor(allocationsFromOrders([open]), "AP-1000", "loc_main")
    ).toBe(2)
    expect(
      allocatedFor(allocationsFromOrders([shipped]), "AP-1000", "loc_main")
    ).toBe(0)
  })

  it("holds nothing for an empty order book", () => {
    expect(allocationsFromOrders([]).size).toBe(0)
  })
})
