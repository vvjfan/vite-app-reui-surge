import type { Invoice } from "../billing"
import type { Category } from "../categories"
import type { InventoryItem } from "../inventory"
import type { StockLocation } from "../locations"
import type { NotificationPref } from "../notifications"
import type { PaymentProvider } from "../payments"
import type { Product } from "../products"
import type { Promotion } from "../promotions"
import type { PurchaseOrder } from "../purchase-orders"
import type { Review } from "../reviews"
import type { Supplier } from "../suppliers"
import type { OrderTransition } from "../order-lifecycle"
import type { Member } from "../team"
import type { Customer, CustomerGroup, Order } from "../types"

// The integration seam. Everything above this layer reaches data ONLY through
// one of these interfaces and never learns whether it came from the in-memory
// demo store or a real backend. To go live, implement these against your API
// (REST, tRPC, GraphQL, Supabase, a TanStack Start server function - anything
// that can satisfy the five CRUD methods below, plus `transition` on orders)
// and flip VITE_DATA_MODE. See ./index.ts and docs/DATA-LAYER.md.

export interface Repository<T, TInput> {
  /** Every record. The data grid filters, sorts, and paginates client-side. */
  list: () => Promise<T[]>
  get: (id: string) => Promise<T | null>
  create: (input: TInput) => Promise<T>
  update: (id: string, patch: Partial<T>) => Promise<T>
  remove: (id: string) => Promise<void>
}

/** Create payloads: the full record minus the id, which the backend assigns. */
export type ProductInput = Omit<Product, "id">
export type MemberInput = Omit<Member, "id">

// Orders drop `number` as well as `id`. The two are one identity wearing two
// faces - "SO-1042" is the record, "#1042" is how it reads on screen - so the
// store mints BOTH from one sequence. A caller allowed to pass either could pair
// #1042 with SO-1099 and nothing downstream would notice.
export type OrderInput = Omit<Order, "id" | "number">

/**
 * Orders carry a sixth verb, because their lifecycle is not a field a caller may
 * set.
 *
 * `transition` moves an order along it - cancel, fulfill, refund - and the STORE
 * decides what each one does to status / payment / fulfillment, exactly as it
 * decides the id and the number on create. A commerce API models these as
 * endpoints you POST to, not as a field you PATCH, so this stays one verb taking
 * an action rather than three methods: a live adapter maps it 1:1 onto its own
 * endpoints without inferring intent from the shape of a patch.
 *
 * `update` remains for ordinary edits, but implementations must REJECT a patch
 * touching status / payment / fulfillment. Those move only through `transition`.
 */
export interface OrdersRepository extends Repository<Order, OrderInput> {
  transition: (id: string, action: OrderTransition) => Promise<Order>
}

// The store mints the id (on the PO-#### sequence) and stamps createdAt and the
// starting `draft` status, so none of those are a caller's to supply.
export type PurchaseOrderInput = Omit<
  PurchaseOrder,
  "id" | "createdAt" | "status" | "receivedAt"
>

/**
 * Purchase orders carry two lifecycle verbs beyond CRUD, for the same reason
 * orders carry `transition`: the status is the store's to move, not a field a
 * caller may PATCH.
 *
 * `receive` is the only write that touches inventory - it adds each line's
 * quantity to the shelf at the PO's location and records a restock movement, so
 * the PO and the stock change together or not at all. `cancel` closes a draft
 * that will not be received. Both reject a PO that is not still a draft.
 */
export interface PurchaseOrdersRepository extends Repository<
  PurchaseOrder,
  PurchaseOrderInput
> {
  receive: (
    id: string,
    author: { name: string; initials: string; avatar?: string }
  ) => Promise<PurchaseOrder>
  cancel: (id: string) => Promise<PurchaseOrder>
}
export type ProductsRepository = Repository<Product, ProductInput>
export type TeamMembersRepository = Repository<Member, MemberInput>
export type PaymentProvidersRepository = Repository<
  PaymentProvider,
  Omit<PaymentProvider, "id">
>
export type NotificationPrefsRepository = Repository<
  NotificationPref,
  Omit<NotificationPref, "id">
>
export type InvoicesRepository = Repository<Invoice, Omit<Invoice, "id">>

// Inventory is a standard CRUD collection (stock rows with nested lots and
// movement history), so the demo adapter uses the makeDemoCollection factory.
export type InventoryInput = Omit<InventoryItem, "id">
export type InventoryRepository = Repository<InventoryItem, InventoryInput>

// Customers: the id is a handle derived from the name (so orders join to it), so
// the demo adapter is hand-written rather than the makeDemoCollection factory.
export type CustomerInput = Omit<Customer, "id">
export type CustomersRepository = Repository<Customer, CustomerInput>

// Customer groups are a standard CRUD collection (membership lives on the
// customer), so the demo adapter uses the makeDemoCollection factory.
export type CustomerGroupInput = Omit<CustomerGroup, "id">
export type CustomerGroupsRepository = Repository<
  CustomerGroup,
  CustomerGroupInput
>

// Categories are a hierarchical tree (parentId); the id is a handle derived from
// the name, so the demo adapter is hand-written like products.
export type CategoryInput = Omit<Category, "id">
export type CategoriesRepository = Repository<Category, CategoryInput>

// Stock locations are a flat CRUD collection. Inventory rows reference one by
// id (InventoryItem.locationId), so renaming a location never touches the rows.
export type LocationInput = Omit<StockLocation, "id">
export type LocationsRepository = Repository<StockLocation, LocationInput>

// Suppliers are a flat CRUD collection. Inventory rows reference one by id
// (InventoryItem.supplierId), so renaming a supplier never touches the rows.
// Not to be confused with Product.vendor, which is the catalog's brand label.
export type SupplierInput = Omit<Supplier, "id">
export type SuppliersRepository = Repository<Supplier, SupplierInput>

// Promotions (discounts) are a standard CRUD collection, so the demo adapter uses
// the makeDemoCollection factory (which assigns the id).
//
// `PromotionInput` is the caller-facing create shape: `usedCount` is optional
// because a new promotion starts at zero redemptions, and `rank` is optional
// because a new promotion stacks last until a merchandiser moves it.
// useCreatePromotion resolves both defaults before they reach the repository, so
// the repository itself takes a complete record minus the id.
export type PromotionInput = Omit<Promotion, "id" | "usedCount" | "rank"> & {
  usedCount?: number
  rank?: number
}
export type PromotionsRepository = Repository<Promotion, Omit<Promotion, "id">>

// Reviews are moderated storefront submissions: the admin only ever updates the
// status (approve / reject) or removes a row, so the id is a plain sequence
// rather than a handle and the demo adapter is hand-written.
export type ReviewInput = Omit<Review, "id">
export type ReviewsRepository = Repository<Review, ReviewInput>

// Settings are singletons (store profile, prefs, providers, billing), so they
// use a key/value seam rather than the collection Repository above. The feature
// owns each value's shape and its default; the repository only persists blobs.
export interface SettingsRepository {
  get: <T>(key: string) => Promise<T | null>
  set: <T>(key: string, value: T) => Promise<T>
}

// Storefront traffic aggregates (sessions, funnel, channels, per-order
// attribution) as key/value blobs, one row per dataset. Get-only like the
// dashboard: a live backend swaps it for an analytics provider query. Money
// metrics are deliberately absent - /analytics derives those from the orders
// repository at read time so they always match the store.
export interface AnalyticsRepository {
  get: <T>(key: string) => Promise<T | null>
}
