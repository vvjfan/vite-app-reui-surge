import type { Category } from "../../categories"
import { ensureSeeded, getDb } from "../../db"
import type { CategoriesRepository } from "../types"
import { slugify } from "../../seed-utils"

// Demo adapter. In the browser it seeds on the first read (ensureSeeded) and
// reads / writes the in-memory demo store; on the server there is no per-visitor
// store, so reads come back empty. The id is the slugified handle
// (hand-written, like products), and is kept in sync with the handle.

const isBrowser = typeof window !== "undefined"

export const demoCategoriesRepository: CategoriesRepository = {
  async list() {
    if (!isBrowser) return []
    await ensureSeeded()
    return getDb().categories.toArray()
  },

  async get(id) {
    if (!isBrowser) return null
    await ensureSeeded()
    return (await getDb().categories.get(id)) ?? null
  },

  async create(input) {
    const db = getDb()
    const base = slugify(input.handle || input.name) || "category"
    let id = base
    let n = 2
    while (await db.categories.get(id)) id = `${base}-${n++}`
    const category: Category = { ...input, id, handle: id }
    await db.categories.add(category)
    return category
  },

  async update(id, patch) {
    const db = getDb()
    await db.categories.update(id, patch)
    const next = await db.categories.get(id)
    if (!next) throw new Error(`Category ${id} not found`)
    return next
  },

  async remove(id) {
    await getDb().categories.delete(id)
  },
}
