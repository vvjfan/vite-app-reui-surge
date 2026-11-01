// Purchase orders: what the store has ordered from a supplier to refill stock.
//
// A PO is raised for one supplier and one receiving location, carries a line
// per SKU (quantity + the unit cost at order time), and moves through a small
// lifecycle: draft -> received (stock arrives, on-hand goes up) or draft ->
// cancelled. Receiving is the only write that touches inventory, and the demo
// repository does it in one transaction so the PO and the shelf agree.
//
// The domain already referenced POs before this entity existed - a restock
// movement cites a "PO-####", and "Backordered" means an open PO against
// committed stock - so orders here mint ids on that same PO-#### sequence.

import { INVENTORY_ITEMS } from "./inventory"
import { SUPPLIERS, supplierName } from "./suppliers"

// The first stock row per product, so a seeded PO line resolves its REAL sku,
// unit cost and photo from the catalog. This is what makes a seeded PO
// receivable: receive() matches the line's sku to a stock row, and these are
// the store's own skus. The supplier name comes off the entity, never typed.
const INV_BY_PRODUCT = new Map<string, (typeof INVENTORY_ITEMS)[number]>()
for (const item of INVENTORY_ITEMS) {
  if (!INV_BY_PRODUCT.has(item.productId))
    INV_BY_PRODUCT.set(item.productId, item)
}

export type PurchaseOrderStatus = "draft" | "received" | "cancelled"

export interface PurchaseOrderLine {
  /** Product.id, the join used to find the stock row when the PO is received. */
  productId: string
  sku: string
  name: string
  thumbnail: string | null
  quantity: number
  /** Unit cost snapshotted at order time, so the PO total is stable even if the
   *  item's cost is edited later. */
  unitCost: number
}

export interface PurchaseOrder {
  /** "PO-2041". Not a slug - POs are not URL-addressed. */
  id: string
  supplierId: string
  /** Denormalized supplier name, snapshotted so the row reads without a join. */
  supplierName: string
  /** Where the stock lands when the PO is received (StockLocation.id). */
  locationId: string
  status: PurchaseOrderStatus
  lines: PurchaseOrderLine[]
  /** ISO date the goods are expected. Optional: a draft may not commit to one. */
  expectedDate?: string
  note?: string
  /** ISO 8601. */
  createdAt: string
  /** ISO 8601, set when the PO is received. */
  receivedAt?: string
}

/** Total units across a PO's lines. */
export function purchaseOrderUnits(po: PurchaseOrder): number {
  return po.lines.reduce((sum, line) => sum + line.quantity, 0)
}

/**
 * Units on order per SKU, from OPEN (draft) POs only - the "incoming" quantity
 * the reorder queue nets against, so a SKU a raised PO already covers is not
 * re-suggested. Received POs are excluded (their stock already landed on the
 * shelf and is counted in on-hand); cancelled POs bring nothing.
 */
export function openPurchaseOrderQtyBySku(
  orders: readonly PurchaseOrder[]
): Map<string, number> {
  const bySku = new Map<string, number>()
  for (const order of orders) {
    if (order.status !== "draft") continue
    for (const line of order.lines) {
      bySku.set(line.sku, (bySku.get(line.sku) ?? 0) + line.quantity)
    }
  }
  return bySku
}

/** Order value: quantity × unit cost, summed. */
export function purchaseOrderTotal(po: PurchaseOrder): number {
  return po.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0)
}

/**
 * The operative date and its label: received wins, else expected, else raised.
 * The Date column and its sort accessor both read this, so the column cannot
 * sort by one date and display another.
 */
export function purchaseOrderDate(po: PurchaseOrder): {
  label: "Received" | "Expected" | "Raised"
  iso: string
} {
  if (po.status === "received" && po.receivedAt) {
    return { label: "Received", iso: po.receivedAt }
  }
  if (po.expectedDate) return { label: "Expected", iso: po.expectedDate }
  return { label: "Raised", iso: po.createdAt }
}

/**
 * The next PO id on the shared PO-#### sequence, one above the highest already
 * in the store. Held at 2040 so the first minted order is PO-2041, continuing
 * the numbers the seed and the restock movements already use.
 */
export function nextPurchaseOrderId(existing: PurchaseOrder[]): string {
  const max = existing.reduce((m, po) => {
    const n = Number(po.id.replace(/\D/g, ""))
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 2040)
  return `PO-${max + 1}`
}

/**
 * Suggested order quantity for a SKU: enough to clear the reorder gap, rounded
 * up to a pack of ten and never below the raw deficit. Same rule the reorder
 * queue drafts with, shared so the ledger and the queue never disagree.
 */
export function suggestedOrderQuantity(
  reorderPoint: number,
  available: number
): number {
  const deficit = Math.max(0, reorderPoint - available)
  return Math.max(deficit, Math.ceil((reorderPoint * 2 - available) / 10) * 10)
}

// A fixed clock keeps createdAt/receivedAt deterministic in the seed (no
// Date.now, which would make the samples differ per load).
const PO_BASE_MS = new Date("2026-07-14T09:00:00.000Z").getTime()
const DAY_MS = 86_400_000

function daysBefore(days: number): string {
  return new Date(PO_BASE_MS - days * DAY_MS).toISOString()
}

function daysAfter(days: number): string {
  return new Date(PO_BASE_MS + days * DAY_MS).toISOString().slice(0, 10)
}

// Line details resolve from the catalog by productId; only the quantity is
// authored here. Resolving the sku from the store is what makes a seeded PO
// genuinely receivable - receive() matches on sku, and these are real skus.
function poLine(productId: string, quantity: number): PurchaseOrderLine {
  const inv = INV_BY_PRODUCT.get(productId)
  return {
    productId,
    sku: inv?.sku ?? productId.toUpperCase(),
    name: inv?.name ?? productId,
    thumbnail: inv?.thumbnail ?? null,
    quantity,
    unitCost: inv?.unitCost ?? 0,
  }
}

// The supplier name is snapshotted from the entity, never typed.
function makePo(input: Omit<PurchaseOrder, "supplierName">): PurchaseOrder {
  return {
    ...input,
    supplierName: supplierName(SUPPLIERS, input.supplierId),
  }
}

// Seeded purchase orders: open drafts spread across suppliers and locations
// (so the reorder queue has real incoming stock to net against), two received
// for history, and one cancelled - every status, filter and receive path has
// something real to act on. Ids sit on the PO-#### sequence; nextPurchaseOrderId
// mints above the highest here.
export const PURCHASE_ORDERS: PurchaseOrder[] = [
  makePo({
    id: "PO-2041",
    supplierId: "sup_atlas",
    locationId: "loc_main",
    status: "draft",
    createdAt: daysBefore(2),
    expectedDate: daysAfter(9),
    note: "Restock ahead of the seasonal peak.",
    lines: [
      poLine("pima-cotton-crewneck", 160),
      poLine("boxy-pocket-tee", 120),
    ],
  }),
  makePo({
    id: "PO-2040",
    supplierId: "sup_cedar",
    locationId: "loc_east",
    status: "draft",
    createdAt: daysBefore(3),
    expectedDate: daysAfter(6),
    lines: [poLine("trail-runner-gtx", 90)],
  }),
  makePo({
    id: "PO-2039",
    supplierId: "sup_harbor",
    locationId: "loc_main",
    status: "draft",
    createdAt: daysBefore(4),
    expectedDate: daysAfter(12),
    lines: [poLine("everyday-tote", 200), poLine("commuter-backpack", 80)],
  }),
  makePo({
    id: "PO-2037",
    supplierId: "sup_meridian",
    locationId: "loc_brooklyn",
    status: "draft",
    createdAt: daysBefore(5),
    expectedDate: daysAfter(5),
    note: "Split shipment accepted.",
    lines: [
      poLine("merino-ribbed-beanie", 140),
      poLine("silk-blend-scarf", 90),
    ],
  }),
  makePo({
    id: "PO-2035",
    supplierId: "sup_atlas",
    locationId: "loc_main",
    status: "draft",
    createdAt: daysBefore(7),
    expectedDate: daysAfter(11),
    lines: [
      poLine("linen-camp-shirt", 110),
      poLine("recycled-wool-overshirt", 60),
    ],
  }),
  makePo({
    id: "PO-2033",
    supplierId: "sup_harbor",
    locationId: "loc_main",
    status: "received",
    createdAt: daysBefore(21),
    receivedAt: daysBefore(12),
    lines: [
      poLine("quilted-field-jacket", 120),
      poLine("storm-shell-parka", 70),
    ],
  }),
  makePo({
    id: "PO-2031",
    supplierId: "sup_cedar",
    locationId: "loc_east",
    status: "received",
    createdAt: daysBefore(26),
    receivedAt: daysBefore(18),
    lines: [
      poLine("selvedge-slim-denim", 90),
      poLine("denim-trucker-jacket", 80),
    ],
  }),
  makePo({
    id: "PO-2029",
    supplierId: "sup_meridian",
    locationId: "loc_brooklyn",
    status: "cancelled",
    createdAt: daysBefore(14),
    note: "Supplier could not meet the lead time.",
    lines: [poLine("compression-long-sleeve", 60)],
  }),
  makePo({
    id: "PO-2028",
    supplierId: "sup_cedar",
    locationId: "loc_main",
    status: "draft",
    createdAt: daysBefore(6),
    expectedDate: daysAfter(8),
    lines: [
      poLine("seamless-training-tee", 100),
      poLine("suede-chukka-boot", 50),
    ],
  }),
]
