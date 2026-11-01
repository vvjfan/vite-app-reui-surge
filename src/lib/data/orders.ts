import {
  CARRIERS,
  SEED_NOW,
  SHIPPING_METHODS,
  buildOrderLine,
  deriveFulfillment,
  derivePayment,
  destinationFor,
  orderTotals,
} from "./commerce"
import { CUSTOMERS } from "./customers"
import { STOCK_LOCATIONS } from "./locations"
import { PRODUCTS } from "./products"
import { mulberry32, pick } from "./seed-utils"
import type { Product } from "./products"
import type { Customer, Order, OrderLine, OrderStatus } from "./types"

// Deterministic mock orders. Every choice is generated from a fixed seed so the
// dataset is stable across reloads and test runs (no Math.random). The only
// moving part is the date anchor, which rolls - see SEED_NOW in commerce.ts.
// Swap this module for a real API later via the repository seam
// (src/lib/data/repositories).
//
// Order lines are drawn from the REAL catalog (PRODUCTS) rather than a local
// copy of it. An earlier version kept its own item table here; the two drifted,
// so a line's sku matched a real variant only 2% of the time and nothing could
// join a line back to its product's category. products.ts must never import
// this module, or the two would cycle.
//
// The customer is drawn from the REAL roster (CUSTOMERS) for the same reason.
// This module used to invent a name per order out of local pools, and
// customers.ts then reconstructed the roster by aggregating those names back off
// the orders - so a customer could not exist until an order existed for them.
// The dependency now points the way the domain runs: people first, then their
// orders. customers.ts must never import this module.

// ── Sellable catalog (the real one) ──

// Only `active` products can appear on an order: a draft was never published and
// a scheduled one goes live later, so neither could have been bought. The active
// slice still spans all 7 categories, so revenue-by-category stays populated.
const SELLABLE: readonly Product[] = PRODUCTS.filter(
  (p) => p.status === "active"
)

// Lines draw a CATEGORY first, then a product within it. A uniform draw over
// the catalog follows the catalog's own mix, which let the deepest categories
// tower over the shallow ones on every units-per-category chart (a 6x spread
// between footwear and accessories). Categories near-even keeps that chart
// balanced while the per-line quantity still varies naturally.
const CATEGORY_POOLS: readonly (readonly Product[])[] = [
  ...new Set(SELLABLE.map((p) => p.category)),
]
  .sort()
  .map((category) => SELLABLE.filter((p) => p.category === category))

// A line's fields (name / sku / colour / price / weight) and an order's
// destination are built by commerce.ts, not here: the create form needs the same
// two rules, and a second copy of either would drift from this one.

// ── Buyers ──

/** A customer we can ship to: the address is what an order destination needs. */
type Buyer = Customer & { location: NonNullable<Customer["location"]> }

/**
 * How many of the roster ever place an order. The remainder never do, which is
 * the empty-orders / guest cohort /customers needs to exercise. Held at the
 * pre-inversion count so the split stays what it was (44 with orders, 12
 * without).
 */
const BUYER_COUNT = 44

/** Fixed seed for the buyer draw, so the same people buy on every run. */
const BUYER_SEED = 0xb17e_5eed

function shuffled<T>(rng: () => number, arr: readonly T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Which people buy is a stable, seeded draw across the whole roster - not a
 * slice of it, so it does not depend on the order customers.ts happens to emit.
 */
const BUYERS: Buyer[] = shuffled(
  mulberry32(BUYER_SEED),
  CUSTOMERS.filter((c): c is Buyer => Boolean(c.location))
).slice(0, BUYER_COUNT)

/**
 * Round-robin over the shuffled buyers, so every buyer gets at least one order
 * and the wrap gives the first few a repeat order. Picking a buyer at random per
 * order instead would, by the coupon-collector's problem, leave about a third of
 * them order-less on top of the deliberate no-order cohort - two thirds of the
 * roster showing an empty orders tab is not a store.
 */
function buyerFor(index: number): Buyer {
  return BUYERS[index % BUYERS.length]
}

// ── Derivations ──

const STATUS_WEIGHTED: OrderStatus[] = [
  "fulfilled",
  "fulfilled",
  "fulfilled",
  "fulfilled",
  "processing",
  "processing",
  "processing",
  "pending",
  "pending",
  "cancelled",
]

// ── Generator ──

const ORDER_COUNT = 48

function buildOrder(index: number): Order {
  const rng = mulberry32((1013904223 + index * 2654435761) >>> 0)
  const seq = 1042 + (ORDER_COUNT - 1 - index) // newest first gets the highest number

  const customer = buyerFor(index)

  const lineCount = 1 + Math.floor(rng() * 4) // 1..4
  const chosen = new Set<string>()
  const lines: OrderLine[] = []
  for (let i = 0; i < lineCount; i++) {
    // One product per line, no repeats within an order. The category is
    // STRATIFIED, not drawn: consecutive orders start at successive
    // categories and an order's lines step by 3 (coprime with 7, so they
    // never collide). Any contiguous date window - a dashboard period, not
    // just the whole ledger - then covers the categories near-evenly, while
    // the product and quantity draws keep the figures organic.
    let ci = (index + i * 3) % CATEGORY_POOLS.length
    while (CATEGORY_POOLS[ci].every((p) => chosen.has(p.id)))
      ci = (ci + 1) % CATEGORY_POOLS.length
    const pool = CATEGORY_POOLS[ci].filter((p) => !chosen.has(p.id))
    const product = pool[Math.floor(rng() * pool.length)]
    chosen.add(product.id)
    const variant = pick(rng, product.variants)
    const qty = 1 + Math.floor(rng() * 3)
    // Variant ids repeat across orders, so key the line on the order + slot.
    lines.push(buildOrderLine(product, variant, qty, `L-${seq}-${i}`))
  }

  const shippingChoice = pick(rng, SHIPPING_METHODS)
  const totals = orderTotals(lines, shippingChoice.shipping)

  const status = STATUS_WEIGHTED[Math.floor(rng() * STATUS_WEIGHTED.length)]
  const fulfillment = deriveFulfillment(status, rng)
  const payment = derivePayment(status, rng)

  const destination = destinationFor(customer)

  // The place this order ships from. Picked from the real location list, so
  // `shipping.locationId` always resolves and the origin can be joined to the
  // stock that should fulfil it (see seed-integrity.test.ts).
  const location = pick(rng, STOCK_LOCATIONS)

  const date = new Date(
    SEED_NOW - index * (10 + Math.floor(rng() * 26)) * 3_600_000
  ).toISOString()

  return {
    id: `SO-${seq}`,
    number: `#${seq}`,
    date,
    // handle IS the customer id: order.customer.handle === customer.id is the
    // documented join key (see types.ts).
    customer: {
      name: customer.name,
      email: customer.email,
      avatar: customer.avatar,
      handle: customer.id,
    },
    status,
    payment,
    fulfillment,
    lines,
    totals,
    shipping: {
      priority: shippingChoice.priority,
      method: shippingChoice.method,
      carrier: pick(rng, CARRIERS),
      // Origin is a real location, drawn with the same seeded rng as every other
      // choice here, so the dataset stays deterministic. `from` is that
      // location's own address rather than a string picked from a parallel list:
      // the two cannot disagree if only one of them is chosen.
      locationId: location.id,
      from: location.address,
      ...destination,
    },
  }
}

export const ORDERS: Order[] = Array.from({ length: ORDER_COUNT }, (_, i) =>
  buildOrder(i)
)
