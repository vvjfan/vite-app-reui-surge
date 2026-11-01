// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"

import { PROMOTIONS, type Promotion } from "../../promotions"

// The makeDemoCollection factory exercised end to end against the in-memory
// demo store (jsdom provides the browser window it requires). Promotions is a
// plain CRUD collection built on the factory, so it stands in for every
// collection that uses it.
//
// Isolation: db.ts memoizes `dbInstance` and the seed promise at module scope,
// so a test that loaded or wrote would otherwise be visible to the next one.
// Each test re-imports the modules through `vi.resetModules()`, which drops
// both memos and hands the next test a pristine store. `openDemo()` is the
// only way these tests reach the module under test - importing it statically
// would bind test 1's singleton for the whole file.

const seedCount = PROMOTIONS.length

/** Fresh module registry -> fresh dbInstance, over a fresh store. */
async function openDemo({ withSamples }: { withSamples: boolean }) {
  vi.resetModules()
  const dbModule = await import("../../db")
  const { demoPromotionsRepository } = await import("./promotions")
  if (withSamples) await dbModule.loadDemoData()
  return { repository: demoPromotionsRepository, dbModule }
}

/**
 * A store holding the sample data, loaded up front. A read would seed it too
 * (see ensureSeeded), but these tests are about the factory's CRUD, so they put
 * the rows there explicitly rather than lean on a read's timing.
 */
async function loadDemo() {
  return openDemo({ withSamples: true })
}

function resetStore() {
  vi.resetModules()
}

beforeEach(resetStore)
afterEach(resetStore)

/** A complete create payload (everything but the id, which the repo assigns). */
const makeInput = (
  overrides: Partial<Promotion> = {}
): Omit<Promotion, "id"> => ({
  code: "AUTUMN35",
  name: "Autumn sale",
  method: "code",
  valueType: "percentage",
  target: "items",
  value: 35,
  currency: "USD",
  status: "draft",
  startsAt: "2026-09-01",
  endsAt: "2026-10-31",
  usageLimit: 100,
  usedCount: 0,
  minSubtotal: null,
  rank: 0,
  ...overrides,
})

describe("makeDemoCollection: list", () => {
  it("returns the sample rows once they are loaded", async () => {
    const { repository } = await loadDemo()
    const rows = await repository.list()

    expect(rows).toHaveLength(seedCount)
    expect(rows.map((r) => r.code).sort()).toEqual(
      PROMOTIONS.map((p) => p.code).sort()
    )
  })

  it("seeds the store on the first read", async () => {
    // A read of a store nobody loaded the samples into fills it from the samples
    // (ensureSeeded runs inside list()), so a fresh visitor never lands on an
    // empty page. This is the behaviour the whole demo store is built around.
    const { repository } = await openDemo({ withSamples: false })

    expect(await repository.list()).toHaveLength(seedCount)
  })
})

describe("makeDemoCollection: get", () => {
  it("returns a seeded row by id", async () => {
    const { repository } = await loadDemo()
    const row = await repository.get("promo_1")

    expect(row).toMatchObject({
      id: "promo_1",
      code: "SUMMER20",
      name: "Summer sale",
    })
  })

  it("returns null for an id that is not there", async () => {
    const { repository } = await loadDemo()
    // null, not undefined and not a throw: the seam promises T | null.
    expect(await repository.get("promo_nope")).toBeNull()
  })
})

describe("makeDemoCollection: create", () => {
  it("assigns an id and persists the record", async () => {
    const { repository } = await loadDemo()
    const created = await repository.create(makeInput())

    // The id's FORM is the factory's business, not this test's - asserting the
    // exact string here is what let the old count-based scheme read as spec.
    // What a caller is promised is that an id comes back and it resolves.
    expect(created.id).toBeTruthy()
    expect(created).toMatchObject({ code: "AUTUMN35", value: 35 })

    // persisted, not just returned
    expect(await repository.get(created.id)).toMatchObject({
      id: created.id,
      code: "AUTUMN35",
    })
    expect(await repository.list()).toHaveLength(seedCount + 1)
  })

  it("assigns the id itself, ignoring any the caller smuggles in", async () => {
    const { repository } = await loadDemo()
    // The store owns the id, exactly as it owns an order's number. A caller that
    // sets one must not be able to collide with a stored row on purpose.
    const created = await repository.create({
      ...makeInput(),
      id: "promo_1",
    } as unknown as Omit<Promotion, "id">)

    expect(created.id).not.toBe("promo_1")
    expect(await repository.get("promo_1")).toMatchObject({ code: "SUMMER20" })
  })
})

describe("makeDemoCollection: id generation", () => {
  // An id is a promise that it belongs to one record, forever. These guard the
  // two ways a generator can break that: minting one that is already taken, and
  // handing a freed one to a new record that inherits the old one's references.

  it("creates a record after a row below the last one is deleted", async () => {
    const { repository } = await loadDemo()
    await repository.remove("promo_3")

    // The interesting case is a NON-tail delete: the row count drops while the
    // highest id stays, so a count-based id lands on one that is still stored
    // and the store's add() - which rejects a duplicate key rather than
    // overwriting it - throws. The operator sees "please try again" and no
    // retry can ever work, because the count does not change.
    const created = await repository.create(makeInput())

    expect(await repository.get(created.id)).toMatchObject({ id: created.id })
    expect(await repository.list()).toHaveLength(seedCount)
  })

  it("never reissues an id a deleted record used to hold", async () => {
    const { repository } = await loadDemo()
    const removed = `promo_${seedCount}`
    await repository.remove(removed)

    const created = await repository.create(makeInput())

    // Reuse is the quiet half of the bug: a freed id is absent from the stored
    // rows, so any generator that reads only what is there is free to hand it
    // out again. The new record then silently inherits every reference the
    // deleted one left behind - a new warehouse adopting a dead one's stock.
    expect(created.id).not.toBe(removed)
  })

  it("keeps every id it has ever issued distinct across interleaved writes", async () => {
    const { repository } = await loadDemo()
    const issued = new Set<string>()

    for (let round = 0; round < 8; round++) {
      const created = await repository.create(
        makeInput({ code: `ROUND${round}` })
      )
      expect(issued.has(created.id)).toBe(false)
      issued.add(created.id)
      // Delete what we just made every other round, so the row count oscillates
      // instead of climbing: a generator keyed to it repeats itself.
      if (round % 2 === 1) await repository.remove(created.id)
    }
  })
})

describe("makeDemoCollection: update", () => {
  it("patches the stored row and returns the updated record", async () => {
    const { repository } = await loadDemo()
    const updated = await repository.update("promo_1", {
      status: "expired",
      value: 40,
    })

    expect(updated).toMatchObject({
      id: "promo_1",
      status: "expired",
      value: 40,
    })
    // fields outside the patch survive
    expect(updated.code).toBe("SUMMER20")
    expect(await repository.get("promo_1")).toMatchObject({
      status: "expired",
      value: 40,
    })
  })

  it("rejects when the id is not there", async () => {
    const { repository } = await loadDemo()
    // The store's update() resolves 0 for a missing key rather than throwing,
    // so the factory re-reads and raises: callers must never get a silent no-op.
    await expect(
      repository.update("promo_nope", { status: "active" })
    ).rejects.toThrow("Record promo_nope not found")
  })
})

describe("makeDemoCollection: remove", () => {
  it("deletes the row", async () => {
    const { repository } = await loadDemo()
    await repository.remove("promo_1")

    expect(await repository.get("promo_1")).toBeNull()
    expect(await repository.list()).toHaveLength(seedCount - 1)
  })

  it("resolves for an id that is not there", async () => {
    const { repository } = await loadDemo()
    await expect(repository.remove("promo_nope")).resolves.toBeUndefined()
    expect(await repository.list()).toHaveLength(seedCount)
  })
})

describe("makeDemoCollection: test isolation", () => {
  // guards the harness itself: if this fails, the writes above are leaking and
  // every assertion on a row count in this file is meaningless.
  it("starts from the untouched seed despite the writes in the tests above", async () => {
    const { repository } = await loadDemo()
    const rows = await repository.list()

    expect(rows).toHaveLength(seedCount)
    expect(await repository.get("promo_1")).toMatchObject({
      status: "active",
      value: 20,
    })
    // Nothing the tests above created survives. Their ids are random, so this
    // asks the question the other way round: every row still here is a seed row.
    const seedIds = new Set(PROMOTIONS.map((p) => p.id))
    expect(rows.filter((r) => !seedIds.has(r.id))).toEqual([])
  })
})
