import {
  CheckCircleIcon as CircleCheckIcon,
  InfoIcon,
} from "@phosphor-icons/react"

import { supplierName, type Supplier } from "@/lib/data/suppliers"
import { suggestedOrderQuantity } from "@/lib/data/purchase-orders"
import { needsReorder, type StockRow } from "../queries"

// What's on the shelf plus what's inbound on open POs. StockRow.onOrder is
// joined at the query seam, so every reorder metric here reads one netted value
// and no caller has to remember to thread it.
function effectiveAvailable(item: StockRow): number {
  return item.available + item.onOrder
}

// Presentational config + derivation for the reorder queue. This is the CODE
// half of the donor block's data module: toast icons, the row/status types,
// filter options, and the search/urgency helpers. The DATA half (the rows and
// the KPI summary) is DERIVED from the same store-backed StockRow[] the stock
// ledger reads; the reorder queue is a view of the items at or below their
// reorder point, not a separate table.
//
// StockRow, not InventoryItem: reorder is a SKU-level decision, so every metric
// here works off the totals already summed across the item's locations. Which
// shelf the units sit on does not change whether the SKU needs reordering.

// ── Toast icons ──

export const TOAST_SUCCESS_ICON = (
  <CircleCheckIcon className="size-[18px] text-success" aria-hidden="true" />
)

export const TOAST_INFO_ICON = (
  <InfoIcon className="size-[18px] text-muted-foreground" aria-hidden="true" />
)

// ── Row + status types ──

export type ReorderStatus = "low_stock" | "out_of_stock"

export interface ReorderRow {
  id: string
  /** The product this SKU belongs to (Product.id), the /products link target. */
  productId: string
  name: string
  sku: string
  thumbnail: string | null
  available: number
  reorderPoint: number
  deficit: number
  suggestedPo: number
  /** Units already inbound on open POs, netted into deficit + suggestedPo. */
  onOrder: number
  /** The supplier entity this row reorders from - what the filter matches. */
  supplierId: string
  /** Resolved supplier NAME. Carried on the row so display, sort and search
   *  stay plain strings and never resolve an id themselves. */
  supplier: string
  leadTimeDays: number
  daysOfCover: number
  /** Units sold per day, the rate the detail sheet projects the burn-down at. */
  dailyVelocity: number
  /** The floor the reorder point is meant to protect. */
  safetyStock: number
  /** Buy price per unit, snapshotted onto a drafted PO line. */
  unitCost: number
  status: ReorderStatus
}

// ── Derivation: StockRow[] -> ReorderRow[] ──
//
// The queue keeps only items at or below their reorder point. Each metric is
// computed from the item so the page never carries a second copy of the data.

function toReorderRow(
  item: StockRow,
  suppliers: readonly Supplier[]
): ReorderRow {
  // Deficit and the suggested quantity close the gap the OPEN POs do not
  // already cover, so a raised PO shrinks the ask rather than being ignored.
  // suggestedOrderQuantity is the one shared pack-rounding rule the ledger uses.
  const effective = effectiveAvailable(item)
  const deficit = Math.max(0, item.reorderPoint - effective)
  const suggestedPo = suggestedOrderQuantity(item.reorderPoint, effective)
  // Days of cover and status read the SHELF (available), not the incoming: the
  // stock is not here yet, so it cannot fulfil an order or lift out-of-stock.
  const daysOfCover =
    item.dailyVelocity > 0 ? Math.round(item.available / item.dailyVelocity) : 0
  const status: ReorderStatus =
    item.available <= 0 ? "out_of_stock" : "low_stock"

  return {
    id: item.id,
    productId: item.productId,
    name: item.name,
    sku: item.sku,
    thumbnail: item.thumbnail,
    available: item.available,
    reorderPoint: item.reorderPoint,
    deficit,
    suggestedPo,
    onOrder: item.onOrder,
    supplierId: item.supplierId,
    supplier: supplierName(suppliers, item.supplierId),
    leadTimeDays: item.leadTimeDays,
    daysOfCover,
    dailyVelocity: item.dailyVelocity,
    safetyStock: item.safetyStock,
    unitCost: item.unitCost,
    status,
  }
}

export function toReorderRows(
  items: readonly StockRow[],
  suppliers: readonly Supplier[]
): ReorderRow[] {
  // needsReorder already nets StockRow.onOrder, so membership here matches the
  // Reorder Risk tile and the Low stock badge exactly.
  return items.filter(needsReorder).map((item) => toReorderRow(item, suppliers))
}

// ── KPI derivation ──
//
// All three come from the queried items. `belowReorder` IS the queue, and it
// already contains the out-of-stock rows.

export function deriveReorderStats(items: readonly StockRow[]) {
  // The queue nets open POs (via needsReorder); out-of-stock reads the shelf. So
  // the two KPIs answer different questions - "still need ordering after
  // incoming" vs "empty on the shelf right now" - and neither double-counts a
  // raised PO.
  const queue = items.filter(needsReorder)
  return {
    belowReorder: queue.length,
    outOfStock: items.filter((item) => item.available <= 0).length,
    atRiskValue: queue.reduce((sum, item) => {
      const gap = Math.max(0, item.reorderPoint - effectiveAvailable(item))
      return sum + gap * item.unitCost
    }, 0),
  }
}

// ── Filter + search config ──

export type Urgency = "all" | "critical" | "low"

export const URGENCY_OPTIONS: { value: Urgency; label: string }[] = [
  { value: "all", label: "All urgency" },
  { value: "critical", label: "Out of stock" },
  { value: "low", label: "Low stock" },
]

export function getReorderSearchBlob(row: ReorderRow) {
  return [row.name, row.sku, row.supplier].join(" ").toLowerCase()
}

export function matchesUrgency(row: ReorderRow, urgency: Urgency) {
  if (urgency === "all") return true
  if (urgency === "critical") return row.status === "out_of_stock"
  return row.status === "low_stock"
}
