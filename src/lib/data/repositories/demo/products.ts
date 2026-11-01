import { ensureSeeded, getDb } from "../../db"
import { ledgerRowsForProduct } from "../../inventory"
import type { Product } from "../../products"
import type { ProductsRepository } from "../types"
import { slugify } from "../../seed-utils"

// Demo adapter. In the browser it seeds on the first read (ensureSeeded) and
// reads / writes the in-memory demo store; on the server there is no per-visitor
// store, so reads come back empty. See ./orders.ts for the shared rationale.

const isBrowser = typeof window !== "undefined"

export const demoProductsRepository: ProductsRepository = {
  async list() {
    if (!isBrowser) return []
    await ensureSeeded()
    return getDb().products.toArray()
  },

  async get(id) {
    if (!isBrowser) return null
    await ensureSeeded()
    return (await getDb().products.get(id)) ?? null
  },

  async create(input) {
    const db = getDb()
    // The handle is the id; keep it unique for the demo.
    const base = slugify(input.title) || "product"
    let id = base
    let n = 2
    while (await db.products.get(id)) id = `${base}-${n++}`
    const product: Product = { ...input, id }

    // A product and its stock rows arrive together. Stock is keyed to the
    // catalog one row per variant, and nothing but this mints them - so a
    // product created without them could never hold stock at all: adjustments
    // and transfers only move an EXISTING row, and /inventory offers no way to
    // add one. One transaction, because a product with no ledger is not a
    // half-finished product, it is a broken one.
    await db.transaction("rw", db.products, db.inventory, async () => {
      await db.products.add(product)
      // add(), not put(): db.ts declares sku unique, so a variant reusing a sku
      // another product already holds must fail the whole write rather than
      // quietly rehome that sku's stock.
      await db.inventory.bulkAdd(ledgerRowsForProduct(product))
    })
    return product
  },

  async update(id, patch) {
    const db = getDb()
    await db.products.update(id, patch)
    const next = await db.products.get(id)
    if (!next) throw new Error(`Product ${id} not found`)
    return next
  },

  async remove(id) {
    const db = getDb()
    // The stock rows go with the product. They exist to track ITS variants, so
    // left behind they are rows for a product that is not there: /inventory
    // keeps listing skus that resolve to nothing, and the reorder queue can
    // still raise a purchase order for one. The InventoryItem doc promises every
    // row resolves to a real product, and seed-integrity guards that for the
    // SEED only - it cannot see a runtime write, which is how the orphan lived.
    await db.transaction("rw", db.products, db.inventory, async () => {
      await db.products.delete(id)
      // A scan rather than an index lookup: productId is not indexed, and the
      // ledger is small enough that adding one would cost every returning
      // visitor a re-index to save nothing.
      await db.inventory.filter((item) => item.productId === id).delete()
    })
  },
}
