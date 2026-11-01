import { commitLevels } from "./commit-levels"
import type { InventoryItem } from "./inventory"
import type { Order } from "./types"

// What shipping an order does to the shelf.
//
// Fulfilling used to change three badges and move nothing. Ship three units and
// /inventory was byte-identical: the reorder queue never flagged the restock,
// and the store would happily oversell the same stock again. The template even
// conceded the rule - the adjust dialog defaults a removal's reason to "Sale" -
// so the only way stock ever moved was a human re-keying units a machine had
// just shipped.
//
// The release half needs nothing here: allocations are derived from the open
// orders, so an order that ships stops holding its units by no longer being
// open (features/inventory/allocations). This is only about the shelf.

/** A line could not be shipped, and why. */
export interface FulfilmentProblem {
  sku: string
  reason: "no-stock-row" | "not-stocked-here"
}

export interface FulfilmentPlan {
  /** One patch per item the order draws from, ready for the store to write. */
  writes: { itemId: string; patch: Pick<InventoryItem, "levels" | "lots"> }[]
  problems: FulfilmentProblem[]
}

/**
 * Work out what an order takes off the shelf when it ships.
 *
 * Pure: the store calls it and writes the result, and a test can ask what would
 * happen without one. Lines are keyed to a stock row by sku, and the whole order
 * ships from ONE origin (order.shipping.locationId), so every line draws from
 * that location - which is why an order can leave a location short rather than
 * silently borrowing from another warehouse.
 *
 * Units are taken even if it drives the shelf negative-in-spirit: on-hand floors
 * at zero, and the shortfall is real information, not something to refuse over.
 * Whether an order SHOULD be fulfillable is order-lifecycle's question; this only
 * answers what happens to the stock when it is.
 */
export function planFulfilment(
  order: Order,
  items: readonly InventoryItem[]
): FulfilmentPlan {
  const bySku = new Map(items.map((item) => [item.sku, item]))
  const locationId = order.shipping.locationId
  const problems: FulfilmentProblem[] = []

  // Sum by item first: two lines of the same sku draw from one shelf, and
  // committing them one at a time would let the second overwrite the first.
  const drawn = new Map<string, number>()
  for (const line of order.lines) {
    const item = bySku.get(line.sku)
    if (!item) {
      problems.push({ sku: line.sku, reason: "no-stock-row" })
      continue
    }
    drawn.set(item.id, (drawn.get(item.id) ?? 0) + line.qty)
  }

  const writes: FulfilmentPlan["writes"] = []
  for (const [itemId, qty] of drawn) {
    const item = items.find((i) => i.id === itemId)!
    const level = item.levels.find((l) => l.locationId === locationId)
    if (!level) {
      // The order says it ships from a place this item holds no stock at. Say so
      // rather than inventing a level and counting it down from zero.
      problems.push({ sku: item.sku, reason: "not-stocked-here" })
      continue
    }
    writes.push({
      itemId,
      patch: commitLevels(item, [{ locationId, onHand: level.onHand - qty }]),
    })
  }

  return { writes, problems }
}
