// Domain types for the Commerce Admin mock-data layer. These are the shapes the
// entity pages (Orders first) wire ReUI blocks to; the seed + services in this
// folder are the swap seam for a real API later.

export type OrderStatus = "pending" | "processing" | "fulfilled" | "cancelled"
export type PaymentStatus = "paid" | "pending" | "refunded"
export type FulfillmentStatus = "unfulfilled" | "partial" | "fulfilled"

export interface OrderCustomer {
  name: string
  email: string
  /** Snapshot of Customer.avatar, absent for a customer created through the form. */
  avatar?: string
  /** URL-safe slug, also the Customer id: order.customer.handle === customer.id. */
  handle: string
}

// A customer record. `id` is the handle, so it joins to orders via
// order.customer.handle. Order-based aggregates (orders count, total spent, last
// order) are NOT stored here - they are derived at read time by joining orders,
// so optimistic order mutations never desync them.
export interface Customer {
  /** URL-safe handle; also the route param and the orders join key. */
  id: string
  name: string
  email: string
  /**
   * Portrait URL. Seeded for every roster customer; absent for one created
   * through the form, which is the only case initials are the intended render.
   */
  avatar?: string
  phone?: string
  company?: string
  /** Registered account vs guest checkout. */
  hasAccount: boolean
  location?: { city: string; countryCode: string }
  /** Ids of the customer groups this customer belongs to (many-to-many). */
  groups: string[]
  /** ISO 8601 signup date. */
  createdAt: string
  updatedAt?: string
}

// A customer group (segment). Membership is stored on Customer.groups; a group's
// members are the customers whose `groups` include this id.
export interface CustomerGroup {
  id: string
  name: string
  description?: string
  createdAt: string
}

export interface OrderLine {
  id: string
  /**
   * Links the line to the product it was bought from (Product.id), so revenue
   * can be grouped by category. Name/sku alone are not a reliable join key.
   */
  productId: string
  name: string
  sku: string
  color: string
  qty: number
  unitPrice: number
  /** Shipping weight in kilograms. */
  weight: number
  image: string
}

export interface OrderTotals {
  subtotal: number
  shipping: number
  tax: number
  total: number
}

/** A step in the Picking -> Packed -> Shipping -> Delivered fulfillment stepper. */
export type ShippingStepState = "done" | "active" | "pending"

export interface ShippingStep {
  label: string
  state: ShippingStepState
}

export interface OrderShipping {
  priority: "High" | "Standard" | "Economy"
  method: string
  carrier: string
  /**
   * The StockLocation the order ships from: the join key onto locations.ts, and
   * so onto the stock that should fulfil it. A place is an entity, not a string -
   * `from` below used to be the only record of an origin, which let an order
   * ship from a warehouse that existed nowhere in the location list.
   */
  locationId: string
  /**
   * Origin -> destination route shown as a timeline.
   *
   * `from` is a SNAPSHOT of the origin's address as it read when the order was
   * placed, kept beside `locationId` exactly as OrderCustomer keeps `name` /
   * `email` beside the `handle` reference: renaming or re-addressing a location
   * later must not rewrite the history of orders already shipped from it.
   * `locationId` is the reference; `from` is what was true at the time.
   */
  from: string
  to: string
  destinationLabel: string
  destinationLines: string[]
  // No `steps` here on purpose. The Picking -> Packed -> Shipping -> Delivered
  // stepper is a total pure function of (status, fulfillment), both of which are
  // fields on the Order already, so storing it duplicated a fact rather than
  // recording one. It was computed once at seed/create time and never
  // recomputed, so every transition left it lying: a cancelled order kept a
  // green Delivered checkmark directly under its Cancelled badge. Call
  // deriveSteps(order.status, order.fulfillment) at render instead - see
  // commerce.ts.
}

export interface Order {
  /** Stable id, also the route param, e.g. "SO-1042". */
  id: string
  /** Human display reference, e.g. "#1042". */
  number: string
  /** ISO 8601 timestamp. */
  date: string
  customer: OrderCustomer
  status: OrderStatus
  payment: PaymentStatus
  fulfillment: FulfillmentStatus
  lines: OrderLine[]
  totals: OrderTotals
  shipping: OrderShipping
}

/** Total units across all lines. */
export function orderItemCount(order: Order): number {
  return order.lines.reduce((sum, line) => sum + line.qty, 0)
}

/**
 * The money rule: a cancelled order is not a sale, and neither is a refunded one.
 *
 * Revenue, average order value, units sold, and category totals all exclude
 * both, while a count of orders PLACED still includes them - placing an order
 * and the order being worth money are two different questions. Every surface
 * that talks about money must use this one predicate: /analytics, customer
 * totals, and the dashboard each used to decide for themselves, so the same
 * store could report two different revenues.
 *
 * It reads two axes because they are two different facts. Cancelled means the
 * order never happened; refunded means it happened and the money went back. Net
 * sales is gross minus discounts minus refunds, so keying on `status` alone
 * counted a refunded order at full value - unreachable while nothing could
 * refund, and ordinary the moment something could.
 */
export function isSale(order: Order): boolean {
  return order.status !== "cancelled" && order.payment !== "refunded"
}

/**
 * The money face of isSale: what an order contributes to revenue.
 *
 * Every revenue figure sums THIS rather than filtering and then reaching for
 * `totals.total`, so the rule and the number cannot drift apart. isSale stays
 * exported because unit and count rollups need the boolean, not the money.
 *
 * A discount is NOT handled here, and does not need to be: it changes how
 * `totals.total` is COMPUTED (orderTotals in commerce.ts owns that), so the
 * total is already net of it. A refund is the opposite - it does not change what
 * the order was for, only whether it still counts.
 */
export function orderNetTotal(order: Order): number {
  return isSale(order) ? order.totals.total : 0
}
