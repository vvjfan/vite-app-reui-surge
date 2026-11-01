import { describe, it, expect } from "vitest"

import {
  CARRIERS,
  SHIPPING_METHODS,
  destinationFor,
  orderTotals,
} from "@/lib/data/commerce"
import { STOCK_LOCATIONS, type StockLocation } from "@/lib/data/locations"
import type { Product } from "@/lib/data/products"
import type { Customer } from "@/lib/data/types"

import {
  emptyOrderDraft,
  hasOrderErrors,
  toOrderPayload,
  validateOrderDraft,
} from "./order-draft"
import type { OrderDraft, OrderDraftContext } from "./order-draft"

// `validateOrderDraft` stands in for a schema (the repo has no zod /
// react-hook-form), so it is covered rule by rule: every branch that can write a
// message, plus the cases that must stay silent. `toOrderPayload` is covered for
// what it DERIVES - the expectations recompute from the same commerce.ts rules
// rather than hardcoding numbers a refactor could drift from.

// ── Fixtures ──
//
// Hand-built, not the seed: a fixture that spells out the join lets a test say
// "this variant belongs to THAT product" in one line. The city must exist in
// commerce.ts CITIES, since destinationFor resolves against it.

const TEE: Product = {
  id: "cotton-tee",
  title: "Cotton Tee",
  subtitle: "Everyday tee",
  description: "A tee.",
  status: "active",
  category: "Apparel", // CATEGORY_WEIGHT_KG: 0.4
  kind: "Physical",
  vendor: "Manifest",
  thumbnail: "/img/tee.png",
  images: ["/img/tee.png"],
  tags: [],
  collections: [],
  variants: [
    {
      id: "cotton-tee-sand-m",
      sku: "TEE-SAND-M",
      title: "Sand / M",
      options: { Color: "Sand", Size: "M" },
      price: 30,
      image: "/img/tee-sand.png",
    },
    {
      id: "cotton-tee-black-l",
      sku: "TEE-BLACK-L",
      title: "Black / L",
      options: { Color: "Black", Size: "L" },
      price: 32.5,
      image: "/img/tee-black.png",
    },
  ],
}

const BOOT: Product = {
  id: "trail-boot",
  title: "Trail Boot",
  subtitle: "All-terrain",
  description: "A boot.",
  status: "active",
  category: "Footwear", // CATEGORY_WEIGHT_KG: 0.9
  kind: "Physical",
  vendor: "Manifest",
  thumbnail: "/img/boot.png",
  images: ["/img/boot.png"],
  tags: [],
  collections: [],
  variants: [
    {
      id: "trail-boot-brown-42",
      sku: "BOOT-BROWN-42",
      title: "Brown / 42",
      options: { Color: "Brown", Size: "42" },
      price: 145,
      image: "/img/boot-brown.png",
    },
  ],
}

const ADA: Customer = {
  id: "ada-lovelace",
  name: "Ada Lovelace",
  email: "ada@example.com",
  hasAccount: true,
  location: { city: "London", countryCode: "UK" },
  groups: [],
  createdAt: "2025-01-01T00:00:00.000Z",
}

/**
 * A customer with no city. This is exactly what the create form used to write -
 * every field but an address - which is what made a created customer impossible
 * to order from. The type still allows it (a live backend may hold a customer
 * who never gave an address), so the rules have to answer for it.
 */
const NO_CITY: Customer = {
  id: "grace-hopper",
  name: "Grace Hopper",
  email: "grace@example.com",
  hasAccount: true,
  groups: [],
  createdAt: "2025-01-01T00:00:00.000Z",
}

/** A location an operator added after seeding: in the store, not in the seed. */
const OPERATOR_MADE: StockLocation = {
  ...STOCK_LOCATIONS[0],
  id: "loc_popup",
  name: "Pop-up-Shoreditch",
  address: "3 Redchurch St, London",
}

// The seed list stands in for the store's locations exactly as [ADA] and
// [TEE, BOOT] stand in for its customers and products: the ctx is the ONE list
// the rules resolve against, whatever loaded it.
const CTX: OrderDraftContext = {
  customers: [ADA],
  products: [TEE, BOOT],
  locations: STOCK_LOCATIONS,
}

/** Pinned, so a payload's date is asserted exactly rather than approximately. */
const NOW = new Date("2026-03-04T09:30:00.000Z")

/** A valid baseline; each test overrides only the field it is about. */
const makeDraft = (overrides: Partial<OrderDraft> = {}): OrderDraft => ({
  customerId: ADA.id,
  lines: [{ productId: TEE.id, variantId: "cotton-tee-sand-m", qty: "2" }],
  shippingMethod: SHIPPING_METHODS[0].method,
  locationId: STOCK_LOCATIONS[0].id,
  ...overrides,
})

// ── emptyOrderDraft ──

describe("emptyOrderDraft", () => {
  it("starts with one blank line and a resolvable shipping default", () => {
    const draft = emptyOrderDraft()
    expect(draft.customerId).toBe("")
    expect(draft.lines).toHaveLength(1)
    expect(draft.lines[0]).toEqual({ productId: "", variantId: "", qty: "1" })
    // SHIPPING_METHODS is a constant, so a default is always resolvable.
    expect(
      SHIPPING_METHODS.some((m) => m.method === draft.shippingMethod)
    ).toBe(true)
    // The origin cannot default that way: locations load from the store, so no id
    // is known when a blank draft is made. Empty is the honest starting value -
    // guessing a seed id here would name a location the store may no longer hold.
    expect(draft.locationId).toBe("")
  })

  it("reports every unfilled field, and only those", () => {
    const errors = validateOrderDraft(emptyOrderDraft(), CTX)
    expect(errors.customerId).toBe("Select a customer.")
    expect(errors.lineErrors?.[0]?.productId).toBe("Select a product.")
    expect(errors.locationId).toBe("Choose a location.")
    // The one field that DOES default to a real member never starts invalid.
    expect(errors.shippingMethod).toBeUndefined()
  })

  it("returns a fresh object each call (no shared line array)", () => {
    const a = emptyOrderDraft()
    const b = emptyOrderDraft()
    a.lines[0].qty = "9"
    expect(b.lines[0].qty).toBe("1")
  })
})

// ── validateOrderDraft ──

describe("validateOrderDraft: a valid draft", () => {
  it("returns an empty error map", () => {
    expect(validateOrderDraft(makeDraft(), CTX)).toEqual({})
    expect(hasOrderErrors(validateOrderDraft(makeDraft(), CTX))).toBe(false)
  })

  it("accepts several lines of different variants", () => {
    const errors = validateOrderDraft(
      makeDraft({
        lines: [
          { productId: TEE.id, variantId: "cotton-tee-sand-m", qty: "1" },
          { productId: TEE.id, variantId: "cotton-tee-black-l", qty: "3" },
          { productId: BOOT.id, variantId: "trail-boot-brown-42", qty: "1" },
        ],
      }),
      CTX
    )
    expect(errors).toEqual({})
  })
})

describe("validateOrderDraft: customer", () => {
  it("requires a customer", () => {
    expect(
      validateOrderDraft(makeDraft({ customerId: "" }), CTX).customerId
    ).toBe("Select a customer.")
  })

  it("rejects a customer id that resolves to nobody", () => {
    expect(
      validateOrderDraft(makeDraft({ customerId: "grace-hopper" }), CTX)
        .customerId
    ).toBe("Unknown customer.")
  })

  it("rejects a customer with no city, naming them", () => {
    // The rule the order editor used to enforce by hiding such customers from
    // the picker - which is why nobody could see why their order was impossible.
    // Stated here, the message names who and what to do.
    const ctx = { ...CTX, customers: [NO_CITY] }
    const message = validateOrderDraft(
      makeDraft({ customerId: NO_CITY.id }),
      ctx
    ).customerId

    expect(message).toContain(NO_CITY.name)
    expect(message).toContain("no city set")
  })

  it("blocks submit for a customer with no city", () => {
    // hasOrderErrors is what the editor gates on, so the rule has to reach it:
    // an unshippable customer must not be merely annotated.
    const ctx = { ...CTX, customers: [NO_CITY] }

    expect(
      hasOrderErrors(
        validateOrderDraft(makeDraft({ customerId: NO_CITY.id }), ctx)
      )
    ).toBe(true)
  })

  it("keeps toOrderPayload's promise: a valid draft always has a destination", () => {
    // toOrderPayload calls destinationFor, which THROWS on a customer with no
    // location. That is only safe while the validator refuses to call such a
    // draft valid, so the two are pinned together here rather than separately.
    const ctx = { ...CTX, customers: [NO_CITY] }
    const draft = makeDraft({ customerId: NO_CITY.id })

    expect(hasOrderErrors(validateOrderDraft(draft, ctx))).toBe(true)
    expect(() => toOrderPayload(draft, ctx, NOW)).toThrow()
  })
})

describe("validateOrderDraft: the line list", () => {
  it("requires at least one line", () => {
    const errors = validateOrderDraft(makeDraft({ lines: [] }), CTX)
    expect(errors.lines).toBe("Add at least one product.")
    expect(hasOrderErrors(errors)).toBe(true)
  })

  it("does not report a list error when there is a line", () => {
    expect(validateOrderDraft(makeDraft(), CTX).lines).toBeUndefined()
  })
})

describe("validateOrderDraft: product", () => {
  it("requires a product", () => {
    const errors = validateOrderDraft(
      makeDraft({ lines: [{ productId: "", variantId: "", qty: "1" }] }),
      CTX
    )
    expect(errors.lineErrors?.[0]?.productId).toBe("Select a product.")
  })

  it("rejects a product id that resolves to nothing", () => {
    const errors = validateOrderDraft(
      makeDraft({
        lines: [{ productId: "ghost-product", variantId: "x", qty: "1" }],
      }),
      CTX
    )
    expect(errors.lineErrors?.[0]?.productId).toBe("Unknown product.")
  })

  it("stays silent about the variant while the product is unresolved", () => {
    // "does this variant belong to that product" has no answer without the
    // product; the productId message already blocks submit.
    const errors = validateOrderDraft(
      makeDraft({ lines: [{ productId: "", variantId: "", qty: "1" }] }),
      CTX
    )
    expect(errors.lineErrors?.[0]?.variantId).toBeUndefined()
  })
})

describe("validateOrderDraft: variant", () => {
  it("requires a variant", () => {
    const errors = validateOrderDraft(
      makeDraft({ lines: [{ productId: TEE.id, variantId: "", qty: "1" }] }),
      CTX
    )
    expect(errors.lineErrors?.[0]?.variantId).toBe("Select a variant.")
  })

  it("rejects a variant that belongs to a DIFFERENT product", () => {
    // The join bug: a leftover variant id from a previous product selection
    // exists in the catalog, so an "exists?" check would wave it through and the
    // order would carry the other product's price and colour.
    const errors = validateOrderDraft(
      makeDraft({
        lines: [
          { productId: TEE.id, variantId: "trail-boot-brown-42", qty: "1" },
        ],
      }),
      CTX
    )
    expect(errors.lineErrors?.[0]?.variantId).toBe(
      "That variant does not belong to the selected product."
    )
  })

  it("rejects a variant id that exists nowhere", () => {
    const errors = validateOrderDraft(
      makeDraft({
        lines: [{ productId: TEE.id, variantId: "made-up", qty: "1" }],
      }),
      CTX
    )
    expect(errors.lineErrors?.[0]?.variantId).toBe(
      "That variant does not belong to the selected product."
    )
  })

  it("accepts each variant of the product it belongs to", () => {
    for (const variantId of ["cotton-tee-sand-m", "cotton-tee-black-l"]) {
      const errors = validateOrderDraft(
        makeDraft({ lines: [{ productId: TEE.id, variantId, qty: "1" }] }),
        CTX
      )
      expect(errors).toEqual({})
    }
  })
})

describe("validateOrderDraft: duplicate lines", () => {
  it("rejects the same variant twice", () => {
    const errors = validateOrderDraft(
      makeDraft({
        lines: [
          { productId: TEE.id, variantId: "cotton-tee-sand-m", qty: "1" },
          { productId: TEE.id, variantId: "cotton-tee-sand-m", qty: "2" },
        ],
      }),
      CTX
    )
    // Reported on the LATER line; the first occurrence is the legitimate one.
    expect(errors.lineErrors?.[0]).toBeUndefined()
    expect(errors.lineErrors?.[1]?.variantId).toBe(
      "This variant is already on the order."
    )
  })

  it("flags every repeat after the first", () => {
    const errors = validateOrderDraft(
      makeDraft({
        lines: [
          { productId: TEE.id, variantId: "cotton-tee-sand-m", qty: "1" },
          { productId: TEE.id, variantId: "cotton-tee-sand-m", qty: "1" },
          { productId: TEE.id, variantId: "cotton-tee-sand-m", qty: "1" },
        ],
      }),
      CTX
    )
    expect(errors.lineErrors?.[1]?.variantId).toBeDefined()
    expect(errors.lineErrors?.[2]?.variantId).toBeDefined()
  })

  it("allows two different variants of the SAME product", () => {
    // Sand/M and Black/L are two distinct things to pick and pack.
    const errors = validateOrderDraft(
      makeDraft({
        lines: [
          { productId: TEE.id, variantId: "cotton-tee-sand-m", qty: "1" },
          { productId: TEE.id, variantId: "cotton-tee-black-l", qty: "1" },
        ],
      }),
      CTX
    )
    expect(errors).toEqual({})
  })
})

describe("validateOrderDraft: quantity", () => {
  it("accepts a whole number of 1 or more", () => {
    for (const qty of ["1", "2", "40"]) {
      const errors = validateOrderDraft(
        makeDraft({
          lines: [{ productId: TEE.id, variantId: "cotton-tee-sand-m", qty }],
        }),
        CTX
      )
      expect(errors).toEqual({})
    }
  })

  it("rejects zero, negatives, fractions, blanks, and non-numerics", () => {
    for (const qty of ["0", "-1", "1.5", "abc", "", "   ", "1 2", "Infinity"]) {
      const errors = validateOrderDraft(
        makeDraft({
          lines: [{ productId: TEE.id, variantId: "cotton-tee-sand-m", qty }],
        }),
        CTX
      )
      expect(errors.lineErrors?.[0]?.qty, `qty "${qty}"`).toBe(
        "Enter a whole number of 1 or more."
      )
    }
  })
})

describe("validateOrderDraft: shipping method and origin location", () => {
  it("accepts every method in the catalog", () => {
    for (const method of SHIPPING_METHODS) {
      const errors = validateOrderDraft(
        makeDraft({ shippingMethod: method.method }),
        CTX
      )
      expect(errors.shippingMethod).toBeUndefined()
    }
  })

  it("rejects a method that is not in SHIPPING_METHODS", () => {
    for (const shippingMethod of ["", "Teleport"]) {
      expect(
        validateOrderDraft(makeDraft({ shippingMethod }), CTX).shippingMethod
      ).toBe("Choose a shipping method.")
    }
  })

  it("accepts every location in the list", () => {
    for (const location of STOCK_LOCATIONS) {
      expect(
        validateOrderDraft(makeDraft({ locationId: location.id }), CTX)
          .locationId
      ).toBeUndefined()
    }
  })

  it("accepts a location the store has but the seed does not", () => {
    // Locations are a CRUD collection: Settings can add one. Resolving against
    // the STOCK_LOCATIONS constant instead of the context would make the picker
    // offer this location and the validator then reject it - a form the operator
    // cannot submit, on a choice the app itself offered.
    const errors = validateOrderDraft(
      makeDraft({ locationId: OPERATOR_MADE.id }),
      { ...CTX, locations: [...STOCK_LOCATIONS, OPERATOR_MADE] }
    )
    expect(errors.locationId).toBeUndefined()
  })

  it("rejects a locationId that resolves to no location", () => {
    for (const locationId of ["", "loc_nowhere"]) {
      expect(
        validateOrderDraft(makeDraft({ locationId }), CTX).locationId
      ).toBe("Choose a location.")
    }
  })

  it("rejects an ADDRESS where a location id belongs", () => {
    // The field changed kind, not just name: an origin is a reference now. A
    // location's own address is the most plausible wrong value a caller could
    // pass (it is what this field used to hold), so it is the one pinned here.
    for (const location of STOCK_LOCATIONS) {
      expect(
        validateOrderDraft(makeDraft({ locationId: location.address }), CTX)
          .locationId
      ).toBe("Choose a location.")
    }
  })
})

describe("validateOrderDraft: multiple failures", () => {
  it("reports every broken field and line at once, not just the first", () => {
    const errors = validateOrderDraft(
      makeDraft({
        customerId: "",
        lines: [
          { productId: TEE.id, variantId: "trail-boot-brown-42", qty: "0" },
          { productId: "", variantId: "", qty: "1" },
        ],
        shippingMethod: "Teleport",
        locationId: "loc_nowhere",
      }),
      CTX
    )
    expect(Object.keys(errors).sort()).toEqual([
      "customerId",
      "lineErrors",
      "locationId",
      "shippingMethod",
    ])
    expect(errors.lineErrors?.[0]?.variantId).toBeDefined()
    expect(errors.lineErrors?.[0]?.qty).toBeDefined()
    expect(errors.lineErrors?.[1]?.productId).toBeDefined()
  })
})

describe("hasOrderErrors", () => {
  it("is false only for a completely clean map", () => {
    expect(hasOrderErrors({})).toBe(false)
    expect(hasOrderErrors({ customerId: "Select a customer." })).toBe(true)
    expect(hasOrderErrors({ lineErrors: { 0: { qty: "bad" } } })).toBe(true)
  })
})

// ── toOrderPayload ──

describe("toOrderPayload: identity", () => {
  it("omits id and number, which the repository mints", () => {
    const payload = toOrderPayload(makeDraft(), CTX, NOW)
    expect(payload).not.toHaveProperty("id")
    expect(payload).not.toHaveProperty("number")
  })

  it("stamps the given date", () => {
    expect(toOrderPayload(makeDraft(), CTX, NOW).date).toBe(
      "2026-03-04T09:30:00.000Z"
    )
  })

  it("defaults the date to now", () => {
    const before = Date.now()
    const payload = toOrderPayload(makeDraft(), CTX)
    const stamped = new Date(payload.date).getTime()
    expect(stamped).toBeGreaterThanOrEqual(before)
    expect(stamped).toBeLessThanOrEqual(Date.now())
  })
})

describe("toOrderPayload: customer", () => {
  it("embeds the resolved customer, with handle as the join key", () => {
    const payload = toOrderPayload(makeDraft(), CTX, NOW)
    expect(payload.customer).toEqual({
      name: ADA.name,
      email: ADA.email,
      handle: ADA.id,
    })
    // order.customer.handle === customer.id is the documented join (types.ts).
    expect(payload.customer.handle).toBe(ADA.id)
  })
})

describe("toOrderPayload: lines", () => {
  it("derives each line from the product and the VARIANT", () => {
    const payload = toOrderPayload(
      makeDraft({
        lines: [
          { productId: TEE.id, variantId: "cotton-tee-black-l", qty: "3" },
        ],
      }),
      CTX,
      NOW
    )
    const [line] = payload.lines
    const variant = TEE.variants[1]
    expect(line.productId).toBe(TEE.id)
    expect(line.name).toBe(TEE.title)
    // sku is the VARIANT's SKU (not its id, not the product id) - that is what
    // joins a line to the stock row it must move (inv_<sku>). This fixture is
    // the reason it matters: its variant id and sku differ, exactly as a variant
    // created through the editor does (`variant-new-N` for the id, the sku from
    // the form). Keying the line to the id only ever worked for seeded products,
    // where the two are minted from one expression.
    expect(line.sku).toBe(variant.sku)
    expect(line.unitPrice).toBe(variant.price)
    expect(line.color).toBe(variant.options.Color)
    expect(line.qty).toBe(3)
    // The COLOUR's photo, not the product's. This fixture separates the two, so
    // a line that fell back to the thumbnail would show the sand tee on a black
    // one and this would catch it.
    expect(line.image).toBe(variant.image)
  })

  it("takes the weight from the product's category", () => {
    const payload = toOrderPayload(
      makeDraft({
        lines: [
          { productId: TEE.id, variantId: "cotton-tee-sand-m", qty: "1" },
          { productId: BOOT.id, variantId: "trail-boot-brown-42", qty: "1" },
        ],
      }),
      CTX,
      NOW
    )
    expect(payload.lines[0].weight).toBe(0.4) // Apparel
    expect(payload.lines[1].weight).toBe(0.9) // Footwear
  })

  it("parses qty to a number", () => {
    const payload = toOrderPayload(makeDraft({}), CTX, NOW)
    expect(payload.lines[0].qty).toBe(2)
    expect(typeof payload.lines[0].qty).toBe("number")
  })

  it("gives every line a unique id", () => {
    const payload = toOrderPayload(
      makeDraft({
        lines: [
          { productId: TEE.id, variantId: "cotton-tee-sand-m", qty: "1" },
          { productId: TEE.id, variantId: "cotton-tee-black-l", qty: "1" },
          { productId: BOOT.id, variantId: "trail-boot-brown-42", qty: "1" },
        ],
      }),
      CTX,
      NOW
    )
    const ids = payload.lines.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id.length > 0)).toBe(true)
  })

  it("keeps the lines in the draft's order", () => {
    const payload = toOrderPayload(
      makeDraft({
        lines: [
          { productId: BOOT.id, variantId: "trail-boot-brown-42", qty: "1" },
          { productId: TEE.id, variantId: "cotton-tee-sand-m", qty: "1" },
        ],
      }),
      CTX,
      NOW
    )
    expect(payload.lines.map((l) => l.productId)).toEqual([BOOT.id, TEE.id])
  })
})

describe("toOrderPayload: totals", () => {
  it("derives totals via orderTotals, not by hand", () => {
    const draft = makeDraft({
      lines: [
        { productId: TEE.id, variantId: "cotton-tee-sand-m", qty: "2" },
        { productId: BOOT.id, variantId: "trail-boot-brown-42", qty: "1" },
      ],
    })
    const payload = toOrderPayload(draft, CTX, NOW)
    const method = SHIPPING_METHODS.find(
      (m) => m.method === draft.shippingMethod
    )!
    // Recomputed from the same rule rather than hardcoded, so a change to the
    // tax rate or the shipping table cannot drift this expectation.
    expect(payload.totals).toEqual(orderTotals(payload.lines, method.shipping))
  })

  it("charges the chosen method's shipping cost", () => {
    for (const method of SHIPPING_METHODS) {
      const payload = toOrderPayload(
        makeDraft({ shippingMethod: method.method }),
        CTX,
        NOW
      )
      expect(payload.totals.shipping).toBe(method.shipping)
    }
  })
})

describe("toOrderPayload: shipping", () => {
  it("takes priority and method from the resolved SHIPPING_METHOD", () => {
    for (const method of SHIPPING_METHODS) {
      const payload = toOrderPayload(
        makeDraft({ shippingMethod: method.method }),
        CTX,
        NOW
      )
      expect(payload.shipping.method).toBe(method.method)
      expect(payload.shipping.priority).toBe(method.priority)
    }
  })

  it("references the chosen location and snapshots ITS address as `from`", () => {
    // The heart of the change: the draft supplies an id, and the payload's `from`
    // is the address that id resolves to. A caller cannot state an origin address
    // at all, so an order can no longer claim to ship from a place that does not
    // exist (orders used to draw `from` from a warehouse list parallel to this
    // one, and one of its addresses matched no location).
    for (const location of STOCK_LOCATIONS) {
      const payload = toOrderPayload(
        makeDraft({ locationId: location.id }),
        CTX,
        NOW
      )
      expect(payload.shipping.locationId).toBe(location.id)
      expect(payload.shipping.from).toBe(location.address)
    }
  })

  it("snapshots the address the location has NOW, not the seed's", () => {
    // The other half of resolving through the context. `from` is a snapshot, so
    // it must be taken from the store's current record: re-address a location in
    // Settings and the next order ships from the new address. Reading the seed
    // here would write an address the location no longer has - a snapshot of a
    // moment that never happened.
    const moved = { ...STOCK_LOCATIONS[0], address: "9 New Quay, Rotterdam" }
    const payload = toOrderPayload(
      makeDraft({ locationId: moved.id }),
      { ...CTX, locations: [moved, ...STOCK_LOCATIONS.slice(1)] },
      NOW
    )
    expect(payload.shipping.from).toBe("9 New Quay, Rotterdam")
    expect(payload.shipping.from).not.toBe(STOCK_LOCATIONS[0].address)
  })

  it("ships to the customer's own address, via destinationFor", () => {
    const payload = toOrderPayload(makeDraft(), CTX, NOW)
    const expected = destinationFor(ADA)
    expect(payload.shipping.to).toBe(expected.to)
    expect(payload.shipping.destinationLabel).toBe(expected.destinationLabel)
    expect(payload.shipping.destinationLines).toEqual(expected.destinationLines)
  })

  it("uses a carrier from the catalog", () => {
    expect(CARRIERS as readonly string[]).toContain(
      toOrderPayload(makeDraft(), CTX, NOW).shipping.carrier
    )
  })
})

describe("toOrderPayload: a just-placed order", () => {
  it("is pending / pending / unfulfilled", () => {
    const payload = toOrderPayload(makeDraft(), CTX, NOW)
    expect(payload.status).toBe("pending")
    expect(payload.payment).toBe("pending")
    expect(payload.fulfillment).toBe("unfulfilled")
  })

  it("stores no stepper, leaving it to derive from the axes above", () => {
    // This case used to assert the stepper the payload carried. The payload no
    // longer carries one: the stepper derives from status + fulfillment at
    // render, so a new order cannot be born with a stepper that disagrees with
    // them. What Picking-with-nothing-done actually looks like is deriveSteps's
    // own question, and it is asked in lib/data/commerce.test.ts.
    const { shipping } = toOrderPayload(makeDraft(), CTX, NOW)
    expect("steps" in shipping).toBe(false)
  })
})

describe("toOrderPayload: invalid input", () => {
  // The contract is "validate first"; a miss is a programming error and must be
  // loud rather than an order with a blank sku or a zero price.
  it("throws on an unknown customer", () => {
    expect(() =>
      toOrderPayload(makeDraft({ customerId: "ghost" }), CTX, NOW)
    ).toThrow(/No customer "ghost"/)
  })

  it("throws on an unknown product", () => {
    expect(() =>
      toOrderPayload(
        makeDraft({
          lines: [{ productId: "ghost", variantId: "x", qty: "1" }],
        }),
        CTX,
        NOW
      )
    ).toThrow(/No product "ghost"/)
  })

  it("throws when the variant belongs to another product", () => {
    expect(() =>
      toOrderPayload(
        makeDraft({
          lines: [
            { productId: TEE.id, variantId: "trail-boot-brown-42", qty: "1" },
          ],
        }),
        CTX,
        NOW
      )
    ).toThrow(/does not belong to product/)
  })

  it("throws on an unknown shipping method or location", () => {
    expect(() =>
      toOrderPayload(makeDraft({ shippingMethod: "Teleport" }), CTX, NOW)
    ).toThrow(/No shipping method "Teleport"/)
    expect(() =>
      toOrderPayload(makeDraft({ locationId: "loc_nowhere" }), CTX, NOW)
    ).toThrow(/No location "loc_nowhere"/)
  })

  it("throws rather than pass an address off as a location id", () => {
    // An address is exactly what this field used to carry, so a caller porting
    // old code would hand one over. It must be loud, not silently accepted as an
    // origin that resolves to nothing.
    expect(() =>
      toOrderPayload(
        makeDraft({ locationId: STOCK_LOCATIONS[0].address }),
        CTX,
        NOW
      )
    ).toThrow(/No location/)
  })

  it("throws for a customer with no address", () => {
    const nomad: Customer = { ...ADA, id: "nomad", location: undefined }
    expect(() =>
      toOrderPayload(makeDraft({ customerId: "nomad" }), {
        ...CTX,
        customers: [nomad],
      })
    ).toThrow(/no location/)
  })
})
