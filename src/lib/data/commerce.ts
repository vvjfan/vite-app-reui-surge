import { round2 } from "./seed-utils"
import type { Product, ProductVariant } from "./products"
import type {
  Customer,
  FulfillmentStatus,
  OrderLine,
  OrderShipping,
  OrderStatus,
  OrderTotals,
  PaymentStatus,
  ShippingStep,
} from "./types"

// Store rules the whole commerce domain shares: the seed clock, the shipping
// catalog, the address book, the tax rate, and the derivations that turn an
// order's status into its payment / fulfillment / stepper state.
//
// These used to be private to the orders seed, which exported only ORDERS. That
// made the generator the sole author of rules a create FORM also needs - a form
// would have had to restate the tax rate and the shipping table, and the two
// copies would drift the moment either moved. Anything here is store
// configuration, not seed trivia: it must read the same to the seed and to the
// UI that writes new orders.
//
// This module must not import orders.ts or customers.ts - both import it.
// products.ts is safe to import (it imports nothing), and only its types are
// used here.

// ── The seed clock ──

// The anchor ROLLS: it is the top of the current hour, computed once at seed
// time, and the newest order sits on it. A hardcoded anchor rots - a demo seeded
// in 2025 and opened in 2026 puts every order in the past, so every "this month"
// metric reads empty and the dashboard looks broken. Flooring to the hour keeps
// the dataset stable within a session (and across reloads in the same hour)
// while still tracking real time. Everything else stays seed-deterministic.
//
// Orders and customers both hang off this ONE clock. Two clocks would let the
// customer roster and the order book drift apart by however long the modules
// took to evaluate, which is exactly the kind of gap that breaks a
// "signed up before they ordered" invariant only sometimes.
export const SEED_NOW = (() => {
  const anchor = new Date()
  anchor.setMinutes(0, 0, 0)
  return anchor.getTime()
})()

// ── The signup / order date window ──
//
// The invariant: a customer must exist before they can order. Customers no
// longer derive their signup date from a first order (they are seeded first and
// know nothing about orders), so the two windows have to be kept apart BY
// CONSTRUCTION rather than by luck.
//
// The orders seed walks back `index * (10..35)` hours over 48 orders, so the
// oldest order the formula can reach is 47 * 35h = 68.5 days. Signups start at
// SIGNUP_MIN_AGE_DAYS, strictly beyond that ceiling, which leaves a margin no
// re-roll of the PRNG can eat. seed-integrity.test.ts asserts both halves: that
// no order is older than ORDER_MAX_AGE_DAYS, and that every order postdates its
// own customer's signup.

/** Ceiling on an order's age in days. The generator must stay inside this. */
export const ORDER_MAX_AGE_DAYS = 70

/** Oldest an order can be, plus margin: no signup is younger than this. */
export const SIGNUP_MIN_AGE_DAYS = 90

/** Spread signups back over ~14 months so a created-desc sort interleaves. */
export const SIGNUP_MAX_AGE_DAYS = 500

// ── Address book ──

/**
 * One address per city, shared by both seeds. A customer lives in `city`
 * (Customer.location); an order to that customer ships to `line` / `postal` in
 * the SAME city.
 *
 * The two seeds used to keep separate CITIES lists in different shapes, and an
 * order drew its destination at random from its own copy - so an order shipped
 * to a city its customer did not live in, roughly 9 times out of 10. One list,
 * one shape.
 */
export interface City {
  /** Plain city name. This is what Customer.location.city carries. */
  city: string
  /** This is what Customer.location.countryCode carries. */
  countryCode: string
  /** Street line of the order destination. */
  line: string
  /** Postal line of the order destination, e.g. "1015 DV Amsterdam". */
  postal: string
}

export const CITIES: readonly City[] = [
  {
    city: "Los Angeles",
    countryCode: "US",
    line: "8458 Sunset Blvd #209",
    postal: "Los Angeles, CA 90069",
  },
  {
    city: "New York",
    countryCode: "US",
    line: "350 5th Avenue, Suite 210",
    postal: "New York, NY 10118",
  },
  {
    city: "Amsterdam",
    countryCode: "NL",
    line: "Prinsengracht 24",
    postal: "1015 DV Amsterdam",
  },
  {
    city: "Paris",
    countryCode: "FR",
    line: "14 Rue de Rivoli",
    postal: "75004 Paris",
  },
  {
    city: "London",
    countryCode: "UK",
    line: "221B Baker Street",
    postal: "London NW1 6XE",
  },
  {
    city: "Berlin",
    countryCode: "DE",
    line: "Torstraße 88",
    postal: "10119 Berlin",
  },
  {
    city: "Tokyo",
    countryCode: "JP",
    line: "3-5-1 Ginza, Chuo City",
    postal: "Tokyo 104-0061",
  },
  {
    city: "Melbourne",
    countryCode: "AU",
    line: "455 Collins Street",
    postal: "Melbourne VIC 3000",
  },
  {
    city: "Toronto",
    countryCode: "CA",
    line: "78 Yonge Street",
    postal: "Toronto, ON M5E 1J8",
  },
  {
    city: "Copenhagen",
    countryCode: "DK",
    line: "Nyhavn 17",
    postal: "1051 København K",
  },
] as const

/** Look up a city's address template by its plain name (Customer.location.city). */
export const CITY_BY_NAME: ReadonlyMap<string, City> = new Map(
  CITIES.map((entry) => [entry.city, entry])
)

/** The destination half of an OrderShipping: where the parcel is going. */
export type OrderDestination = Pick<
  OrderShipping,
  "to" | "destinationLabel" | "destinationLines"
>

/**
 * Where an order to this customer ships: their own city's address template.
 *
 * Ship to where the customer actually lives. The seed used to pick(rng, CITIES)
 * against a local address list, so an order's destination had no relation to its
 * own customer's location and matched it only by coincidence. The seed and the
 * create form both route through here so neither can reintroduce that.
 *
 * Throws rather than emitting a half-built destination: a customer with no
 * address, or one living in a city outside CITIES, is a data bug worth surfacing
 * loudly, not an order shipped to an empty string.
 */
export function destinationFor(customer: Customer): OrderDestination {
  if (!customer.location) {
    throw new Error(
      `Customer ${customer.id} has no location, so an order cannot be shipped to them.`
    )
  }
  const dest = CITY_BY_NAME.get(customer.location.city)
  if (!dest) {
    throw new Error(
      `No address template for "${customer.location.city}" (customer ${customer.id}). ` +
        `Customer locations must come from commerce.ts CITIES.`
    )
  }
  const firstName = customer.name.split(" ")[0]
  return {
    to: `${dest.line}, ${dest.postal}`,
    destinationLabel: `Shipping to ${firstName}'s address`,
    destinationLines: [dest.line, `${dest.postal}, ${dest.countryCode}`],
  }
}

// ── Shipping ──

// There is no warehouse list here. A place an order ships from is a
// StockLocation (src/lib/data/locations.ts) - anything needing the list imports
// STOCK_LOCATIONS from there. This module used to export WAREHOUSES, three bare
// address strings, and the two copies drifted exactly as you would expect: orders
// shipped from "88 Distribution Dr, Rotterdam 3011", an address no location had,
// so an order's origin could not be joined to the stock meant to fulfil it.
// Re-exporting or re-listing STOCK_LOCATIONS here would rebuild the same trap.
// (locations.ts imports nothing, so referencing it cannot cycle.)

// The detail sheet's CarrierChip ships a UPS mark, so keep the carrier UPS to
// avoid a logo/name mismatch (block design stays intact).
export const CARRIERS = ["UPS Global"] as const

export interface ShippingMethod {
  method: string
  priority: OrderShipping["priority"]
  /** Flat shipping cost charged for this method. */
  shipping: number
}

export const SHIPPING_METHODS: readonly ShippingMethod[] = [
  { method: "Express Delivery", priority: "High", shipping: 15 },
  { method: "Standard Shipping", priority: "Standard", shipping: 8 },
  { method: "Economy Shipping", priority: "Economy", shipping: 5 },
]

// ── Order lines ──

// Shipping weight is the one OrderLine field the catalog has no source for
// (products carry no weight). Derive it per category rather than reintroducing a
// parallel item table - a rough per-category figure is all the UI displays.
const CATEGORY_WEIGHT_KG: Record<string, number> = {
  Apparel: 0.4,
  Footwear: 0.9,
  Outerwear: 1.2,
  Bags: 0.9,
  Accessories: 0.15,
  Activewear: 0.5,
  Denim: 0.7,
}
const FALLBACK_WEIGHT_KG = 0.5

function lineWeight(product: Product): number {
  return CATEGORY_WEIGHT_KG[product.category] ?? FALLBACK_WEIGHT_KG
}

// Variant titles encode the colour ("Sand / M"); options.Color is the structured
// form of the same thing and products.ts sets it on every seeded variant (sized
// or colour-only). seed-integrity.test.ts guards that invariant for the seed;
// the variants editor can still add a variant with no options, so fall back to
// "" rather than leak undefined onto a line typed `color: string`.
function lineColor(variant: ProductVariant): string {
  return variant.options.Color ?? ""
}

/**
 * The one way a catalog product becomes an order line. The seed and the create
 * form both call this, so a hand-entered line and a seeded one carry the same
 * name / sku / colour / price / weight for the same variant.
 *
 * `id` is a parameter because the two callers key lines differently: the seed
 * knows the order's sequence number and uses `L-{seq}-{i}`, while a draft has no
 * sequence yet (the repository mints it on create). The id is the only part of a
 * line that is not derivable from the product and variant, so it is the only
 * part the caller supplies.
 *
 * `variant` must belong to `product` - callers are responsible for that join
 * (validateOrderDraft enforces it for form input; the seed picks the variant off
 * the product it already holds).
 */
export function buildOrderLine(
  product: Product,
  variant: ProductVariant,
  qty: number,
  id: string
): OrderLine {
  return {
    id,
    productId: product.id,
    name: product.title,
    // variant.sku, NOT variant.id. The line's sku is what resolves it to a stock
    // row (inv_<sku>), so keying it to the id only worked because the seed mints
    // a variant's id and sku from the same expression. The variants editor does
    // not: it mints `variant-new-N` for the id and takes the sku from the form,
    // so an order for an admin-created product carried a sku that matched no
    // stock row, and fulfilling it moved nothing.
    sku: variant.sku,
    color: lineColor(variant),
    qty,
    unitPrice: variant.price,
    weight: lineWeight(product),
    // The colour's photo, not the product's: a line for the rust beanie shows
    // rust. Safe to read straight, since a colour with no shot of its own
    // already carries the product image.
    image: variant.image,
  }
}

// ── Money ──

/** Flat sales tax applied to an order's subtotal. */
export const TAX_RATE = 0.08

/**
 * The one way an order's money is computed. The seed and the create form both
 * call this, so a hand-entered order and a seeded one add up by the same rule.
 */
export function orderTotals(
  lines: readonly OrderLine[],
  shippingCost: number
): OrderTotals {
  const subtotal = round2(
    lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0)
  )
  const tax = round2(subtotal * TAX_RATE)
  return {
    subtotal,
    shipping: shippingCost,
    tax,
    total: round2(subtotal + shippingCost + tax),
  }
}

// ── Derivations ──
//
// An order's status is the input; payment, fulfillment, and the stepper follow
// from it. A create form needs these to build a new order's initial state, which
// is why they are here rather than private to the generator.

export function deriveFulfillment(
  status: OrderStatus,
  rng: () => number
): FulfillmentStatus {
  if (status === "fulfilled") return "fulfilled"
  if (status === "cancelled" || status === "pending") return "unfulfilled"
  return rng() > 0.5 ? "partial" : "unfulfilled"
}

export function derivePayment(
  status: OrderStatus,
  rng: () => number
): PaymentStatus {
  if (status === "cancelled") return rng() > 0.5 ? "refunded" : "pending"
  if (status === "pending") return "pending"
  return rng() > 0.15 ? "paid" : "pending"
}

export function deriveSteps(
  status: OrderStatus,
  fulfillment: FulfillmentStatus
): ShippingStep[] {
  const labels = ["Picking", "Packed", "Shipping", "Delivered"] as const
  let doneThrough = 0 // number of steps that are "done"; the next one is "active"
  if (status === "fulfilled")
    return labels.map((label) => ({ label, state: "done" }))
  if (status === "cancelled")
    return labels.map((label) => ({ label, state: "pending" }))
  if (status === "pending") doneThrough = 0
  else doneThrough = fulfillment === "partial" ? 2 : 1 // processing
  return labels.map((label, i) => ({
    label,
    state: i < doneThrough ? "done" : i === doneThrough ? "active" : "pending",
  }))
}
