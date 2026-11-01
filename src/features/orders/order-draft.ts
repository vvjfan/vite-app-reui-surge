import {
  CARRIERS,
  SHIPPING_METHODS,
  buildOrderLine,
  destinationFor,
  orderTotals,
} from "@/lib/data/commerce"
import type { StockLocation } from "@/lib/data/locations"
import type { Product, ProductVariant } from "@/lib/data/products"
import type { OrderInput } from "@/lib/data/repositories"
import type { Customer, OrderLine } from "@/lib/data/types"

// Pure form logic for the new-order editor: the draft shape, the validator, and
// the draft -> payload mapping. Deliberately free of React so the rules can be
// read (and tested) on their own, without rendering the form.
//
// Validation matches the promotion / product editors' stack: plain React state
// plus a validate() pass on submit. The repo has no react-hook-form / zod
// dependency (a form stack is adopted project-wide or not at all), so
// `validateOrderDraft` below is the equivalent of a schema - one place that
// owns every rule.
//
// Nothing here invents an order's shape. Lines, destination, totals, and the
// stepper all come from commerce.ts, the same module the seed generator uses, so
// a hand-entered order and a seeded one are built by one set of rules.

// ── Draft ──

export interface OrderDraftLine {
  productId: string
  variantId: string
  /** Plain input string; validated to a whole number >= 1. */
  qty: string
}

export interface OrderDraft {
  customerId: string
  lines: OrderDraftLine[]
  /** A ShippingMethod.method value from SHIPPING_METHODS. */
  shippingMethod: string
  /**
   * A StockLocation.id from the store's locations - the id, never an address.
   * The order's `shipping.from` address is resolved FROM this id, so a caller
   * cannot supply an origin that no location has.
   */
  locationId: string
}

/** What the validator and the mapper need to resolve a draft's ids. */
export interface OrderDraftContext {
  customers: Customer[]
  products: Product[]
  /**
   * Locations are a CRUD collection, not a constant: the Settings sheet can add
   * one or re-address one, so the store's list outgrows the seed. They resolve
   * through the context for the same reason customers and products do - the
   * picker, the rules, and the payload must read ONE list. Validating against
   * the STOCK_LOCATIONS seed instead would offer an operator-created location
   * and then reject it, and would snapshot a stale address after a re-address.
   */
  locations: StockLocation[]
}

export function emptyOrderDraftLine(): OrderDraftLine {
  return { productId: "", variantId: "", qty: "1" }
}

/**
 * A blank draft. The shipping method defaults to the first: SHIPPING_METHODS is
 * a constant, so a default is always resolvable. The origin location cannot
 * default that way - locations are loaded from the store, so no id is known
 * until they arrive, and guessing one here would either name a location the
 * operator never chose or a seed row the store may no longer hold. Customer,
 * line, and origin are genuinely unknown, so they start empty.
 */
export function emptyOrderDraft(): OrderDraft {
  return {
    customerId: "",
    lines: [emptyOrderDraftLine()],
    shippingMethod: SHIPPING_METHODS[0].method,
    locationId: "",
  }
}

// ── Errors ──

/** Per-line messages, one per field of an OrderDraftLine. */
export interface OrderDraftLineErrors {
  productId?: string
  variantId?: string
  qty?: string
}

/**
 * The validator's result: empty means valid (see `hasOrderErrors`).
 *
 * `lines` is an array, so a flat `Partial<Record<keyof OrderDraft, string>>`
 * cannot express "line 2's quantity is wrong" - the promotion editor's shape
 * does not stretch here. Two kinds of message coexist instead:
 *
 * - the scalar fields (`customerId`, `shippingMethod`, `locationId`) carry one
 *   message each, exactly as the promotion editor does;
 * - `lines` carries a message about the LIST as a whole (there isn't one), while
 *   `lineErrors` carries messages about INDIVIDUAL lines.
 *
 * `lineErrors` is a sparse map keyed by the line's index in `draft.lines`, not a
 * parallel array: a valid line has no key at all, which preserves the
 * "empty = valid" idiom and lets the form look up `lineErrors?.[i]` while it
 * renders lines by index. Index is the only identity a draft line has - the id
 * does not exist until `toOrderPayload` builds one.
 */
export interface OrderErrors {
  customerId?: string
  /** About the line list as a whole, e.g. there are no lines. */
  lines?: string
  shippingMethod?: string
  locationId?: string
  /** Per-line messages keyed by index into `draft.lines`; absent when valid. */
  lineErrors?: Record<number, OrderDraftLineErrors>
}

/** True when the draft cannot be submitted. `lineErrors` makes a key count lie. */
export function hasOrderErrors(errors: OrderErrors): boolean {
  return Object.keys(errors).length > 0
}

// ── Validation ──

/** Every rule in one place; returns a message map (empty = valid). */
export function validateOrderDraft(
  draft: OrderDraft,
  ctx: OrderDraftContext
): OrderErrors {
  const errors: OrderErrors = {}

  const customer = ctx.customers.find((c) => c.id === draft.customerId)
  if (!draft.customerId) {
    errors.customerId = "Select a customer."
  } else if (!customer) {
    errors.customerId = "Unknown customer."
  } else if (!customer.location) {
    // An order ships to the customer's own city (destinationFor), so one with no
    // address cannot be ordered from. The editor used to enforce this by hiding
    // such customers from the picker, which told the operator nothing: the
    // customer was in /customers and absent here, and the only message was "No
    // customers found." Stated as a rule it names the customer and points at the
    // fix, and it keeps the promise toOrderPayload relies on - destinationFor is
    // only ever reached with an address to resolve.
    errors.customerId = `${customer.name} has no city set, so there is nowhere to ship to. Add one on the customer.`
  }

  if (draft.lines.length === 0) {
    errors.lines = "Add at least one product."
  }

  const lineErrors: Record<number, OrderDraftLineErrors> = {}
  // First index each variant was seen at, so a repeat is reported on the LATER
  // line: the first occurrence is the legitimate one.
  const seenVariantAt = new Map<string, number>()

  draft.lines.forEach((line, index) => {
    const lineError: OrderDraftLineErrors = {}
    const product = ctx.products.find((p) => p.id === line.productId)

    if (!line.productId) {
      lineError.productId = "Select a product."
    } else if (!product) {
      lineError.productId = "Unknown product."
    }

    // The variant rules are only answerable once the product resolves: "does
    // this variant belong to that product" has no meaning without the product.
    // The productId message already blocks submit in that case.
    if (product) {
      if (!line.variantId) {
        lineError.variantId = "Select a variant."
      } else if (!product.variants.some((v) => v.id === line.variantId)) {
        // The join bug this codebase keeps paying for: a variant id left over
        // from a previously selected product still passes a naive "exists?"
        // check, and the order then carries another product's price and colour.
        lineError.variantId =
          "That variant does not belong to the selected product."
      } else {
        const firstSeen = seenVariantAt.get(line.variantId)
        if (firstSeen === undefined) {
          seenVariantAt.set(line.variantId, index)
        } else {
          // The seed never repeats a product within an order, and a repeated
          // variant is a quantity edit, not a second line.
          lineError.variantId = "This variant is already on the order."
        }
      }
    }

    const qty = Number(line.qty)
    if (
      !line.qty.trim() ||
      Number.isNaN(qty) ||
      !Number.isInteger(qty) ||
      qty < 1
    ) {
      lineError.qty = "Enter a whole number of 1 or more."
    }

    if (Object.keys(lineError).length > 0) {
      lineErrors[index] = lineError
    }
  })

  // Only attach when non-empty, or `hasOrderErrors` would read a valid draft as
  // invalid on the strength of an empty map.
  if (Object.keys(lineErrors).length > 0) {
    errors.lineErrors = lineErrors
  }

  if (!SHIPPING_METHODS.some((m) => m.method === draft.shippingMethod)) {
    errors.shippingMethod = "Choose a shipping method."
  }

  // The id has to RESOLVE, not merely be non-empty: an origin that no location
  // answers to is the bug this field exists to prevent.
  if (!ctx.locations.some((l) => l.id === draft.locationId)) {
    errors.locationId = "Choose a location."
  }

  return errors
}

// ── Draft -> payload ──

function mustFind<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    // toOrderPayload assumes a validated draft, so a miss here is a programming
    // error (a caller that skipped validateOrderDraft). Throw rather than emit
    // an order with a blank sku or a zero price that would be believed.
    throw new Error(`${what}. Call validateOrderDraft before toOrderPayload.`)
  }
  return value
}

/**
 * Draft -> the shape the repository stores. Assumes a VALID draft: validate
 * first. Every field is derived, never invented - `id` and `number` are absent
 * because the store mints both from one sequence (see OrderInput).
 */
export function toOrderPayload(
  draft: OrderDraft,
  ctx: OrderDraftContext,
  now: Date = new Date()
): OrderInput {
  const customer = mustFind(
    ctx.customers.find((c) => c.id === draft.customerId),
    `No customer "${draft.customerId}"`
  )

  const lines: OrderLine[] = draft.lines.map((line, index) => {
    const product = mustFind(
      ctx.products.find((p) => p.id === line.productId),
      `No product "${line.productId}"`
    )
    const variant: ProductVariant = mustFind(
      product.variants.find((v) => v.id === line.variantId),
      `Variant "${line.variantId}" does not belong to product "${line.productId}"`
    )
    // Line ids: the slot's index within THIS order.
    //
    // The seed keys lines `L-{seq}-{i}` because it knows the order's sequence
    // number up front and wants ids that stay distinct across all 48 orders. A
    // draft cannot: create mints the id AFTER this payload is built, so the
    // order-scoping half of that key does not exist yet. What a line id has to
    // guarantee is uniqueness within its own order (it keys the lines of one
    // order in the detail table), and the slot index gives exactly that, by
    // construction - independent of any validation rule that might later change.
    return buildOrderLine(product, variant, Number(line.qty), `L-${index}`)
  })

  const method = mustFind(
    SHIPPING_METHODS.find((m) => m.method === draft.shippingMethod),
    `No shipping method "${draft.shippingMethod}"`
  )
  const location = mustFind(
    ctx.locations.find((l) => l.id === draft.locationId),
    `No location "${draft.locationId}"`
  )

  // A just-placed order: nobody has taken payment or picked a box yet. The
  // status drives the other two (and the stepper), so they are stated as the one
  // consistent trio rather than derived from a random roll like the seed's.
  const status = "pending" as const
  const payment = "pending" as const
  const fulfillment = "unfulfilled" as const

  return {
    date: now.toISOString(),
    // handle IS the customer id: order.customer.handle === customer.id is the
    // documented join key (see types.ts).
    customer: {
      name: customer.name,
      email: customer.email,
      handle: customer.id,
    },
    status,
    payment,
    fulfillment,
    lines,
    totals: orderTotals(lines, method.shipping),
    shipping: {
      priority: method.priority,
      method: method.method,
      // One carrier in the catalog: the detail sheet ships a UPS mark, so there
      // is nothing to choose between (see CARRIERS).
      carrier: CARRIERS[0],
      // Both come off the ONE resolved location: the reference and the address
      // snapshot it stands for. `from` is never a caller-supplied string, which
      // is what let an order claim an origin no location had.
      locationId: location.id,
      from: location.address,
      ...destinationFor(customer),
    },
  }
}
