import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import {
  inventoryRepository,
  ordersRepository,
  purchaseOrdersRepository,
} from "@/lib/data/repositories"
import { openPurchaseOrderQtyBySku } from "@/lib/data/purchase-orders"
import {
  levelAvailable,
  primaryLevel,
  sumLevels,
  type InventoryItem,
  type MovementKind,
  type StockLevel,
  type StockMovement,
  type StockStatus,
} from "@/lib/data/inventory"
import { allocatedFor, allocationsFromOrders } from "./allocations"
import { commitLevels } from "@/lib/data/commit-levels"

// Query keys for the stock ledger. `all` invalidates every inventory query.
export const inventoryKeys = {
  all: ["inventory"] as const,
  lists: () => [...inventoryKeys.all, "list"] as const,
}

/**
 * A stock row as the UI reads it: the stored item plus the totals summed across
 * its locations. The item holds no scalar onHand/allocated/available, so these
 * cannot go stale behind a per-location write.
 *
 * Same shape as buildCustomerRows in features/customers/queries.ts: join and sum
 * on the way out, never store the aggregate.
 */
/**
 * A level as the UI reads it: what is on the shelf, plus what the open orders
 * hold against it. The stored level carries only `onHand` - see StockLevel.
 */
export interface StockRowLevel extends StockLevel {
  /** Units committed to open orders shipping from this location. */
  allocated: number
  /** onHand minus allocated, floored at zero. */
  available: number
}

export interface StockRow extends Omit<InventoryItem, "levels"> {
  levels: StockRowLevel[]
  /** Summed across every level. */
  onHand: number
  allocated: number
  /** Sum of each level's own available, so one over-allocated location cannot
   *  be papered over by stock sitting somewhere else. */
  available: number
  /** The location holding the most stock; what the grid shows as "Location". */
  primaryLocationId: string
  /** The bin at the primary location. */
  bin: string
  /** True once stock sits at more than one location. */
  isMultiLocation: boolean
  /** Units inbound on OPEN purchase orders, joined at read time the same way
   *  `allocated` is. Nets into reorder membership so a SKU already on order is
   *  not surfaced (or re-suggested) as needing a purchase. */
  onOrder: number
}

/**
 * Join an item to what the order book holds against it.
 *
 * `allocations` comes from allocationsFromOrders. Defaulted to empty so a caller
 * that genuinely has no orders in hand (a preview of a level write, a fixture)
 * reads the shelf alone rather than being forced to invent an order book.
 */
export function buildStockRow(
  item: InventoryItem,
  allocations: ReadonlyMap<string, number> = new Map(),
  onOrderBySku: ReadonlyMap<string, number> = new Map()
): StockRow {
  const levels: StockRowLevel[] = item.levels.map((level) => {
    const allocated = allocatedFor(allocations, item.sku, level.locationId)
    return { ...level, allocated, available: levelAvailable(level, allocated) }
  })
  const primary = primaryLevel(levels)
  return {
    ...item,
    levels,
    onHand: sumLevels(levels, (l) => l.onHand),
    allocated: levels.reduce((sum, l) => sum + l.allocated, 0),
    available: levels.reduce((sum, l) => sum + l.available, 0),
    primaryLocationId: primary?.locationId ?? "",
    bin: primary?.bin ?? "",
    isMultiLocation: levels.filter((l) => l.onHand > 0).length > 1,
    onOrder: onOrderBySku.get(item.sku) ?? 0,
  }
}

export function buildStockRows(
  items: readonly InventoryItem[],
  allocations: ReadonlyMap<string, number> = new Map(),
  onOrderBySku: ReadonlyMap<string, number> = new Map()
): StockRow[] {
  return items.map((item) => buildStockRow(item, allocations, onOrderBySku))
}

/**
 * Does this row need reordering? The one definition of the queue's membership.
 *
 * A reorder point of 0 means "never reorder me" - it is what a discontinued row
 * publishes, because nothing is on order for something the store stopped
 * selling. That has to be excluded explicitly: once such a row also runs down to
 * 0 available, a bare `available <= reorderPoint` reads 0 <= 0 and admits it,
 * putting a discontinued sku in the queue suggesting a purchase order for 0
 * units.
 *
 * Nets OPEN POs: a SKU whose inbound stock lifts it past its reorder point is
 * already handled and drops out. Because every consumer reads this ONE
 * predicate - the /inventory "Reorder Risk" tile, the global "Low stock" badge,
 * and the /inventory/reorder queue - their counts cannot disagree.
 */
export function needsReorder(item: StockRow): boolean {
  return (
    item.reorderPoint > 0 && item.available + item.onOrder <= item.reorderPoint
  )
}

// List query. No `initialData`: the UI reads only from the store (in-memory in the
// demo), never from the in-code seed, so nothing renders before the DB read
// resolves. `staleTime: 0` revalidates after any mutation, matching orders.
export const inventoryItemsQuery = () =>
  queryOptions({
    queryKey: inventoryKeys.lists(),
    // Joins the order book, because `allocated` is a fact about orders: one pass
    // over both on the way out, the way buildCustomerRows joins orders for a
    // customer's totals. The key stays inventory-only and the read is invalidated
    // by order mutations through orderKeys - see useOrderTransition.
    queryFn: async () => {
      const [items, orders, purchaseOrders] = await Promise.all([
        inventoryRepository.list(),
        ordersRepository.list(),
        purchaseOrdersRepository.list(),
      ])
      return buildStockRows(
        items,
        allocationsFromOrders(orders),
        openPurchaseOrderQtyBySku(purchaseOrders)
      )
    },
    staleTime: 0,
  })

export function useInventoryItems() {
  return useQuery(inventoryItemsQuery())
}

// ── Writes on the ledger ──
//
// Two of them, both patching the row through useUpdateInventoryItem:
//
// 1. A stock ADJUSTMENT: a manual count against an item (add received stock,
//    remove shipped/lost units, or set the on-hand to a fresh physical count).
//    `available` is RECOMPUTED from on-hand minus allocated (never stored
//    stale), the status re-derives, and the change is appended as a signed
//    movement so the item's timeline is a real ledger. Available is always
//    computed as on-hand minus allocated, never stored.
//
// 2. An item EDIT: the fields a stock count cannot fix (supplierId, location,
//    bin, reorder point, safety stock, unit cost). Levels are deliberately NOT
//    editable here, so every quantity change stays in the movement ledger.

export type StockAdjustMode = "add" | "remove" | "set"

export interface StockAdjustInput {
  /** Which location's stock is being counted. An adjustment always names one. */
  locationId: string
  mode: StockAdjustMode
  quantity: number
  reason: MovementKind
  note?: string
  author: { name: string; initials: string; avatar?: string }
}

/**
 * Status from the item's TOTAL stock across locations. A discontinued item stays
 * discontinued: that is a decision, not a count.
 *
 * It reads ON-HAND, not available, and that is forced rather than chosen. Status
 * is a STORED field, so it can only be a function of stored data. Available now
 * depends on the open orders, which change without ever touching this row - a
 * status keyed to it would be stale the moment an order was placed, and stale in
 * a way no write to the item could fix. Low stock therefore means what it says:
 * the shelf is low. What is left of it after the order book has its share is the
 * row's `available`, which is derived on the way out and always current.
 */
function deriveStockStatus(
  item: InventoryItem,
  levels: readonly StockLevel[]
): StockStatus {
  if (item.status === "Discontinued") return "Discontinued"
  const onHand = sumLevels(levels, (l) => l.onHand)
  if (onHand <= 0) return "Out of stock"
  if (onHand <= item.reorderPoint) return "Low stock"
  return "In stock"
}

function movementTitle(reason: MovementKind, delta: number): string {
  const sign = delta > 0 ? "+" : ""
  return `${reason} ${sign}${delta.toLocaleString()} units`
}

/** The level for a location, or a fresh empty one: counting stock into a
 *  location the item has never held is how it gains a level. */
function levelAt(item: InventoryItem, locationId: string): StockLevel {
  return (
    item.levels.find((l) => l.locationId === locationId) ?? {
      locationId,
      bin: "",
      onHand: 0,
    }
  )
}

/**
 * Build the patch for a stock adjustment at ONE location: the new levels, the
 * lots that account for them, and a signed movement prepended to the ledger.
 * Pure, so the dialog can preview the result before committing.
 *
 * `available` is never written - it is computed from the levels on the way out
 * (buildStockRow). The levels themselves are not written here either: commitLevels
 * owns that, so an adjustment and a transfer cannot disagree about what a level
 * write means.
 */
export function applyStockAdjustment(
  item: InventoryItem,
  input: StockAdjustInput
): Pick<InventoryItem, "levels" | "lots" | "status" | "movements"> {
  const qty = Math.max(0, Math.round(input.quantity))
  const level = levelAt(item, input.locationId)
  const nextOnHand =
    input.mode === "set"
      ? qty
      : input.mode === "add"
        ? level.onHand + qty
        : Math.max(0, level.onHand - qty)
  const delta = nextOnHand - level.onHand
  const { levels, lots } = commitLevels(item, [
    { locationId: input.locationId, onHand: nextOnHand },
  ])
  const movement: StockMovement = {
    id: `mv-${Date.now()}-${item.movements.length}`,
    kind: input.reason,
    title: movementTitle(input.reason, delta),
    detail: input.note?.trim()
      ? input.note.trim()
      : `On hand ${level.onHand.toLocaleString()} to ${nextOnHand.toLocaleString()}`,
    timeLabel: "Just now",
    author: input.author,
    delta,
  }
  return {
    levels,
    lots,
    status: deriveStockStatus(item, levels),
    movements: [movement, ...item.movements],
  }
}

// ── Transfer ──
//
// Moving stock between two locations of the SAME item. There is no transfer
// entity: a transfer is just the on-hand set on both levels at once, which is
// exactly what this does. The movement row is ours, so the ledger still tells
// the story.
//
// The total on hand does not change - the stock moved, it was not created - so
// the movement carries no delta.

export interface StockTransferInput {
  fromLocationId: string
  toLocationId: string
  quantity: number
  note?: string
  author: { name: string; initials: string; avatar?: string }
}

export interface TransferValidation {
  /** Units actually movable: the source's available, never more. */
  maxQuantity: number
  error: string | null
}

/**
 * What may move out of a location: its AVAILABLE stock, not its on-hand.
 * Allocated units are committed to orders that ship from there, so moving them
 * would break those orders.
 */
export function validateTransfer(
  item: StockRow,
  input: Pick<
    StockTransferInput,
    "fromLocationId" | "toLocationId" | "quantity"
  >
): TransferValidation {
  // A StockRow rather than a bare item: only units the open orders are not
  // holding can move, and that is the row's business to know.
  const from = item.levels.find((l) => l.locationId === input.fromLocationId)
  const maxQuantity = from ? from.available : 0
  const qty = Math.round(input.quantity)
  if (!from) return { maxQuantity: 0, error: "That location holds no stock." }
  if (input.fromLocationId === input.toLocationId)
    return { maxQuantity, error: "Pick a different destination." }
  if (!input.toLocationId) return { maxQuantity, error: "Pick a destination." }
  if (qty <= 0) return { maxQuantity, error: "Enter how many units to move." }
  if (qty > maxQuantity)
    return {
      maxQuantity,
      error:
        maxQuantity === 0
          ? "Every unit here is allocated to an order."
          : `Only ${maxQuantity.toLocaleString()} available to move.`,
    }
  return { maxQuantity, error: null }
}

/**
 * Build the patch for a transfer. Pure, so the dialog can preview it. A source
 * emptied by the move keeps its level only if it still holds allocated units;
 * otherwise it drops out, so the row stops claiming a location it has left.
 */
export function applyStockTransfer(
  item: InventoryItem,
  input: StockTransferInput
): Pick<InventoryItem, "levels" | "lots" | "status" | "movements"> {
  const qty = Math.round(input.quantity)
  const from = levelAt(item, input.fromLocationId)
  const to = levelAt(item, input.toLocationId)

  // Both sides in ONE commit: the units leave and arrive as a single decision,
  // and the lots follow them rather than staying at a warehouse the stock left.
  const { levels, lots } = commitLevels(item, [
    { locationId: input.fromLocationId, onHand: from.onHand - qty },
    { locationId: input.toLocationId, onHand: to.onHand + qty },
  ])

  const movement: StockMovement = {
    id: `mv-${Date.now()}-${item.movements.length}`,
    kind: "Transfer",
    title: `Transferred ${qty.toLocaleString()} units`,
    detail: input.note?.trim() ? input.note.trim() : undefined,
    timeLabel: "Just now",
    author: input.author,
    // No delta: the item holds exactly as many units as before.
  }
  return {
    levels,
    lots,
    status: deriveStockStatus(item, levels),
    movements: [movement, ...item.movements],
  }
}

/** The fields an edit can change. Quantities are not among them: they move only
 *  through an adjustment or a transfer, so the ledger stays the whole story. */
export interface InventoryItemEdit {
  supplierId: string
  reorderPoint: number
  safetyStock: number
  unitCost: number
}

/**
 * Build the patch for an item edit. The status re-derives because reorderPoint
 * moves the low-stock threshold: raise it above `available` and the row is Low
 * stock immediately, which is also what puts it in the reorder queue.
 */
export function applyItemEdit(
  item: InventoryItem,
  edit: InventoryItemEdit
): Partial<InventoryItem> {
  const next = { ...item, ...edit }
  return {
    ...edit,
    status: deriveStockStatus(next, next.levels),
  }
}

// Optimistic, with a full-list rollback on error (the row's whole shape changes,
// so we snapshot the list rather than a single field), then invalidate so the
// derived KPI/stat headers recompute. Matches the orders/customers pattern.
// Adjustments, transfers and item edits all go through this one write.
//
// The cache holds StockRow (item + summed totals), so the optimistic update
// REBUILDS the row from the patched item rather than merging the patch in: a
// shallow merge would leave the old totals sitting next to the new levels.
export function useUpdateInventoryItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<InventoryItem>
    }) => inventoryRepository.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: inventoryKeys.lists() })
      const previous = queryClient.getQueryData<StockRow[]>(
        inventoryKeys.lists()
      )
      queryClient.setQueryData<StockRow[]>(inventoryKeys.lists(), (old) =>
        (old ?? []).map((item) =>
          item.id === id ? buildStockRow({ ...item, ...patch }) : item
        )
      )
      return { previous }
    },
    onError: (_error, _vars, ctx) => {
      if (ctx?.previous)
        queryClient.setQueryData(inventoryKeys.lists(), ctx.previous)
      toast.error("Could not save the change", {
        description: "Please try again.",
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
    },
  })
}
