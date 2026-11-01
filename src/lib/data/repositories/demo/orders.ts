import { ensureSeeded, getDb } from "../../db"
import { planFulfilment } from "../../fulfilment"
import {
  applyTransition,
  checkDelete,
  OrderTransitionError,
} from "../../order-lifecycle"
import type { Order } from "../../types"
import type { OrdersRepository } from "../types"

/** The axes transition() owns. update() refuses a patch carrying any of them. */
const LIFECYCLE_FIELDS = ["status", "payment", "fulfillment"] as const

// Demo adapter. In the browser it reads and writes the in-memory demo store, so
// mutations hold for the rest of the session; a reload rebuilds the pristine
// samples from the seed.
//
// The `isBrowser` branch exists because the demo store does not exist on the
// server: this module is imported during SSR, so it must have something to
// return there rather than reach for a store that is not present. It is NOT
// there to make SSR match the client's first paint, which is what this comment
// used to claim and what two sibling adapters cite it for. Nothing calls it:
// no route prefetches and there is no dehydration boundary, so every query is
// still `pending` on the server and both the server and the first client paint
// render the loading skeleton. That is what makes them match.
//
// What it returns is EMPTY, not the sample data. The demo store lives in the
// browser: the samples are seeded there on the first read (ensureSeeded, in the
// browser branch below), and there is no per-visitor store on the server to
// seed or read.
// Handing the samples back here would let the server render a catalog off a
// store the client has not seeded yet, the moment anyone adds the prefetch the
// paragraph above says nobody has.
//
// Writes only happen from user interactions, which are client-side, so
// create/update/remove never run on the server.

const isBrowser = typeof window !== "undefined"

/**
 * The next order sequence number. `id` ("SO-1043") and `number` ("#1043") are
 * two faces of this ONE value, so both are minted here rather than letting a
 * caller supply either - see OrderInput in ../types.
 */
function nextOrderSeq(existing: Order[]): number {
  const max = existing.reduce((m, o) => {
    const n = Number(o.id.replace(/\D/g, ""))
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 1042)
  return max + 1
}

export const demoOrdersRepository: OrdersRepository = {
  async list() {
    if (!isBrowser) return []
    await ensureSeeded()
    return getDb().orders.toArray()
  },

  async get(id) {
    if (!isBrowser) return null
    await ensureSeeded()
    return (await getDb().orders.get(id)) ?? null
  },

  async create(input) {
    const db = getDb()
    const all = await db.orders.toArray()
    const seq = nextOrderSeq(all)
    const order: Order = {
      ...input,
      id: `SO-${seq}`,
      number: `#${seq}`,
      // Line ids are part of the order's identity, so they are minted here too,
      // on the same sequence the seed uses (`L-{seq}-{i}`). A draft cannot key
      // them this way - the sequence does not exist until now - so it numbers
      // them by slot. Re-keying here keeps ONE scheme across every order in the
      // store, rather than seeded rows and created rows disagreeing.
      lines: input.lines.map((line, index) => ({
        ...line,
        id: `L-${seq}-${index}`,
      })),
    }
    await db.orders.add(order)
    return order
  },

  async update(id, patch) {
    // The lifecycle axes are not patchable. They move only through transition(),
    // which reads the order first and decides what a verb costs it - see
    // ../../order-lifecycle. A field check rather than an inference: this cannot
    // mistake an ordinary edit for a cancel.
    for (const field of LIFECYCLE_FIELDS) {
      if (field in patch) {
        throw new Error(
          `Order ${id}: ${field} moves through transition(), not update().`
        )
      }
    }
    const db = getDb()
    await db.orders.update(id, patch)
    const next = await db.orders.get(id)
    if (!next) throw new Error(`Order ${id} not found`)
    return next
  },

  async transition(id, action) {
    const db = getDb()
    const current = await db.orders.get(id)
    if (!current) throw new Error(`Order ${id} not found`)
    // Guarded here as well as in the hook, because in demo mode this IS the
    // server and it writes to a persistent store. The rule lives in ONE module
    // and is called from both ends, which is the ordinary client/server
    // arrangement rather than a duplicated rule.
    const result = applyTransition(current, action)
    if (!result.ok) throw new OrderTransitionError(id, action, result.reason)

    // Fulfilling MOVES STOCK. It is the store's job, not a caller's: the order
    // and the shelf change together or not at all, which is why both tables are
    // in one transaction. Doing it above this layer would leave the store
    // reachable without it, and the units would ship twice.
    //
    // Only the shelf. The reservation releases itself, because allocations are
    // derived from the orders that are still open and this one no longer is.
    const plan =
      action === "fulfill"
        ? planFulfilment(current, await db.inventory.toArray())
        : null

    await db.transaction("rw", db.orders, db.inventory, async () => {
      await db.orders.update(id, result.patch)
      for (const write of plan?.writes ?? []) {
        await db.inventory.update(write.itemId, write.patch)
      }
    })

    // A line that resolved to no stock row is a broken join, not a refusal: the
    // order shipped either way, and swallowing it would let the seam rot
    // silently. seed-integrity pins the join precisely so this cannot fire.
    if (plan?.problems.length) {
      console.warn(
        `Order ${id} fulfilled, but stock did not move for: ${plan.problems
          .map((p) => `${p.sku} (${p.reason})`)
          .join(", ")}`
      )
    }

    const next = await db.orders.get(id)
    if (!next) throw new Error(`Order ${id} not found`)
    return next
  },

  async remove(id) {
    const db = getDb()
    const current = await db.orders.get(id)
    // Idempotent for a row that is already gone, as db.orders.delete() was.
    if (!current) return
    const check = checkDelete(current)
    if (!check.ok) throw new OrderTransitionError(id, "delete", check.reason)
    await db.orders.delete(id)
  },
}
