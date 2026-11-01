import type { InventoryItem, StockLevel, StockLot } from "./inventory"

// The one place a stock level is written.
//
// A level does not stand alone: the units it counts are the same units the lots
// account for, and an emptied level should stop claiming a location. There were
// two writers - applyStockAdjustment and applyStockTransfer - and they each
// remembered a different half of that:
//
//   - transfer pruned an emptied level; adjustment left it behind, so the
//     location delete guard (which counts levels) blocked forever while the
//     transfer dialog (which offers sources with available units) would never
//     offer it. The operator was told to move stock that did not exist, using a
//     control that would not show it.
//   - neither reconciled `lots`, so any write left the detail sheet's hero
//     reading one number and the Lots section under it another, for the same
//     units. The seed maintains that invariant on every row and asserts it.
//
// Both funnel through one mutation whose patch type is Partial<InventoryItem>,
// wide enough to carry lots, so nothing at the type level flagged the omission.
// Routing every write through here is what makes them one decision rather than
// two that drift.
//
// Note what is NOT here: allocated. It is derived from the open orders (see
// features/inventory/allocations), so no level write can create or strand a
// reservation.
//
// It sits in lib/data rather than beside its callers because the repositories
// need it - fulfilling an order moves stock, and the store is what decides that.
// Same reason order-lifecycle.ts is here: a write RULE, not a feature's helper.

/**
 * An absolute statement about one location: what it holds now.
 *
 * Absolute rather than a delta, because callers already know the target (a set,
 * a transfer's two sides, a fulfilment's decrement) and a delta would make two
 * commits to the same location order-dependent.
 */
export interface LevelCommit {
  locationId: string
  /** New on-hand. Omit to leave it. Clamped at zero. */
  onHand?: number
  bin?: string
}

/** A level a location has never held: counting stock in is how it gains one. */
function levelFor(item: InventoryItem, locationId: string): StockLevel {
  return (
    item.levels.find((l) => l.locationId === locationId) ?? {
      locationId,
      bin: "",
      onHand: 0,
    }
  )
}

/**
 * Reconcile one location's lots against its on-hand.
 *
 * Lots carry provenance, levels carry the quantity, and they describe the same
 * units - so a level write has to say which batches gained or lost them.
 *
 * Drawing down takes from the lots in list order, which is the only order there
 * is: StockLot records no date, so "oldest first" is the position it sits in.
 * Adding puts the units on the last lot at that location rather than minting a
 * batch, because a batch code is a real-world fact about a delivery and this has
 * no way to know one. A location with no lots and stock arriving gets a single
 * lot standing for "not attributed to a batch", which is honest about what is
 * known rather than inventing a code that looks like provenance.
 */
function reconcileLots(
  lots: StockLot[],
  locationId: string,
  onHand: number,
  unitCost: number
): StockLot[] {
  const here = lots.filter((lot) => lot.locationId === locationId)
  const elsewhere = lots.filter((lot) => lot.locationId !== locationId)
  const current = here.reduce((sum, lot) => sum + lot.qty, 0)

  if (current === onHand) return lots

  if (onHand === 0) return elsewhere

  if (onHand < current) {
    let toRemove = current - onHand
    const drawn: StockLot[] = []
    for (const lot of here) {
      if (toRemove === 0) {
        drawn.push(lot)
        continue
      }
      const take = Math.min(lot.qty, toRemove)
      toRemove -= take
      const qty = lot.qty - take
      // A lot drawn to nothing is gone: it no longer accounts for anything.
      if (qty > 0) drawn.push({ ...lot, qty })
    }
    return interleave(lots, elsewhere, drawn, locationId)
  }

  // Growing.
  const added = onHand - current
  if (here.length === 0) {
    const lot: StockLot = {
      id: `${locationId}-lot-unattributed`,
      lot: "LOT-UNASSIGNED",
      locationId,
      qty: added,
      cost: unitCost,
    }
    return interleave(lots, elsewhere, [lot], locationId)
  }
  const last = here[here.length - 1]
  const grown = here.map((lot) =>
    lot === last ? { ...lot, qty: lot.qty + added } : lot
  )
  return interleave(lots, elsewhere, grown, locationId)
}

/**
 * Put a location's rebuilt lots back where they were in the item's list, so a
 * write does not reshuffle the Lots section of every other location.
 */
function interleave(
  original: StockLot[],
  elsewhere: StockLot[],
  here: StockLot[],
  locationId: string
): StockLot[] {
  const firstAt = original.findIndex((lot) => lot.locationId === locationId)
  if (firstAt === -1) return [...elsewhere, ...here]
  const before = elsewhere.filter((lot) => original.indexOf(lot) < firstAt)
  const after = elsewhere.filter((lot) => original.indexOf(lot) > firstAt)
  return [...before, ...here, ...after]
}

/**
 * Apply level commits to an item, returning the levels and lots that follow.
 *
 * Pure, so a dialog can preview the result before committing it. Every level
 * write goes through here: an adjustment, a transfer's two sides, and a
 * fulfilment's decrement are all the same operation with different targets.
 */
export function commitLevels(
  item: InventoryItem,
  commits: LevelCommit[]
): Pick<InventoryItem, "levels" | "lots"> {
  let levels = [...item.levels]
  let lots = [...item.lots]

  for (const commit of commits) {
    const current = levelFor(item, commit.locationId)
    const onHand = Math.max(0, Math.round(commit.onHand ?? current.onHand))
    const next: StockLevel = {
      locationId: commit.locationId,
      bin: commit.bin ?? current.bin,
      onHand,
    }

    const exists = levels.some((l) => l.locationId === commit.locationId)
    levels = exists
      ? levels.map((l) => (l.locationId === commit.locationId ? next : l))
      : [...levels, next]

    lots = reconcileLots(lots, commit.locationId, onHand, item.unitCost)
  }

  // A level that holds nothing stops claiming its location, so the row does not
  // go on advertising a warehouse its stock has left. This is the whole test now
  // that allocations are derived: a level cannot privately hold a reservation,
  // because a reservation lives in the order book. An open order against an
  // emptied location shows up as an oversell on the row, which is the honest
  // reading - the units are committed and they are not there.
  levels = levels.filter((l) => l.onHand > 0)

  return { levels, lots }
}
