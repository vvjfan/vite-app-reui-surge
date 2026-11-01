import { ensureSeeded, getDb } from "../../db"
import { commitLevels } from "../../commit-levels"
import { nextPurchaseOrderId } from "../../purchase-orders"
import type { PurchaseOrder } from "../../purchase-orders"
import type { InventoryItem, StockMovement, StockStatus } from "../../inventory"
import type { PurchaseOrdersRepository } from "../types"

// Demo adapter for purchase orders. Reads and writes the in-memory store in the
// browser; the `isBrowser` guard returns EMPTY on the server, where there is no
// per-visitor store (see demo/orders.ts for the full rationale).

const isBrowser = typeof window !== "undefined"

function deriveStatus(item: InventoryItem, onHand: number): StockStatus {
  if (item.status === "Discontinued") return "Discontinued"
  if (onHand <= 0) return "Out of stock"
  if (onHand <= item.reorderPoint) return "Low stock"
  return "In stock"
}

/**
 * The inventory writes a received PO makes: one item patch per line, adding the
 * ordered units to the shelf at the PO's location and prepending a Restock
 * movement that cites the PO. A line whose SKU no longer resolves to a stock row
 * is skipped rather than throwing - the goods still arrived for the rest.
 */
function receiptWrites(
  po: PurchaseOrder,
  items: InventoryItem[],
  author: StockMovement["author"]
) {
  const writes: { id: string; patch: Partial<InventoryItem> }[] = []
  for (const line of po.lines) {
    const item = items.find((entry) => entry.sku === line.sku)
    if (!item) continue
    const level = item.levels.find((l) => l.locationId === po.locationId) ?? {
      locationId: po.locationId,
      bin: "",
      onHand: 0,
    }
    const nextOnHand = level.onHand + Math.max(0, Math.round(line.quantity))
    const { levels, lots } = commitLevels(item, [
      { locationId: po.locationId, onHand: nextOnHand },
    ])
    const movement: StockMovement = {
      id: `mv-${Date.now()}-${item.movements.length}`,
      kind: "Restock",
      title: `Restock +${line.quantity.toLocaleString()} units`,
      detail: `Received on ${po.id}`,
      timeLabel: "Just now",
      author,
      delta: line.quantity,
    }
    const sumOnHand = levels.reduce((sum, l) => sum + l.onHand, 0)
    writes.push({
      id: item.id,
      patch: {
        levels,
        lots,
        status: deriveStatus(item, sumOnHand),
        movements: [movement, ...item.movements],
      },
    })
  }
  return writes
}

export const demoPurchaseOrdersRepository: PurchaseOrdersRepository = {
  async list() {
    if (!isBrowser) return []
    await ensureSeeded()
    return getDb().purchaseOrders.toArray()
  },

  async get(id) {
    if (!isBrowser) return null
    await ensureSeeded()
    return (await getDb().purchaseOrders.get(id)) ?? null
  },

  async create(input) {
    const db = getDb()
    const all = await db.purchaseOrders.toArray()
    const po: PurchaseOrder = {
      ...input,
      id: nextPurchaseOrderId(all),
      status: "draft",
      createdAt: new Date().toISOString(),
    }
    await db.purchaseOrders.add(po)
    return po
  },

  async update(id, patch) {
    // Status is not patchable: it moves only through receive() / cancel(), the
    // same arrangement orders use for their lifecycle.
    if ("status" in patch) {
      throw new Error(`PO ${id}: status moves through receive()/cancel().`)
    }
    const db = getDb()
    await db.purchaseOrders.update(id, patch)
    const next = await db.purchaseOrders.get(id)
    if (!next) throw new Error(`PO ${id} not found`)
    return next
  },

  async receive(id, author) {
    const db = getDb()
    const po = await db.purchaseOrders.get(id)
    if (!po) throw new Error(`PO ${id} not found`)
    if (po.status !== "draft") {
      throw new Error(`PO ${id} is ${po.status}; only a draft can be received.`)
    }

    // The PO and the shelf move together or not at all: receiving a PO whose
    // stock write half-failed would double-count or lose units.
    const writes = receiptWrites(po, await db.inventory.toArray(), author)
    const receivedAt = new Date().toISOString()
    await db.transaction("rw", db.purchaseOrders, db.inventory, async () => {
      await db.purchaseOrders.update(id, { status: "received", receivedAt })
      for (const write of writes) {
        await db.inventory.update(write.id, write.patch)
      }
    })

    const next = await db.purchaseOrders.get(id)
    if (!next) throw new Error(`PO ${id} not found`)
    return next
  },

  async cancel(id) {
    const db = getDb()
    const po = await db.purchaseOrders.get(id)
    if (!po) throw new Error(`PO ${id} not found`)
    if (po.status !== "draft") {
      throw new Error(
        `PO ${id} is ${po.status}; only a draft can be cancelled.`
      )
    }
    await db.purchaseOrders.update(id, { status: "cancelled" })
    const next = await db.purchaseOrders.get(id)
    if (!next) throw new Error(`PO ${id} not found`)
    return next
  },

  async remove(id) {
    await getDb().purchaseOrders.delete(id)
  },
}
