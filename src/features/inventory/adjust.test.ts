import { describe, expect, it } from "vitest"

import {
  sumLevels,
  type InventoryItem,
  type StockLot,
} from "@/lib/data/inventory"
import { applyStockAdjustment, buildStockRow } from "./queries"

// Counting stock up or down at one location.
//
// The sibling of transfer.test.ts, and the invariants are the mirror image: a
// transfer MOVES stock and must not change the total, an adjustment CHANGES the
// total and must not move anything. What both share is what a level write owes
// the rest of the row: the lots that account for those units, and an emptied
// level that should stop claiming a location.
//
// transfer.test.ts fixtures every item with `lots: []`, which is why the lots
// invariant has never been exercised by a runtime write. These carry real lots.

const AUTHOR = { name: "Nick Bold", initials: "NB" }

function makeLot(overrides: Partial<StockLot> = {}): StockLot {
  return {
    id: "lot_1",
    lot: "LOT-A",
    locationId: "loc_main",
    qty: 300,
    cost: 12,
    ...overrides,
  }
}

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
    lots: [
      makeLot({ id: "lot_1", lot: "LOT-A", locationId: "loc_main", qty: 200 }),
      makeLot({ id: "lot_2", lot: "LOT-B", locationId: "loc_main", qty: 100 }),
      makeLot({ id: "lot_3", lot: "LOT-C", locationId: "loc_east", qty: 100 }),
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

/** The seed's own invariant (seed-integrity.test.ts), asked of a WRITTEN row. */
function lotsBackEachLevel(
  item: InventoryItem
): { locationId: string; onHand: number; lotQty: number }[] {
  return item.levels.map((level) => ({
    locationId: level.locationId,
    onHand: level.onHand,
    lotQty: item.lots
      .filter((lot) => lot.locationId === level.locationId)
      .reduce((sum, lot) => sum + lot.qty, 0),
  }))
}

describe("applyStockAdjustment: the quantity", () => {
  it("sets an absolute on-hand", () => {
    const patch = applyStockAdjustment(makeItem(), {
      locationId: "loc_main",
      mode: "set",
      quantity: 250,
      reason: "Adjustment",
      author: AUTHOR,
    })
    expect(patch.levels.find((l) => l.locationId === "loc_main")?.onHand).toBe(
      250
    )
  })

  it("leaves the other locations alone", () => {
    const patch = applyStockAdjustment(makeItem(), {
      locationId: "loc_main",
      mode: "remove",
      quantity: 100,
      reason: "Sale",
      author: AUTHOR,
    })
    expect(patch.levels.find((l) => l.locationId === "loc_east")?.onHand).toBe(
      100
    )
  })

  it("counts the shelf without touching what orders hold against it", () => {
    // An adjustment is a statement about the shelf. What is committed to orders
    // is not on the level at all - it is derived from the order book - so a
    // recount cannot silently release or strand a reservation.
    const patch = applyStockAdjustment(makeItem(), {
      locationId: "loc_main",
      mode: "set",
      quantity: 250,
      reason: "Adjustment",
      author: AUTHOR,
    })
    const level = patch.levels.find((l) => l.locationId === "loc_main")
    expect(level).toEqual({ locationId: "loc_main", bin: "A-1", onHand: 250 })
  })
})

describe("applyStockAdjustment: what a level write owes the row", () => {
  it("keeps the lots at a location summing to that location's on-hand", () => {
    // The invariant the seed maintains for every row and asserts in
    // seed-integrity.test.ts ("backs each level's onHand with the lots at THAT
    // location"). A write that moves onHand without touching lots leaves the
    // detail sheet's hero reading one number and the Lots section below it
    // another, for the same units.
    const item = makeItem()
    const patch = applyStockAdjustment(item, {
      locationId: "loc_main",
      mode: "remove",
      quantity: 100,
      reason: "Sale",
      author: AUTHOR,
    })
    const written = { ...item, ...patch }

    for (const row of lotsBackEachLevel(written)) {
      expect(row.lotQty, `lots at ${row.locationId} vs its on-hand`).toBe(
        row.onHand
      )
    }
  })

  it("accounts for every lot in the summed levels", () => {
    const item = makeItem()
    const patch = applyStockAdjustment(item, {
      locationId: "loc_main",
      mode: "set",
      quantity: 50,
      reason: "Adjustment",
      author: AUTHOR,
    })
    const written = { ...item, ...patch }

    const lotQty = written.lots.reduce((sum, lot) => sum + lot.qty, 0)
    expect(lotQty).toBe(sumLevels(written.levels, (l) => l.onHand))
  })

  it("drops a level an adjustment empties, exactly as a transfer does", () => {
    // applyStockTransfer prunes an emptied source (transfer.test.ts pins it).
    // An adjustment leaves the empty level behind, and the two write paths then
    // disagree about what an emptied location means. The consequence is a
    // deadlock: the location delete guard counts levels, so the location can
    // never be deleted, while the transfer dialog filters sources on available
    // units and will never offer it - the operator is told to move stock that
    // does not exist, with a control that will not offer it.
    const item = makeItem({
      levels: [
        { locationId: "loc_main", bin: "A-1", onHand: 300 },
        { locationId: "loc_east", bin: "B-1", onHand: 100 },
      ],
      lots: [makeLot({ id: "lot_3", locationId: "loc_east", qty: 100 })],
    })
    const patch = applyStockAdjustment(item, {
      locationId: "loc_east",
      mode: "set",
      quantity: 0,
      reason: "Adjustment",
      author: AUTHOR,
    })

    expect(patch.levels.map((l) => l.locationId)).toEqual(["loc_main"])
  })

  it("drops an emptied level even while orders are still open against it", () => {
    // The level is a statement about the shelf, and the shelf is empty, so it
    // goes. The open order does not keep it alive: the commitment lives in the
    // order book, and the row reports it as an oversell - units committed that
    // are not there. That is the honest reading, and it is only expressible
    // because the two facts are no longer stored in the same place.
    const item = makeItem({
      levels: [
        { locationId: "loc_main", bin: "A-1", onHand: 300 },
        { locationId: "loc_east", bin: "B-1", onHand: 100 },
      ],
      lots: [],
    })
    const patch = applyStockAdjustment(item, {
      locationId: "loc_east",
      mode: "set",
      quantity: 0,
      reason: "Adjustment",
      author: AUTHOR,
    })

    expect(patch.levels.map((l) => l.locationId)).toEqual(["loc_main"])
  })
})

describe("applyStockAdjustment: the ledger", () => {
  it("records a signed movement", () => {
    const patch = applyStockAdjustment(makeItem(), {
      locationId: "loc_main",
      mode: "remove",
      quantity: 100,
      reason: "Sale",
      author: AUTHOR,
    })
    expect(patch.movements[0]).toMatchObject({ kind: "Sale", delta: -100 })
  })

  it("re-derives the status from the levels it wrote", () => {
    const patch = applyStockAdjustment(makeItem(), {
      locationId: "loc_main",
      mode: "set",
      quantity: 0,
      reason: "Adjustment",
      author: AUTHOR,
    })
    // loc_east still holds 100, so the item is not out of stock.
    expect(patch.status).toBe("In stock")
    expect(buildStockRow({ ...makeItem(), ...patch }).onHand).toBe(100)
  })
})
