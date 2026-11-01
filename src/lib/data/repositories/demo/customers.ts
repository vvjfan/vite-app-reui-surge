import { ensureSeeded, getDb } from "../../db"
import type { Customer } from "../../types"
import type { CustomersRepository } from "../types"
import { slugify } from "../../seed-utils"

// Demo adapter for customers. Hand-written (not makeDemoCollection) because the
// id is a handle derived from the name at create time, so orders keep joining on
// order.customer.handle. In the browser it reads / writes the in-memory demo
// store; on the server reads come back empty.

const isBrowser = typeof window !== "undefined"

export const demoCustomersRepository: CustomersRepository = {
  async list() {
    if (!isBrowser) return []
    await ensureSeeded()
    return getDb().customers.toArray()
  },

  async get(id) {
    if (!isBrowser) return null
    await ensureSeeded()
    return (await getDb().customers.get(id)) ?? null
  },

  async create(input) {
    const db = getDb()
    // Derive the handle/id from the name; keep it unique.
    const base = slugify(input.name) || "customer"
    let id = base
    let n = 2
    while (await db.customers.get(id)) id = `${base}-${n++}`
    const customer: Customer = { ...input, id }
    await db.customers.add(customer)
    return customer
  },

  async update(id, patch) {
    const db = getDb()
    await db.customers.update(id, patch)
    const next = await db.customers.get(id)
    if (!next) throw new Error(`Customer ${id} not found`)
    return next
  },

  async remove(id) {
    await getDb().customers.delete(id)
  },
}
