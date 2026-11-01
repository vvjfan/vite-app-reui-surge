import {
  ensureSeeded,
  getDb,
  type CommerceDatabase,
  type MemoryTable,
} from "../../db"
import type { Repository } from "../types"

// Factory for demo collection repositories. In the browser it seeds on the first
// read (ensureSeeded) and reads / writes the in-memory table so create / update /
// remove hold for the session; on the server, where there is no store and so no
// data, reads come back empty. Mirrors the hand-written orders/products demo
// adapters, kept DRY across settings entities. See ./orders.ts for why the
// server branch returns nothing rather than samples.
//
// Ids are random by default, because counting them broke twice over. Every
// collection used to pass its own `(all) => \`promo_${all.length + 1}\``: a
// delete below the last row dropped the count while the highest id stayed, so
// the next create recomputed an id that was still stored and add() - which
// rejects a duplicate key rather than overwriting - threw ConstraintError,
// permanently, because the count never moves back. And deleting the LAST row
// freed its id for the next record to inherit, along with every reference the
// deleted one left behind.
//
// No function of the stored rows can fix the second half: a freed id is, by
// definition, not among them. So the default stopped being a function of them.

const isBrowser = typeof window !== "undefined"

export function makeDemoCollection<T extends { id: string }>(
  getTable: (db: CommerceDatabase) => MemoryTable<T>,
  /**
   * Override how a created row's id is minted. Defaults to a random id, which is
   * what a collection should want: it cannot collide and it cannot be reused.
   *
   * It is handed nothing on purpose. The old signature passed in the stored
   * rows, which is the only thing a generator needs to count them - and counting
   * is the bug above. An override can prefix (team) or refuse (inventory); it
   * can no longer ask how many rows exist.
   */
  nextId: () => string = () => crypto.randomUUID()
): Repository<T, Omit<T, "id">> {
  const table = () => getTable(getDb())

  return {
    async list() {
      if (!isBrowser) return []
      await ensureSeeded()
      return table().toArray()
    },

    async get(id) {
      if (!isBrowser) return null
      await ensureSeeded()
      return (await table().get(id)) ?? null
    },

    async create(input) {
      const record = { ...input, id: nextId() } as T
      await table().add(record)
      return record
    },

    async update(id, patch) {
      await table().update(id, patch)
      const next = await table().get(id)
      if (!next) throw new Error(`Record ${id} not found`)
      return next
    },

    async remove(id) {
      await table().delete(id)
    },
  }
}
