// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"

import type { Product, ProductVariant } from "../../products"
import type { ProductInput } from "../types"

// A product and its stock rows.
//
// The invariant these guard: stock is keyed to the catalog, one row per variant,
// so a product and its ledger arrive and leave together. Nothing but the
// repository mints those rows, and adjustments/transfers only move rows that
// already exist - so a product created without them was unstockable forever, and
// one deleted without cleaning them up left the ledger listing skus for a
// product that is not there.
//
// Isolation mirrors make-collection.test.ts: db.ts memoizes dbInstance and the
// seed promise at module scope, so each test re-imports through
// vi.resetModules(), which hands it a pristine store.

async function loadRepo() {
  vi.resetModules()
  const dbModule = await import("../../db")
  const { demoProductsRepository } = await import("./products")
  return {
    repository: demoProductsRepository,
    db: () => dbModule.getDb(),
    loadDemoData: dbModule.loadDemoData,
  }
}

function resetStore() {
  vi.resetModules()
}

beforeEach(resetStore)
afterEach(resetStore)

function makeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: "ZZ-9000",
    sku: "ZZ-9000",
    title: "Black / M",
    options: { Color: "Black", Size: "M" },
    price: 42,
    image: "/img/zz-black.png",
    ...overrides,
  }
}

function makeInput(overrides: Partial<Product> = {}): ProductInput {
  return {
    title: "Test Hoodie",
    subtitle: "A hoodie for tests",
    description: "",
    status: "draft",
    category: "Apparel",
    kind: "Physical",
    vendor: "Test Co",
    thumbnail: "",
    images: [],
    tags: [],
    collections: [],
    variants: [makeVariant()],
    ...overrides,
  }
}

describe("demoProductsRepository: create", () => {
  it("mints a stock row for every variant", async () => {
    // The defect: create() wrote only db.products, and nothing else in the
    // codebase ever adds an inventory row. A product made here could never be
    // given stock, because stock only moves through a row that already exists.
    const { repository, db } = await loadRepo()

    const product = await repository.create(
      makeInput({
        variants: [
          makeVariant({ id: "ZZ-9000", sku: "ZZ-9000" }),
          makeVariant({ id: "ZZ-9001", sku: "ZZ-9001", title: "Black / L" }),
        ],
      })
    )

    const rows = await db()
      .inventory.filter((i) => i.productId === product.id)
      .toArray()
    expect(rows.map((r) => r.sku).sort()).toEqual(["ZZ-9000", "ZZ-9001"])
    expect(rows.map((r) => r.id).sort()).toEqual(["inv_ZZ-9000", "inv_ZZ-9001"])
  })

  it("starts the new rows empty rather than inventing a shelf", async () => {
    const { repository, db } = await loadRepo()
    const product = await repository.create(makeInput())

    const row = await db().inventory.get("inv_ZZ-9000")
    expect(row).toMatchObject({ levels: [], lots: [], status: "Out of stock" })
    expect(row?.name).toBe("Test Hoodie")
    expect(row?.productId).toBe(product.id)
  })

  it("writes the product and its ledger together, or neither", async () => {
    // A stock row's id is minted from its sku, so a variant reusing a sku
    // another product already holds collides in the ledger and must fail the
    // WHOLE write: a product that landed without its ledger is the unstockable
    // state this exists to prevent.
    const { repository, db, loadDemoData } = await loadRepo()
    // create() does not seed (only reads do), and this needs a sku the store
    // already holds, so it loads the samples by hand first.
    await loadDemoData()
    const existing = (await db().inventory.toArray())[0]
    expect(existing).toBeDefined()

    await expect(
      repository.create(
        makeInput({
          title: "Sku Thief",
          variants: [makeVariant({ id: existing.sku, sku: existing.sku })],
        })
      )
    ).rejects.toThrow()

    expect(await db().products.get("sku-thief")).toBeUndefined()
  })
})

describe("demoProductsRepository: remove", () => {
  it("takes the product's stock rows with it", async () => {
    // Left behind, they are rows for a product that is not there: /inventory
    // keeps listing the skus and the reorder queue can still raise a purchase
    // order for one.
    const { repository, db } = await loadRepo()
    const product = await repository.create(makeInput())
    expect(await db().inventory.get("inv_ZZ-9000")).toBeDefined()

    await repository.remove(product.id)

    expect(await db().products.get(product.id)).toBeUndefined()
    expect(await db().inventory.get("inv_ZZ-9000")).toBeUndefined()
  })

  it("leaves other products' stock alone", async () => {
    const { repository, db } = await loadRepo()
    const keep = await repository.create(
      makeInput({
        title: "Keep Me",
        variants: [makeVariant({ id: "YY-1", sku: "YY-1" })],
      })
    )
    const drop = await repository.create(
      makeInput({
        title: "Drop Me",
        variants: [makeVariant({ id: "YY-2", sku: "YY-2" })],
      })
    )

    await repository.remove(drop.id)

    expect(await db().inventory.get("inv_YY-1")).toBeDefined()
    expect(await db().inventory.get("inv_YY-2")).toBeUndefined()
    expect(await db().products.get(keep.id)).toBeDefined()
  })

  it("orphans no stock row across the whole ledger", async () => {
    // The invariant InventoryItem's own doc promises ("every row resolves"), and
    // that seed-integrity can only check for the SEED - it cannot see a runtime
    // write, which is how the orphan lived.
    const { repository, db } = await loadRepo()
    const product = await repository.create(makeInput())
    await repository.remove(product.id)

    const products = new Set((await db().products.toArray()).map((p) => p.id))
    const orphans = (await db().inventory.toArray()).filter(
      (item) => !products.has(item.productId)
    )
    expect(orphans).toEqual([])
  })
})
