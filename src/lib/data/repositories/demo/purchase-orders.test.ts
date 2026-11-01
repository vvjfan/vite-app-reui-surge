// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"

import { getDb, resetDemoData } from "../../db"
import { demoPurchaseOrdersRepository as repo } from "./purchase-orders"

const AUTHOR = { name: "Nick Bold", initials: "NB" }

// The purchase-order lifecycle asserted against the store, not the toast: a PO
// is only "working" if receiving it actually moves stock. These exercise the
// one write that touches inventory (receive) and the guards around it.

beforeEach(async () => {
  // A clean, fully-seeded store: inventory to receive into, and the sample POs.
  await resetDemoData()
})

async function firstItem() {
  const items = await getDb().inventory.toArray()
  return items[0]
}

describe("purchase orders: receiving moves stock", () => {
  it("mints a draft on the PO-#### sequence", async () => {
    const item = await firstItem()
    const po = await repo.create({
      supplierId: item.supplierId,
      supplierName: "Test Supplier",
      locationId: item.levels[0].locationId,
      lines: [
        {
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          thumbnail: null,
          quantity: 50,
          unitCost: 10,
        },
      ],
    })
    expect(po.status).toBe("draft")
    expect(po.id).toMatch(/^PO-\d+$/)
    expect(po.createdAt).toBeTruthy()
  })

  it("adds the ordered units to the shelf and records a restock", async () => {
    const item = await firstItem()
    const level = item.levels[0]
    const before = level.onHand

    const po = await repo.create({
      supplierId: item.supplierId,
      supplierName: "Test Supplier",
      locationId: level.locationId,
      lines: [
        {
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          thumbnail: null,
          quantity: 50,
          unitCost: 10,
        },
      ],
    })

    const received = await repo.receive(po.id, AUTHOR)
    expect(received.status).toBe("received")
    expect(received.receivedAt).toBeTruthy()

    const after = await getDb().inventory.get(item.id)
    const nextLevel = after?.levels.find(
      (l) => l.locationId === level.locationId
    )
    expect(nextLevel?.onHand).toBe(before + 50)
    // The restock is prepended to the item's ledger and cites the PO.
    expect(after?.movements[0].kind).toBe("Restock")
    expect(after?.movements[0].delta).toBe(50)
    expect(after?.movements[0].detail).toContain(po.id)
  })

  it("refuses to receive a PO twice", async () => {
    const item = await firstItem()
    const po = await repo.create({
      supplierId: item.supplierId,
      supplierName: "Test Supplier",
      locationId: item.levels[0].locationId,
      lines: [
        {
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          thumbnail: null,
          quantity: 10,
          unitCost: 10,
        },
      ],
    })
    await repo.receive(po.id, AUTHOR)
    await expect(repo.receive(po.id, AUTHOR)).rejects.toThrow()
  })

  it("cancels a draft without touching stock", async () => {
    const item = await firstItem()
    const level = item.levels[0]
    const before = level.onHand
    const po = await repo.create({
      supplierId: item.supplierId,
      supplierName: "Test Supplier",
      locationId: level.locationId,
      lines: [
        {
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          thumbnail: null,
          quantity: 25,
          unitCost: 10,
        },
      ],
    })
    const cancelled = await repo.cancel(po.id)
    expect(cancelled.status).toBe("cancelled")

    const after = await getDb().inventory.get(item.id)
    const nextLevel = after?.levels.find(
      (l) => l.locationId === level.locationId
    )
    expect(nextLevel?.onHand).toBe(before)
    // A cancelled draft cannot then be received.
    await expect(repo.receive(po.id, AUTHOR)).rejects.toThrow()
  })
})
