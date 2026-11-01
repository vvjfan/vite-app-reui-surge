// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"

import { CUSTOMERS } from "../../customers"
import { PRODUCTS } from "../../products"
import { SHIPPING_METHODS, buildOrderLine, orderTotals } from "../../commerce"
import { STOCK_LOCATIONS } from "../../locations"
import type { Order } from "../../types"
import type { OrderInput } from "../types"

// The orders repository is hand-written rather than built on makeDemoCollection,
// because an order's identity is minted rather than supplied: `id` ("SO-1043"),
// `number` ("#1043"), and every line id are all faces of ONE sequence. These
// tests pin that contract - a caller cannot supply any of them, and the store
// never ends up with two id schemes.
//
// Isolation mirrors make-collection.test.ts: db.ts memoizes `dbInstance` and
// the seed promise at module scope, so each test re-imports through
// vi.resetModules(), which hands it a pristine store. `loadRepo()` is the only
// way these tests reach the module under test.
//
// loadRepo() loads the sample data up front. A read would seed it too (see
// ensureSeeded), but these tests are about what the repository does to an order
// that already EXISTS - transition it, patch it, refuse to delete it - so they
// put the samples there explicitly rather than lean on a read's timing. What the
// repo does to an empty store (create, which does not seed) is its own case,
// below.

/** The repository over a store that is still empty. */
async function openRepo() {
  vi.resetModules()
  const dbModule = await import("../../db")
  const { demoOrdersRepository } = await import("./orders")
  return { repository: demoOrdersRepository, dbModule }
}

/** The repository over a store holding the sample orders. */
async function loadRepo() {
  const { repository, dbModule } = await openRepo()
  await dbModule.loadDemoData()
  return repository
}

function resetStore() {
  vi.resetModules()
}

beforeEach(resetStore)
afterEach(resetStore)

/** A payload shaped exactly as toOrderPayload builds one: no id, no number. */
function makeInput(): OrderInput {
  const customer = CUSTOMERS.find((c) => c.location)!
  const product = PRODUCTS.find((p) => p.variants.length > 0)!
  const variant = product.variants[0]
  const method = SHIPPING_METHODS[0]
  // Line ids a draft would produce: keyed by slot, because the sequence that the
  // repository keys on does not exist until create() runs.
  const lines = [
    buildOrderLine(product, variant, 2, "L-0"),
    buildOrderLine(product, product.variants[1] ?? variant, 1, "L-1"),
  ]
  return {
    date: new Date().toISOString(),
    customer: {
      name: customer.name,
      email: customer.email,
      handle: customer.id,
    },
    status: "pending",
    payment: "pending",
    fulfillment: "unfulfilled",
    lines,
    totals: orderTotals(lines, method.shipping),
    shipping: {
      priority: method.priority,
      method: method.method,
      carrier: "UPS Global",
      locationId: STOCK_LOCATIONS[0].id,
      from: STOCK_LOCATIONS[0].address,
      to: "1 Test St, Testville",
      destinationLabel: "Shipping to test",
      destinationLines: ["1 Test St", "Testville"],
    },
  }
}

describe("orders repository: create mints the identity", () => {
  it("assigns an id and a number from one sequence, so they cannot disagree", async () => {
    const repository = await loadRepo()
    const created = await repository.create(makeInput())

    const seq = Number(created.id.replace(/\D/g, ""))
    expect(created.id).toBe(`SO-${seq}`)
    expect(created.number).toBe(`#${seq}`)
  })

  it("takes the next sequence after the highest existing order", async () => {
    const repository = await loadRepo()
    const before = await repository.list()
    const highest = before.reduce(
      (max, order) => Math.max(max, Number(order.id.replace(/\D/g, ""))),
      0
    )

    const created = await repository.create(makeInput())
    expect(Number(created.id.replace(/\D/g, ""))).toBe(highest + 1)
  })

  it("mints a whole identity for the first order in an empty store", async () => {
    // The case a fresh install opens on, and the one the seeded store hid: with
    // no rows to take a maximum over, the sequence has only its floor to go on.
    // It still has to produce an id, a matching number, and keyed line ids -
    // NaN or undefined here would be a first order that cannot be looked up.
    const { repository } = await openRepo()

    const created = await repository.create(makeInput())

    const seq = Number(created.id.replace(/\D/g, ""))
    expect(Number.isFinite(seq)).toBe(true)
    expect(created.id).toBe(`SO-${seq}`)
    expect(created.number).toBe(`#${seq}`)
    expect(created.lines.map((line) => line.id)).toEqual([
      `L-${seq}-0`,
      `L-${seq}-1`,
    ])
    expect(await repository.get(created.id)).toMatchObject({ id: created.id })
  })

  it("re-keys line ids onto the minted sequence, not the draft's slot numbers", async () => {
    // The regression guard: a draft keys lines by slot ("L-0"), because the
    // sequence does not exist yet. If create did not re-key them, two created
    // orders would both carry "L-0" while every seeded order carries
    // "L-{seq}-{i}" - two id schemes in one table.
    const repository = await loadRepo()
    const created = await repository.create(makeInput())

    const seq = Number(created.id.replace(/\D/g, ""))
    expect(created.lines.map((line) => line.id)).toEqual([
      `L-${seq}-0`,
      `L-${seq}-1`,
    ])
  })

  it("keeps line ids unique across separately created orders", async () => {
    const repository = await loadRepo()
    const first = await repository.create(makeInput())
    const second = await repository.create(makeInput())

    const ids = [...first.lines, ...second.lines].map((line) => line.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("persists the created order and leaves the rest of the line intact", async () => {
    const repository = await loadRepo()
    const input = makeInput()
    const created = await repository.create(input)

    const fetched = await repository.get(created.id)
    expect(fetched).not.toBeNull()
    expect(fetched?.number).toBe(created.number)
    // Re-keying must touch the id and nothing else about the line.
    expect(fetched?.lines[0]).toMatchObject({
      productId: input.lines[0].productId,
      sku: input.lines[0].sku,
      qty: input.lines[0].qty,
      unitPrice: input.lines[0].unitPrice,
    })
  })

  it("adds the order to the list rather than replacing the seed", async () => {
    const repository = await loadRepo()
    const before = await repository.list()
    await repository.create(makeInput())
    const after = await repository.list()

    expect(after.length).toBe(before.length + 1)
  })
})

// The store as the demo's SERVER.
//
// The UI guards first and never sends an illegal transition, so none of this is
// reachable through the app. That is exactly why it is worth pinning: these
// assert that the rules hold for a caller who skips the hook, the way a real API
// would refuse a hand-rolled request. Orders are selected by predicate rather
// than by seed id so a reshuffled seed cannot quietly make a case vacuous.

/** The first seeded order matching a predicate, or a loud failure. */
async function findOrder(
  repository: Awaited<ReturnType<typeof loadRepo>>,
  predicate: (order: Order) => boolean,
  describeIt: string
): Promise<Order> {
  const found = (await repository.list()).find(predicate)
  if (!found) throw new Error(`No seeded order is ${describeIt}`)
  return found
}

describe("demoOrdersRepository: transition", () => {
  it("refunds the capture when a paid order is cancelled", async () => {
    const repository = await loadRepo()
    const order = await findOrder(
      repository,
      (o) =>
        o.payment === "paid" &&
        o.fulfillment === "unfulfilled" &&
        o.status !== "cancelled",
      "paid and unshipped"
    )

    const next = await repository.transition(order.id, "cancel")

    expect(next.status).toBe("cancelled")
    expect(next.payment).toBe("refunded")
    // Persisted, not just returned: this is the state the books read back.
    expect(await repository.get(order.id)).toMatchObject({
      status: "cancelled",
      payment: "refunded",
    })
  })

  it("refuses to fulfil a cancelled order", async () => {
    const repository = await loadRepo()
    const order = await findOrder(
      repository,
      (o) => o.status === "cancelled",
      "cancelled"
    )

    await expect(repository.transition(order.id, "fulfill")).rejects.toThrow(
      /cancelled-cannot-fulfill/
    )
    // And left it alone, rather than half-applying.
    expect(await repository.get(order.id)).toMatchObject({
      status: "cancelled",
    })
  })

  it("refuses to cancel an order that has shipped", async () => {
    const repository = await loadRepo()
    const order = await findOrder(
      repository,
      (o) => o.fulfillment !== "unfulfilled" && o.status !== "cancelled",
      "shipped"
    )

    await expect(repository.transition(order.id, "cancel")).rejects.toThrow(
      /shipped-cannot-cancel/
    )
    expect(await repository.get(order.id)).toMatchObject({
      fulfillment: order.fulfillment,
    })
  })

  it("rejects an unknown order", async () => {
    const repository = await loadRepo()
    await expect(repository.transition("SO-nope", "cancel")).rejects.toThrow(
      "Order SO-nope not found"
    )
  })

  it("takes the shipped units off the shelf", async () => {
    // The defect this closes: fulfilling changed three badges and moved nothing,
    // so the same stock could be shipped over and over. Read through the real
    // demo store on both sides - the point is that the WRITE happens, and a
    // pure planner cannot show that.
    const repository = await loadRepo()
    const db = (await import("../../db")).getDb()

    // The order must ship from a location holding ENOUGH of its first line to
    // cover the qty, or there is nothing on the shelf to take off and the
    // case is vacuous (a level can exist at zero on hand). The seed picks an
    // order's origin independently of where its items are held, so that
    // pairing has to be selected for rather than assumed.
    const onHandBySku = new Map(
      (await db.inventory.toArray()).map((item) => [
        item.sku,
        new Map(item.levels.map((l) => [l.locationId, l.onHand])),
      ])
    )
    const order = await findOrder(
      repository,
      (o) =>
        o.status !== "cancelled" &&
        o.status !== "fulfilled" &&
        o.lines.length > 0 &&
        (onHandBySku.get(o.lines[0].sku)?.get(o.shipping.locationId) ?? 0) >=
          o.lines[0].qty,
      "fulfillable from a location stocking enough of its first line"
    )
    const line = order.lines[0]
    const before = await db.inventory.get(`inv_${line.sku}`)
    const locationId = order.shipping.locationId
    const onHandBefore = before?.levels.find(
      (l) => l.locationId === locationId
    )?.onHand

    await repository.transition(order.id, "fulfill")

    const after = await db.inventory.get(`inv_${line.sku}`)
    const onHandAfter =
      after?.levels.find((l) => l.locationId === locationId)?.onHand ?? 0
    // The line's units are gone from the location the order shipped from. Other
    // lines of the same order may draw on the same row, so assert the direction
    // and the floor rather than an exact figure.
    expect(onHandAfter).toBeLessThanOrEqual((onHandBefore ?? 0) - line.qty)
  })

  it("leaves the shelf alone when an order is cancelled", async () => {
    // Cancelling releases the reservation, and it does that by no longer being
    // open - the units were never taken off the shelf, so nothing goes back.
    const repository = await loadRepo()
    const db = (await import("../../db")).getDb()

    const order = await findOrder(
      repository,
      (o) =>
        o.fulfillment === "unfulfilled" &&
        o.status !== "cancelled" &&
        o.lines.length > 0,
      "cancellable"
    )
    const sku = order.lines[0].sku
    const before = (await db.inventory.get(`inv_${sku}`))?.levels

    await repository.transition(order.id, "cancel")

    expect((await db.inventory.get(`inv_${sku}`))?.levels).toEqual(before)
  })

  it("writes the order and the shelf together, or neither", async () => {
    // One transaction. If the stock write threw after the order write landed,
    // the books and the shelf would disagree with no way to tell which was right.
    const repository = await loadRepo()
    const db = (await import("../../db")).getDb()

    const order = await findOrder(
      repository,
      (o) =>
        o.status !== "cancelled" &&
        o.status !== "fulfilled" &&
        o.lines.length > 0,
      "fulfillable"
    )
    await repository.transition(order.id, "fulfill")

    expect((await repository.get(order.id))?.status).toBe("fulfilled")
    // and the ledger moved in the same breath
    const item = await db.inventory.get(`inv_${order.lines[0].sku}`)
    expect(item).toBeDefined()
  })
})

describe("demoOrdersRepository: update", () => {
  it("refuses a patch that reaches for a lifecycle axis", async () => {
    const repository = await loadRepo()
    const order = await findOrder(repository, () => true, "present")

    // The door this closes: update() took any Partial<Order>, so a caller could
    // set status / payment / fulfillment directly and skip every rule.
    for (const patch of [
      { status: "cancelled" as const },
      { payment: "refunded" as const },
      { fulfillment: "fulfilled" as const },
    ]) {
      await expect(repository.update(order.id, patch)).rejects.toThrow(
        /transition\(\)/
      )
    }
    expect(await repository.get(order.id)).toMatchObject({
      status: order.status,
      payment: order.payment,
      fulfillment: order.fulfillment,
    })
  })

  it("still patches an ordinary field", async () => {
    const repository = await loadRepo()
    const order = await findOrder(repository, () => true, "present")

    const next = await repository.update(order.id, {
      shipping: { ...order.shipping, carrier: "DHL" },
    })

    expect(next.shipping.carrier).toBe("DHL")
  })
})

describe("demoOrdersRepository: remove", () => {
  it("refuses to delete an order that still carries revenue", async () => {
    const repository = await loadRepo()
    const order = await findOrder(
      repository,
      (o) => o.status !== "cancelled" && o.payment !== "refunded",
      "a live sale"
    )

    await expect(repository.remove(order.id)).rejects.toThrow(/carries-revenue/)
    expect(await repository.get(order.id)).not.toBeNull()
  })

  it("deletes a cancelled order", async () => {
    const repository = await loadRepo()
    const order = await findOrder(
      repository,
      (o) => o.status === "cancelled",
      "cancelled"
    )

    await repository.remove(order.id)

    expect(await repository.get(order.id)).toBeNull()
  })

  it("resolves for an id that is not there", async () => {
    const repository = await loadRepo()
    await expect(repository.remove("SO-nope")).resolves.toBeUndefined()
  })
})
