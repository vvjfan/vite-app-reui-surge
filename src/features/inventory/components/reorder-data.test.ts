import { describe, expect, it } from "vitest"

import type { StockRow } from "../queries"
import { deriveReorderStats, toReorderRows } from "./reorder-data"

// The reorder queue is only "real" if a raised purchase order changes what it
// asks for. These pin the netting: StockRow.onOrder (joined at the query seam)
// shrinks or clears the need, but the shelf truth (out of stock) is untouched
// by stock that has not arrived yet.

// Minimal StockRow: only the fields the reorder derivation reads. The rest of
// the shape is irrelevant here, so it is cast rather than fabricated.
function row(
  sku: string,
  available: number,
  reorderPoint: number,
  onOrder = 0
): StockRow {
  return {
    id: sku,
    productId: sku,
    name: sku,
    sku,
    thumbnail: null,
    available,
    reorderPoint,
    onOrder,
    unitCost: 10,
    supplierId: "sup",
    leadTimeDays: 7,
    dailyVelocity: 2,
    safetyStock: 0,
  } as unknown as StockRow
}

const NO_SUPPLIERS = [] as const

describe("reorder queue nets open purchase orders", () => {
  it("drops a SKU an open PO already covers", () => {
    // 40 short on the shelf; a PO for 60 lifts it past the reorder point.
    expect(toReorderRows([row("A", 10, 50)], NO_SUPPLIERS)).toHaveLength(1)
    expect(toReorderRows([row("A", 10, 50, 60)], NO_SUPPLIERS)).toHaveLength(0)
  })

  it("reduces the deficit and suggested quantity by units on order", () => {
    const [full] = toReorderRows([row("A", 10, 50)], NO_SUPPLIERS)
    const [netted] = toReorderRows([row("A", 10, 50, 20)], NO_SUPPLIERS)

    expect(netted.onOrder).toBe(20)
    expect(netted.deficit).toBeLessThan(full.deficit)
    expect(netted.suggestedPo).toBeLessThan(full.suggestedPo)
  })

  it("still counts an empty shelf as out of stock even when a PO covers it", () => {
    // The stock is on order but not here: it cannot fulfil an order today.
    const stats = deriveReorderStats([row("A", 0, 50, 100)])

    expect(stats.belowReorder).toBe(0) // nothing left to order
    expect(stats.outOfStock).toBe(1) // shelf is still empty
  })
})
