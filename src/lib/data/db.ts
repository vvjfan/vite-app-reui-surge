import { ANALYTICS_SEED, type AnalyticsRecord } from "./analytics"
import { BILLING_KEY, DEFAULT_BILLING, INVOICES, type Invoice } from "./billing"
import { CATEGORIES, type Category } from "./categories"
import { CUSTOMER_GROUPS } from "./customer-groups"
import { CUSTOMERS } from "./customers"
import { INVENTORY_ITEMS, type InventoryItem } from "./inventory"
import { STOCK_LOCATIONS, type StockLocation } from "./locations"
import { NOTIFICATION_PREFS, type NotificationPref } from "./notifications"
import { ORDERS } from "./orders"
import { PAYMENT_PROVIDERS, type PaymentProvider } from "./payments"
import { PRODUCTS, type Product } from "./products"
import { PROMOTIONS, type Promotion } from "./promotions"
import { PURCHASE_ORDERS, type PurchaseOrder } from "./purchase-orders"
import { REVIEWS, type Review } from "./reviews"
import { SUPPLIERS, type Supplier } from "./suppliers"
import { DEFAULT_STORE_PROFILE, STORE_PROFILE_KEY } from "./store-profile"
import {
  ACCOUNT_PREFERENCES_KEY,
  ACCOUNT_PROFILE_KEY,
  ACCOUNT_SECURITY_KEY,
  DEFAULT_ACCOUNT_PREFERENCES,
  DEFAULT_ACCOUNT_PROFILE,
  DEFAULT_ACCOUNT_SECURITY,
} from "./account"
import { TEAM_MEMBERS, type Member } from "./team"
import type { Customer, CustomerGroup, Order } from "./types"

// Browser-only DEMO store, held in memory. Every byte of it comes from the
// static seed modules in this folder: no IndexedDB, no network, no external
// source. Reads are instant, every browser sees the same data, and a reload
// restores the pristine samples.
//
// The sample data loads on the first read (ensureSeeded, awaited inside every
// demo repository read), so a fresh visit lands on a populated store rather
// than an empty one. The guard is per-table `count() === 0`, so it fills only
// what is empty: rows you have created survive it. Settings -> General -> Demo
// data drives the same seed by hand (load / clear / reset), for reaching the
// empty and reset states on demand.
//
// Create / edit / delete work for the session; a reload starts the demo over.
// Production data never touches this file. To go live, swap the repository
// adapter (src/lib/data/repositories) for your API and this file is simply
// unused. See docs/DATA-LAYER.md.

// One row per settings singleton (store profile, notification prefs, payment
// providers, billing config). The value is an opaque JSON blob owned by the
// feature; the data layer only persists it, keyed by a stable string.
export interface SettingRecord {
  key: string
  value: unknown
}

/**
 * A single in-memory collection, keyed by primary key. The API is the subset
 * the demo adapters use, with the same contracts a real store gives them:
 * add() rejects a duplicate key rather than overwriting, update() patches only
 * an existing row, and every row crosses the boundary as a structured clone so
 * a caller can never mutate the store through a reference it kept.
 */
export class MemoryTable<T> {
  private rows = new Map<string, T>()

  private keyField: string

  constructor(keyField: string) {
    this.keyField = keyField
  }

  private keyOf(row: T): string {
    return (row as Record<string, unknown>)[this.keyField] as string
  }

  /** All rows, sorted by primary key — the order a keyed store hands back. */
  async toArray(): Promise<T[]> {
    return [...this.rows.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, row]) => structuredClone(row))
  }

  async get(key: string): Promise<T | undefined> {
    const row = this.rows.get(key)
    return row === undefined ? undefined : structuredClone(row)
  }

  async add(row: T): Promise<string> {
    const key = this.keyOf(row)
    if (this.rows.has(key))
      throw new Error(`Key ${key} already exists in the store`)
    this.rows.set(key, structuredClone(row))
    return key
  }

  async put(row: T): Promise<string> {
    const key = this.keyOf(row)
    this.rows.set(key, structuredClone(row))
    return key
  }

  /** Patch an existing row. Returns how many rows changed (0 or 1); never creates. */
  async update(key: string, patch: Partial<T>): Promise<number> {
    const row = this.rows.get(key)
    if (row === undefined) return 0
    this.rows.set(key, structuredClone({ ...row, ...patch }))
    return 1
  }

  async delete(key: string): Promise<void> {
    this.rows.delete(key)
  }

  async clear(): Promise<void> {
    this.rows.clear()
  }

  async count(): Promise<number> {
    return this.rows.size
  }

  async bulkAdd(rows: readonly T[]): Promise<void> {
    // All-or-nothing: check every key before writing any, so a duplicate in
    // the batch cannot leave half of it behind.
    const keys = rows.map((row) => this.keyOf(row))
    const seen = new Set<string>()
    for (const key of keys) {
      if (this.rows.has(key) || seen.has(key))
        throw new Error(`Key ${key} already exists in the store`)
      seen.add(key)
    }
    rows.forEach((row, i) => this.rows.set(keys[i], structuredClone(row)))
  }

  async bulkDelete(keys: readonly string[]): Promise<void> {
    for (const key of keys) this.rows.delete(key)
  }

  filter(predicate: (row: T) => boolean) {
    const matches = () =>
      [...this.rows.entries()].filter(([, row]) => predicate(row))
    return {
      toArray: async (): Promise<T[]> =>
        matches().map(([, row]) => structuredClone(row)),
      delete: async (): Promise<number> => {
        const hits = matches()
        for (const [key] of hits) this.rows.delete(key)
        return hits.length
      },
    }
  }

  /**
   * The rollback hooks transaction() uses. Rows are stored as clones and
   * replaced (never mutated) on write, so a shallow copy of the map is a full
   * snapshot.
   */
  snapshot(): Map<string, T> {
    return new Map(this.rows)
  }

  restore(snapshot: Map<string, T>): void {
    this.rows = snapshot
  }
}

// The never-typed restore parameter keeps every MemoryTable<T> assignable
// here under strict function-property variance; transaction() holds the only
// cast back, and it only ever hands a table its own snapshot.
interface Snapshottable {
  snapshot: () => Map<string, unknown>
  restore: (snapshot: Map<string, never>) => void
}

export class CommerceDatabase {
  orders = new MemoryTable<Order>("id")
  products = new MemoryTable<Product>("id")
  settings = new MemoryTable<SettingRecord>("key")
  teamMembers = new MemoryTable<Member>("id")
  paymentProviders = new MemoryTable<PaymentProvider>("id")
  notificationPrefs = new MemoryTable<NotificationPref>("id")
  invoices = new MemoryTable<Invoice>("id")
  customers = new MemoryTable<Customer>("id")
  customerGroups = new MemoryTable<CustomerGroup>("id")
  categories = new MemoryTable<Category>("id")
  inventory = new MemoryTable<InventoryItem>("id")
  promotions = new MemoryTable<Promotion>("id")
  reviews = new MemoryTable<Review>("id")
  analytics = new MemoryTable<AnalyticsRecord>("key")
  locations = new MemoryTable<StockLocation>("id")
  suppliers = new MemoryTable<Supplier>("id")
  purchaseOrders = new MemoryTable<PurchaseOrder>("id")

  /**
   * Run `scope` against the given tables, restoring every one of them if it
   * throws. What the demo needs from a transaction is the all-or-nothing part:
   * an order and the shelf change together or not at all (see the orders
   * adapter). Tables are passed singly or as one array, matching both call
   * shapes the callers use.
   */
  async transaction<TResult>(
    _mode: "r" | "rw",
    ...args: [...(Snapshottable | Snapshottable[])[], () => Promise<TResult>]
  ): Promise<TResult> {
    const scope = args[args.length - 1] as () => Promise<TResult>
    const tables = args.slice(0, -1).flat() as Snapshottable[]
    const snapshots = tables.map((table) => table.snapshot())
    try {
      return await scope()
    } catch (error) {
      tables.forEach((table, i) =>
        table.restore(snapshots[i] as Map<string, never>)
      )
      throw error
    }
  }
}

let dbInstance: CommerceDatabase | undefined

/**
 * Lazily construct the store. Browser only: the demo store is per-visitor
 * session state, and a module-level store on the server would be shared by
 * every request that touches it.
 */
export function getDb(): CommerceDatabase {
  if (typeof window === "undefined") {
    throw new Error(
      "getDb() is browser-only. The demo repository returns empty on the server."
    )
  }
  if (!dbInstance) dbInstance = new CommerceDatabase()
  return dbInstance
}

// ── The demo dataset manifest ──
//
// One list of every collection and singleton the sample data covers. load, clear
// and reset all drive off it, so a new entity can never be loaded by one action
// yet silently skipped by another. Add an entity here once.

type SeedCollection = {
  table: MemoryTable<unknown>
  rows: readonly unknown[]
}

function collection<T>(
  table: MemoryTable<T>,
  rows: readonly T[]
): SeedCollection {
  return {
    table: table,
    rows: rows,
  }
}

function seedCollections(db: CommerceDatabase): SeedCollection[] {
  return [
    collection(db.orders, ORDERS),
    collection(db.products, PRODUCTS),
    collection(db.teamMembers, TEAM_MEMBERS),
    collection(db.paymentProviders, PAYMENT_PROVIDERS),
    collection(db.notificationPrefs, NOTIFICATION_PREFS),
    collection(db.invoices, INVOICES),
    collection(db.customers, CUSTOMERS),
    collection(db.customerGroups, CUSTOMER_GROUPS),
    collection(db.categories, CATEGORIES),
    collection(db.inventory, INVENTORY_ITEMS),
    collection(db.promotions, PROMOTIONS),
    collection(db.reviews, REVIEWS),
    collection(db.analytics, ANALYTICS_SEED),
    collection(db.locations, STOCK_LOCATIONS),
    collection(db.suppliers, SUPPLIERS),
    collection(db.purchaseOrders, PURCHASE_ORDERS),
  ]
}

/** Settings singletons: one key/value row each, the value owned by a feature. */
function seedSingletons(): SettingRecord[] {
  return [
    { key: STORE_PROFILE_KEY, value: DEFAULT_STORE_PROFILE },
    { key: BILLING_KEY, value: DEFAULT_BILLING },
    { key: ACCOUNT_PROFILE_KEY, value: DEFAULT_ACCOUNT_PROFILE },
    { key: ACCOUNT_PREFERENCES_KEY, value: DEFAULT_ACCOUNT_PREFERENCES },
    { key: ACCOUNT_SECURITY_KEY, value: DEFAULT_ACCOUNT_SECURITY },
  ]
}

/**
 * Fill every empty collection from the sample data, leaving non-empty ones
 * alone. The shared body behind the automatic first-read seed (ensureSeeded) and
 * the explicit "Load demo data" action (loadDemoData).
 *
 * The guard is per-table `count() === 0`, so this ADDS the samples to a store
 * rather than replacing what is in it: run it after creating a product of your
 * own and your product is still there, in a `products` table the guard now
 * skips. To discard your own rows and restore the samples exactly, that is
 * resetDemoData.
 */
async function fillEmptyTables(): Promise<void> {
  const db = getDb()
  for (const { table, rows } of seedCollections(db)) {
    if ((await table.count()) === 0) await table.bulkAdd(rows)
  }
  for (const singleton of seedSingletons()) {
    if (!(await db.settings.get(singleton.key)))
      await db.settings.put(singleton)
  }
}

// Seeding is single-flight: two overlapping "Load demo data" clicks (or a
// click racing the automatic first-read seed) queue behind one another, so the
// later run sees the tables the first just filled and skips them - the same
// serialization a storage engine's transactions used to provide.
let seedTurn: Promise<void> = Promise.resolve()

function seedEmptyTables(): Promise<void> {
  const run = seedTurn.then(fillEmptyTables)
  seedTurn = run.catch(() => undefined)
  return run
}

let seedPromise: Promise<void> | undefined

/**
 * Seed the store on the first read, once per session (memoized). Every demo
 * repository read awaits it, so the first paint renders the samples rather
 * than an empty store, and the burst of reads a page fires still triggers a
 * single seed.
 *
 * A no-op on the server, where there is no per-visitor store to seed. The
 * memo also carries the load / clear / reset actions' intent for the rest of
 * the session: after clearDemoData it is settled, so the next read does not
 * quietly refill a store the visitor deliberately emptied.
 */
export function ensureSeeded(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (!seedPromise) {
    seedPromise = seedEmptyTables().catch((error) => {
      seedPromise = undefined
      throw error
    })
  }
  return seedPromise
}

/**
 * Load the sample data by hand (the "Load demo data" action). Fills only the
 * tables it finds empty, so it keeps anything you have created; see
 * seedEmptyTables. The automatic first-read seed is ensureSeeded.
 */
export async function loadDemoData(): Promise<void> {
  await seedEmptyTables()
  // The store now holds the samples, so the automatic seed has nothing left to
  // do this session. (A reload starts a fresh session and re-evaluates.)
  seedPromise = Promise.resolve()
}

/**
 * Empty every collection (the "Clear data" action). The store goes back to
 * nothing, and stays that way for the session.
 *
 * Only the singleton keys this file owns are deleted, not the whole settings
 * table, for the same reason resetDemoData does not clear it: a wipe would also
 * drop any key a feature has added since, which is not this function's to throw
 * away.
 */
export async function clearDemoData(): Promise<void> {
  const db = getDb()
  for (const { table } of seedCollections(db)) {
    await table.clear()
  }
  await db.settings.bulkDelete(seedSingletons().map((s) => s.key))
  // Keep the store empty for the rest of the session: without this the next read
  // would auto-seed it straight back. A reload reseeds, by design (see
  // ensureSeeded) - the samples are never gone for good.
  seedPromise = Promise.resolve()
}

/**
 * Wipe and restore every collection from the deterministic mock data (the
 * "Reset demo data" action). Unlike loadDemoData there is no `count() === 0`
 * guard: reset is meant to discard edits, so it always restores the samples.
 */
export async function resetDemoData(): Promise<void> {
  const db = getDb()
  for (const { table, rows } of seedCollections(db)) {
    await table.clear()
    await table.bulkAdd(rows)
  }
  // Put the singletons back to their defaults. The settings table itself is
  // not cleared: a wipe would also drop any key a feature added since.
  for (const singleton of seedSingletons()) {
    await db.settings.put(singleton)
  }
  // The store now holds the samples again, so the automatic seed is settled for
  // the session (it would be a no-op against the full store anyway).
  seedPromise = Promise.resolve()
}
