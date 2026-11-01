import { describe, expect, it } from "vitest"

import { type InventoryItem, type StockLevel } from "@/lib/data/inventory"
import { allocationKey } from "./allocations"
import { applyStockTransfer, buildStockRow, validateTransfer } from "./queries"

/** What the open orders hold, as the read model receives it. */
const heldAt = (sku: string, locationId: string, qty: number) =>
  new Map([[allocationKey(sku, locationId), qty]])

/**
 * The item as the UI reads it, with 40 of Main's units committed to open orders.
 * validateTransfer works off this rather than the bare item: how many units can
 * move is on-hand minus what the order book holds, and only the row knows that.
 */
const makeRow = (overrides: Partial<InventoryItem> = {}) =>
  buildStockRow(makeItem(overrides), heldAt("SKU-AP1001", "loc_main", 40))

// Moving stock between two of an item's locations.
//
// The invariant every one of these guards: a transfer MOVES stock, it never
// creates or destroys it. Total on hand before must equal total on hand after.
// That is the whole difference between a transfer and an adjustment, and it is
// the thing a hand-rolled "set both levels" implementation gets wrong.

const AUTHOR = { name: "Nick Bold", initials: "NB" }

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "inv_1",
    productId: "tee",
    name: "Boxy Pocket Tee",
    sku: "SKU-AP1001",
    thumbnail: null,
    category: "Apparel",
    supplierId: "sup_atlas",
    levels: [
      { locationId: "loc_main", bin: "A-1", onHand: 300 },
      { locationId: "loc_east", bin: "B-1", onHand: 100 },
    ],
    reorderPoint: 20,
    unitCost: 12,
    status: "In stock",
    safetyStock: 10,
    leadTimeDays: 7,
    dailyVelocity: 2,
    upc: "0",
    lots: [],
    movements: [],
    ...overrides,
  }
}

const totalOnHand = (levels: readonly StockLevel[]) =>
  levels.reduce((sum, l) => sum + l.onHand, 0)

const at = (levels: readonly StockLevel[], id: string) =>
  levels.find((l) => l.locationId === id)

describe("applyStockTransfer", () => {
  it("moves units between locations without changing the total", () => {
    const item = makeItem()
    const patch = applyStockTransfer(item, {
      fromLocationId: "loc_main",
      toLocationId: "loc_east",
      quantity: 120,
      author: AUTHOR,
    })

    expect(at(patch.levels, "loc_main")?.onHand).toBe(180)
    expect(at(patch.levels, "loc_east")?.onHand).toBe(220)
    // The point of the whole feature: stock moved, none was created.
    expect(totalOnHand(patch.levels)).toBe(totalOnHand(item.levels))
  })

  it("leaves allocated units where they are", () => {
    const item = makeItem()
    const patch = applyStockTransfer(item, {
      fromLocationId: "loc_main",
      toLocationId: "loc_east",
      quantity: 100,
      author: AUTHOR,
    })
    // A transfer moves units between shelves and says nothing about orders, so
    // the levels it writes carry on-hand and nothing else. What is committed is
    // derived from the order book and is untouched by a move.
    expect(at(patch.levels, "loc_main")).toEqual({
      locationId: "loc_main",
      bin: "A-1",
      onHand: 200,
    })
  })

  it("gives the item a level at a location it has never stocked", () => {
    const item = makeItem()
    const patch = applyStockTransfer(item, {
      fromLocationId: "loc_main",
      toLocationId: "loc_brooklyn",
      quantity: 50,
      author: AUTHOR,
    })
    expect(at(patch.levels, "loc_brooklyn")).toEqual({
      locationId: "loc_brooklyn",
      bin: "",
      onHand: 50,
    })
    expect(totalOnHand(patch.levels)).toBe(400)
  })

  it("drops a source the move empties, so the row stops claiming it", () => {
    const item = makeItem({
      levels: [
        { locationId: "loc_main", bin: "A-1", onHand: 60 },
        { locationId: "loc_east", bin: "B-1", onHand: 10 },
      ],
    })
    const patch = applyStockTransfer(item, {
      fromLocationId: "loc_main",
      toLocationId: "loc_east",
      quantity: 60,
      author: AUTHOR,
    })
    expect(at(patch.levels, "loc_main")).toBeUndefined()
    expect(at(patch.levels, "loc_east")?.onHand).toBe(70)
    expect(totalOnHand(patch.levels)).toBe(70)
  })

  it("keeps an emptied source that still owes allocated units", () => {
    // On hand hits zero but 40 are still committed to orders from here, so the
    // location is still part of this SKU's story and must not vanish.
    const item = makeItem({
      levels: [{ locationId: "loc_main", bin: "A-1", onHand: 40 }],
    })
    const patch = applyStockTransfer(item, {
      fromLocationId: "loc_main",
      toLocationId: "loc_east",
      quantity: 0,
      author: AUTHOR,
    })
    expect(at(patch.levels, "loc_main")).toBeDefined()
  })

  it("records a Transfer movement carrying no delta", () => {
    const item = makeItem()
    const patch = applyStockTransfer(item, {
      fromLocationId: "loc_main",
      toLocationId: "loc_east",
      quantity: 25,
      note: "balancing East DC",
      author: AUTHOR,
    })
    const [movement] = patch.movements
    expect(movement.kind).toBe("Transfer")
    expect(movement.detail).toBe("balancing East DC")
    expect(movement.author).toEqual(AUTHOR)
    // A delta would claim the item's on-hand changed. It did not.
    expect(movement.delta).toBeUndefined()
    expect(patch.movements).toHaveLength(item.movements.length + 1)
  })

  it("re-derives status from the summed levels, not one location", () => {
    // Neither location alone clears the reorder point; together they do. A
    // transfer must not flip the row to Low stock just by splitting it.
    const item = makeItem({
      reorderPoint: 150,
      levels: [{ locationId: "loc_main", bin: "A-1", onHand: 400 }],
    })
    const patch = applyStockTransfer(item, {
      fromLocationId: "loc_main",
      toLocationId: "loc_east",
      quantity: 200,
      author: AUTHOR,
    })
    expect(patch.status).toBe("In stock")
  })

  it("keeps a discontinued item discontinued", () => {
    const item = makeItem({ status: "Discontinued" })
    const patch = applyStockTransfer(item, {
      fromLocationId: "loc_main",
      toLocationId: "loc_east",
      quantity: 10,
      author: AUTHOR,
    })
    expect(patch.status).toBe("Discontinued")
  })
})

describe("validateTransfer", () => {
  it("caps the move at the source's available, not its on hand", () => {
    // 300 on the shelf at Main, 40 of them committed to open orders shipping
    // from there: only 260 can move.
    const item = buildStockRow(makeItem(), heldAt("SKU-AP1001", "loc_main", 40))
    const check = validateTransfer(item, {
      fromLocationId: "loc_main",
      toLocationId: "loc_east",
      quantity: 300,
    })
    expect(check.maxQuantity).toBe(260)
    expect(check.error).toBe("Only 260 available to move.")
  })

  it("accepts a move of exactly the available units", () => {
    const item = makeRow()
    expect(
      validateTransfer(item, {
        fromLocationId: "loc_main",
        toLocationId: "loc_east",
        quantity: 260,
      }).error
    ).toBeNull()
  })

  it("rejects a location holding nothing but allocated stock", () => {
    const item = makeRow({
      levels: [{ locationId: "loc_main", bin: "A-1", onHand: 40 }],
    })
    const check = validateTransfer(item, {
      fromLocationId: "loc_main",
      toLocationId: "loc_east",
      quantity: 1,
    })
    expect(check.maxQuantity).toBe(0)
    expect(check.error).toBe("Every unit here is allocated to an order.")
  })

  it("rejects a move to the same place, a missing destination, and zero units", () => {
    const item = makeRow()
    const from = "loc_main"
    expect(
      validateTransfer(item, {
        fromLocationId: from,
        toLocationId: from,
        quantity: 5,
      }).error
    ).toBe("Pick a different destination.")
    expect(
      validateTransfer(item, {
        fromLocationId: from,
        toLocationId: "",
        quantity: 5,
      }).error
    ).toBe("Pick a destination.")
    expect(
      validateTransfer(item, {
        fromLocationId: from,
        toLocationId: "loc_east",
        quantity: 0,
      }).error
    ).toBe("Enter how many units to move.")
  })

  it("rejects a source the item holds no stock at", () => {
    const item = makeRow()
    expect(
      validateTransfer(item, {
        fromLocationId: "loc_nowhere",
        toLocationId: "loc_east",
        quantity: 5,
      }).error
    ).toBe("That location holds no stock.")
  })
})

describe("buildStockRow", () => {
  it("sums the totals across locations and names the biggest as primary", () => {
    const row = buildStockRow(makeItem(), heldAt("SKU-AP1001", "loc_main", 40))
    expect(row.onHand).toBe(400)
    expect(row.allocated).toBe(40)
    expect(row.available).toBe(360)
    expect(row.primaryLocationId).toBe("loc_main")
    expect(row.bin).toBe("A-1")
    expect(row.isMultiLocation).toBe(true)
  })

  it("sums each location's own available, so one cannot mask another", () => {
    // Main is over-allocated; its own available floors at 0 rather than eating
    // into East's stock, which is committed to nobody.
    const row = buildStockRow(
      makeItem({
        levels: [
          { locationId: "loc_main", bin: "A-1", onHand: 10 },
          { locationId: "loc_east", bin: "B-1", onHand: 100 },
        ],
      }),
      heldAt("SKU-AP1001", "loc_main", 40)
    )
    expect(row.available).toBe(100)
    expect(row.levels.reduce((sum, l) => sum + l.available, 0)).toBe(100)
  })

  it("does not call a single-location row multi-location", () => {
    const row = buildStockRow(
      makeItem({
        levels: [
          { locationId: "loc_main", bin: "A-1", onHand: 300 },
          { locationId: "loc_east", bin: "B-1", onHand: 0 },
        ],
      })
    )
    expect(row.isMultiLocation).toBe(false)
  })
})
