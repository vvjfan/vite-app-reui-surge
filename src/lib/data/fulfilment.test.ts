import { describe, expect, it } from "vitest"

import { planFulfilment } from "./fulfilment"
import type { InventoryItem } from "./inventory"
import type { Order, OrderLine } from "./types"

// What shipping an order does to the shelf.
//
// The invariant behind these: the units an order ships leave the location the
// order ships FROM, and they leave exactly once. Fulfilling used to move nothing
// at all, so a store could ship the same stock over and over.

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "inv_AP-1000",
    productId: "tee",
    name: "Boxy Pocket Tee",
    sku: "AP-1000",
    thumbnail: null,
    category: "Apparel",
    supplierId: "sup_atlas",
    levels: [
      { locationId: "loc_main", bin: "A-1", onHand: 300 },
      { locationId: "loc_east", bin: "B-1", onHand: 100 },
    ],
    lots: [
      { id: "lot_1", lot: "LOT-A", locationId: "loc_main", qty: 300, cost: 12 },
      { id: "lot_2", lot: "LOT-B", locationId: "loc_east", qty: 100, cost: 12 },
    ],
    reorderPoint: 20,
    unitCost: 12,
    status: "In stock",
    safetyStock: 10,
    leadTimeDays: 7,
    dailyVelocity: 2,
    upc: "0",
    movements: [],
    ...overrides,
  }
}

function makeLine(overrides: Partial<OrderLine> = {}): OrderLine {
  return {
    id: "L-1",
    productId: "tee",
    name: "Boxy Pocket Tee",
    sku: "AP-1000",
    color: "Black",
    qty: 3,
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
    totals: { subtotal: 108, shipping: 8, tax: 9, total: 125 },
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

const onHandAt = (
  plan: ReturnType<typeof planFulfilment>,
  itemId: string,
  locationId: string
) =>
  plan.writes
    .find((w) => w.itemId === itemId)
    ?.patch.levels.find((l) => l.locationId === locationId)?.onHand

describe("planFulfilment", () => {
  it("takes the line's units off the shelf", () => {
    const plan = planFulfilment(makeOrder(), [makeItem()])

    expect(onHandAt(plan, "inv_AP-1000", "loc_main")).toBe(297)
    expect(plan.problems).toEqual([])
  })

  it("draws from the location the order ships from, not the biggest one", () => {
    // The order names its origin. Taking the units from wherever there is most
    // stock would leave the shelf that actually shipped them still claiming to
    // hold them.
    const plan = planFulfilment(
      makeOrder({
        shipping: { ...makeOrder().shipping, locationId: "loc_east" },
      }),
      [makeItem()]
    )

    expect(onHandAt(plan, "inv_AP-1000", "loc_east")).toBe(97)
    expect(onHandAt(plan, "inv_AP-1000", "loc_main")).toBe(300)
  })

  it("draws two lines of the same sku from one shelf, once each", () => {
    // Committing them one at a time would let the second write overwrite the
    // first: both are computed from the same starting on-hand.
    const plan = planFulfilment(
      makeOrder({
        lines: [
          makeLine({ id: "L-1", qty: 3 }),
          makeLine({ id: "L-2", qty: 2 }),
        ],
      }),
      [makeItem()]
    )

    expect(plan.writes).toHaveLength(1)
    expect(onHandAt(plan, "inv_AP-1000", "loc_main")).toBe(295)
  })

  it("keeps two different skus apart", () => {
    const other = makeItem({
      id: "inv_FT-1040",
      sku: "FT-1040",
      productId: "sneaker",
      levels: [{ locationId: "loc_main", bin: "C-1", onHand: 50 }],
      lots: [
        {
          id: "lot_9",
          lot: "LOT-Z",
          locationId: "loc_main",
          qty: 50,
          cost: 40,
        },
      ],
    })
    const plan = planFulfilment(
      makeOrder({
        lines: [
          makeLine({ sku: "AP-1000", qty: 3 }),
          makeLine({ id: "L-2", sku: "FT-1040", qty: 1 }),
        ],
      }),
      [makeItem(), other]
    )

    expect(onHandAt(plan, "inv_AP-1000", "loc_main")).toBe(297)
    expect(onHandAt(plan, "inv_FT-1040", "loc_main")).toBe(49)
  })

  it("brings the lots down with the units", () => {
    const plan = planFulfilment(makeOrder(), [makeItem()])
    const write = plan.writes[0]
    const lotQty = write.patch.lots
      .filter((lot) => lot.locationId === "loc_main")
      .reduce((sum, lot) => sum + lot.qty, 0)

    expect(lotQty).toBe(297)
  })

  it("drops a level the order empties", () => {
    const plan = planFulfilment(
      makeOrder({ lines: [makeLine({ qty: 300 })] }),
      [makeItem()]
    )

    expect(plan.writes[0].patch.levels.map((l) => l.locationId)).toEqual([
      "loc_east",
    ])
  })

  it("floors the shelf at zero rather than going negative", () => {
    const plan = planFulfilment(
      makeOrder({ lines: [makeLine({ qty: 5000 })] }),
      [makeItem()]
    )

    // Whether it SHOULD have shipped is order-lifecycle's question. Once it has,
    // the shelf is empty, not minus 4,700.
    expect(
      plan.writes[0].patch.levels.find((l) => l.locationId === "loc_main")
    ).toBeUndefined()
  })

  it("reports a line whose sku resolves to no stock row", () => {
    const plan = planFulfilment(
      makeOrder({ lines: [makeLine({ sku: "GHOST-1" })] }),
      [makeItem()]
    )

    expect(plan.writes).toEqual([])
    expect(plan.problems).toEqual([{ sku: "GHOST-1", reason: "no-stock-row" }])
  })

  it("reports an order shipping from a location the item is not stocked at", () => {
    // Rather than inventing a level and counting it down from zero, which would
    // read as though the warehouse had shipped units it never held.
    const plan = planFulfilment(
      makeOrder({
        shipping: { ...makeOrder().shipping, locationId: "loc_brooklyn" },
      }),
      [makeItem()]
    )

    expect(plan.writes).toEqual([])
    expect(plan.problems).toEqual([
      { sku: "AP-1000", reason: "not-stocked-here" },
    ])
  })

  it("plans nothing for an order with no lines", () => {
    expect(planFulfilment(makeOrder({ lines: [] }), [makeItem()])).toEqual({
      writes: [],
      problems: [],
    })
  })
})
