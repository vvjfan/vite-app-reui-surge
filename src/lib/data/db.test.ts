// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"

import { ORDERS } from "./orders"
import { PRODUCTS } from "./products"
import { PROMOTIONS } from "./promotions"
import { STORE_PROFILE_KEY } from "./store-profile"

// The demo dataset actions exercised against the in-memory demo store (jsdom
// provides the browser window it requires).
//
// Isolation: db.ts memoizes `dbInstance` and the seed promise at module scope,
// so a loaded store would otherwise be visible to the next test. Each test
// re-imports the module through `vi.resetModules()`, which drops both memos
// and hands it a pristine store - the same thing a page reload gives a
// visitor. `loadDb()` is the only way these tests reach db.ts - a static
// import would bind test 1's singleton for the whole file.

/** Fresh module registry -> fresh dbInstance, over a fresh store. */
async function loadDb() {
  vi.resetModules()
  return import("./db")
}

function resetStore() {
  vi.resetModules()
}

beforeEach(resetStore)
afterEach(resetStore)

describe("a fresh store", () => {
  // The headline behaviour of the demo store: constructing it does not
  // populate it - only a repository read does, through ensureSeeded - so a
  // fresh visitor lands on the samples the moment a page reads, and nothing is
  // filled behind an untouched db handle.
  it("does not populate when the store is merely constructed", async () => {
    const { getDb } = await loadDb()
    const db = getDb()

    expect(await db.orders.count()).toBe(0)
    expect(await db.products.count()).toBe(0)
    expect(await db.promotions.count()).toBe(0)
    expect(await db.settings.get(STORE_PROFILE_KEY)).toBeUndefined()
  })

  it("seeds itself on the first repository read", async () => {
    // A read of an empty store fills it from the samples (ensureSeeded runs
    // inside every demo read), so no page is developed against an empty store by
    // accident. This is the behaviour the whole demo store is built on.
    const { getDb } = await loadDb()
    const { demoProductsRepository } =
      await import("./repositories/demo/products")

    expect(await demoProductsRepository.list()).toHaveLength(PRODUCTS.length)
    expect(await getDb().products.count()).toBe(PRODUCTS.length)
  })
})

describe("loadDemoData", () => {
  it("loads the store from the deterministic mock data", async () => {
    const { loadDemoData, getDb } = await loadDb()
    await loadDemoData()
    const db = getDb()

    expect(await db.orders.count()).toBe(ORDERS.length)
    expect(await db.products.count()).toBe(PRODUCTS.length)
    expect(await db.promotions.count()).toBe(PROMOTIONS.length)
  })

  it("stores the rows themselves, not just the counts", async () => {
    const { loadDemoData, getDb } = await loadDb()
    await loadDemoData()

    expect(await getDb().promotions.get("promo_1")).toMatchObject({
      code: "SUMMER20",
      status: "active",
    })
  })

  it("loads the settings singletons too", async () => {
    const { loadDemoData, getDb } = await loadDb()
    await loadDemoData()

    expect(await getDb().settings.get(STORE_PROFILE_KEY)).toBeDefined()
  })

  it("is idempotent: a second call does not duplicate rows", async () => {
    const { loadDemoData, getDb } = await loadDb()
    await loadDemoData()
    await loadDemoData()
    const db = getDb()

    expect(await db.orders.count()).toBe(ORDERS.length)
    expect(await db.products.count()).toBe(PRODUCTS.length)
    expect(await db.promotions.count()).toBe(PROMOTIONS.length)
  })

  it("is idempotent across a fresh module instance", async () => {
    const first = await loadDb()
    await first.loadDemoData()

    // The per-table count() guard is the only thing standing between the sample
    // data and a duplicate key.
    const second = await loadDb()
    await second.loadDemoData()

    expect(await second.getDb().promotions.count()).toBe(PROMOTIONS.length)
  })

  it("de-duplicates concurrent callers rather than double-adding", async () => {
    // Two clicks of "Load demo data" land as two overlapping rw transactions.
    const { loadDemoData, getDb } = await loadDb()
    await Promise.all([loadDemoData(), loadDemoData(), loadDemoData()])

    expect(await getDb().promotions.count()).toBe(PROMOTIONS.length)
  })

  it("keeps a visitor's own rows, filling only the tables that are empty", async () => {
    // The guard is per-table `count() === 0`, so loading the samples alongside
    // your own work adds to it rather than replacing it: a table you have put a
    // row in is one the load skips entirely.
    const { loadDemoData, getDb } = await loadDb()
    const db = getDb()
    await db.promotions.add({ id: "mine", code: "MINE" } as never)

    await loadDemoData()

    expect(await db.promotions.count()).toBe(1)
    expect(await db.promotions.get("mine")).toBeDefined()
    // every other table was empty, so it got the samples
    expect(await db.products.count()).toBe(PRODUCTS.length)
  })
})

describe("ensureSeeded", () => {
  it("fills an empty store from the sample data on the first call", async () => {
    const { ensureSeeded, getDb } = await loadDb()
    await ensureSeeded()
    const db = getDb()

    expect(await db.products.count()).toBe(PRODUCTS.length)
    expect(await db.orders.count()).toBe(ORDERS.length)
    expect(await db.settings.get(STORE_PROFILE_KEY)).toBeDefined()
  })

  it("is memoized: concurrent callers seed once, not many times", async () => {
    // The burst of reads a page fires all await the same promise, so the samples
    // are added once rather than raced in as overlapping transactions.
    const { ensureSeeded, getDb } = await loadDb()
    await Promise.all([ensureSeeded(), ensureSeeded(), ensureSeeded()])

    expect(await getDb().promotions.count()).toBe(PROMOTIONS.length)
  })

  it("keeps a visitor's own rows, filling only the empty tables", async () => {
    // The guard is per-table `count() === 0`, so seeding alongside your own work
    // adds to it rather than replacing it.
    const { ensureSeeded, getDb } = await loadDb()
    const db = getDb()
    await db.promotions.add({ id: "mine", code: "MINE" } as never)

    await ensureSeeded()

    expect(await db.promotions.count()).toBe(1)
    expect(await db.promotions.get("mine")).toBeDefined()
    // every other table was empty, so it got the samples
    expect(await db.products.count()).toBe(PRODUCTS.length)
  })
})

describe("clearDemoData", () => {
  it("empties every collection", async () => {
    const { loadDemoData, clearDemoData, getDb } = await loadDb()
    await loadDemoData()
    await clearDemoData()
    const db = getDb()

    expect(await db.orders.count()).toBe(0)
    expect(await db.products.count()).toBe(0)
    expect(await db.promotions.count()).toBe(0)
    expect(await db.inventory.count()).toBe(0)
  })

  it("drops the settings singletons it owns", async () => {
    const { loadDemoData, clearDemoData, getDb } = await loadDb()
    await loadDemoData()
    await clearDemoData()

    expect(await getDb().settings.get(STORE_PROFILE_KEY)).toBeUndefined()
  })

  it("leaves a settings key it does not own alone", async () => {
    // The singleton keys are deleted by name, not by clearing the table: a key
    // another feature added is not this function's to throw away.
    const { loadDemoData, clearDemoData, getDb } = await loadDb()
    const db = getDb()
    await loadDemoData()
    await db.settings.put({ key: "some-other-feature", value: 42 })

    await clearDemoData()

    expect(await db.settings.get("some-other-feature")).toMatchObject({
      value: 42,
    })
  })

  it("leaves a store that reloads the demo data whole", async () => {
    // clear -> load is the round trip the settings page offers, so it has to
    // land back on exactly the samples rather than throwing a duplicate key.
    const { loadDemoData, clearDemoData, getDb } = await loadDb()
    await loadDemoData()
    await clearDemoData()
    await loadDemoData()

    expect(await getDb().products.count()).toBe(PRODUCTS.length)
  })

  it("does not outlast a reload: the next session's first read refills it", async () => {
    // The demo samples cannot be permanently deleted away. Clearing empties the
    // store for the session, but the next session seeds it again on the first
    // read - constructing the store alone does not, so the refill is observed
    // through the repository, the way a page would trigger it.
    const first = await loadDb()
    await first.loadDemoData()
    await first.clearDemoData()

    await loadDb()
    const { demoProductsRepository } =
      await import("./repositories/demo/products")

    expect(await demoProductsRepository.list()).toHaveLength(PRODUCTS.length)
  })

  it("stays cleared for the rest of the session, even after a read", async () => {
    // Within one session a clear is honoured: the automatic seed is settled by
    // clearDemoData, so a read afterwards does not quietly refill the store. The
    // refill is a NEW session's behaviour, guarded above.
    const { loadDemoData, clearDemoData } = await loadDb()
    const { demoProductsRepository } =
      await import("./repositories/demo/products")
    await loadDemoData()
    await clearDemoData()

    expect(await demoProductsRepository.list()).toEqual([])
  })
})

describe("resetDemoData", () => {
  it("discards edits and restores the samples exactly", async () => {
    const { loadDemoData, resetDemoData, getDb } = await loadDb()
    const db = getDb()
    await loadDemoData()
    await db.promotions.delete("promo_1")
    await db.promotions.add({ id: "mine", code: "MINE" } as never)

    await resetDemoData()

    expect(await db.promotions.count()).toBe(PROMOTIONS.length)
    expect(await db.promotions.get("promo_1")).toBeDefined()
    expect(await db.promotions.get("mine")).toBeUndefined()
  })

  it("restores from empty, not only from a loaded store", async () => {
    const { clearDemoData, resetDemoData, getDb } = await loadDb()
    await clearDemoData()
    await resetDemoData()

    expect(await getDb().products.count()).toBe(PRODUCTS.length)
    expect(await getDb().settings.get(STORE_PROFILE_KEY)).toBeDefined()
  })
})

describe("getDb", () => {
  it("returns the same instance across calls", async () => {
    const { getDb } = await loadDb()
    expect(getDb()).toBe(getDb())
  })
})

describe("db test isolation", () => {
  // guards the harness itself: if this fails, every count assertion in this file
  // is meaningless.
  it("starts from an empty store despite the tests above", async () => {
    const { getDb } = await loadDb()
    const db = getDb()

    expect(await db.promotions.count()).toBe(0)
    expect(await db.orders.count()).toBe(0)
  })
})
