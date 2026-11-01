import { describe, it, expect } from "vitest"

import { CITY_BY_NAME, ORDER_MAX_AGE_DAYS } from "./commerce"
import { CUSTOMERS } from "./customers"
import { INVENTORY_ITEMS, sumLevels } from "./inventory"
import { STOCK_LOCATIONS } from "./locations"
import { SUPPLIERS } from "./suppliers"
import { ORDERS } from "./orders"
import { PRODUCTS } from "./products"
import type { Product } from "./products"

// Relational guards for the demo seed. Orders and inventory both join to the
// product catalog by id; nothing else in the app re-checks that, so if these
// joins rot the dashboard silently reads empty or "Unknown" instead of failing.
//
// The regression this file exists for: orders.ts used to carry its OWN copy of
// the catalog. Line names still matched product titles, so it looked fine, but
// the skus were generated independently and resolved to a real variant only 2%
// of the time - and there was no productId at all, so revenue could not be
// grouped by category. Assert the join, not the labels.

const productById = new Map<string, Product>(PRODUCTS.map((p) => [p.id, p]))

/** Mirrors the round2 the seed uses, so float noise is not a false failure. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

describe("ORDERS seed: product join", () => {
  it("resolves every order line to a real product", () => {
    for (const order of ORDERS) {
      for (const line of order.lines) {
        expect(
          productById.has(line.productId),
          `${order.id} line "${line.name}" has productId "${line.productId}"`
        ).toBe(true)
      }
    }
  })

  it("resolves every line sku to a variant of THAT product", () => {
    for (const order of ORDERS) {
      for (const line of order.lines) {
        const product = productById.get(line.productId)
        expect(product, `${order.id} references unknown product`).toBeDefined()
        const variantIds = product!.variants.map((v) => v.id)
        expect(
          variantIds,
          `${order.id} line sku "${line.sku}" is not a variant of ${line.productId}`
        ).toContain(line.sku)
      }
    }
  })

  it("keeps the line name in sync with the resolved product title", () => {
    // a drifting name is how the duplicated catalog hid: the labels agreed while
    // the ids did not.
    for (const order of ORDERS) {
      for (const line of order.lines) {
        const product = productById.get(line.productId)!
        expect(line.name, `${order.id} line "${line.id}"`).toBe(product.title)
      }
    }
  })

  it("prices every line from the variant it resolves to", () => {
    for (const order of ORDERS) {
      for (const line of order.lines) {
        const product = productById.get(line.productId)!
        const variant = product.variants.find((v) => v.id === line.sku)!
        expect(line.unitPrice, `${order.id} line "${line.sku}"`).toBe(
          variant.price
        )
      }
    }
  })

  it("carries the resolved variant's colour on every line", () => {
    // orders.ts reads variant.options.Color directly, which the Record<string,
    // string> type cannot prove is present. This is that guard.
    for (const order of ORDERS) {
      for (const line of order.lines) {
        const product = productById.get(line.productId)!
        const variant = product.variants.find((v) => v.id === line.sku)!
        expect(line.color, `${order.id} line "${line.sku}" colour`).toBeTruthy()
        expect(line.color).toBe(variant.options.Color)
      }
    }
  })

  it("gives every line a unique id", () => {
    const ids = ORDERS.flatMap((o) => o.lines.map((l) => l.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("never repeats a product within one order", () => {
    for (const order of ORDERS) {
      const productIds = order.lines.map((l) => l.productId)
      expect(new Set(productIds).size, `${order.id} repeats a product`).toBe(
        productIds.length
      )
    }
  })
})

describe("ORDERS seed: totals", () => {
  it("derives subtotal from the line prices", () => {
    for (const order of ORDERS) {
      const expected = round2(
        order.lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0)
      )
      expect(order.totals.subtotal, `${order.id} subtotal`).toBeCloseTo(
        expected,
        2
      )
    }
  })

  it("derives total from subtotal + shipping + tax", () => {
    for (const order of ORDERS) {
      const { subtotal, shipping, tax, total } = order.totals
      expect(total, `${order.id} total`).toBeCloseTo(
        round2(subtotal + shipping + tax),
        2
      )
    }
  })
})

describe("ORDERS seed: rolling date anchor", () => {
  // The anchor is computed at seed time so the demo never rots. Assert the
  // property (recent, not future), never an absolute date.
  const times = ORDERS.map((o) => new Date(o.date).getTime())

  it("parses every order date", () => {
    for (const order of ORDERS) {
      expect(Number.isNaN(new Date(order.date).getTime()), order.id).toBe(false)
    }
  })

  it("lands at least one order in the current month", () => {
    const now = new Date()
    const inMonth = ORDERS.filter((o) => {
      const d = new Date(o.date)
      return (
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      )
    })
    expect(
      inMonth.length,
      "no order in the current month - the anchor stopped rolling"
    ).toBeGreaterThan(0)
  })

  it("never dates an order in the future", () => {
    const newest = Math.max(...times)
    expect(newest).toBeLessThanOrEqual(Date.now())
  })

  it("spreads the orders back over roughly the last two months", () => {
    const spanDays = (Math.max(...times) - Math.min(...times)) / 86_400_000
    expect(spanDays).toBeGreaterThan(20)
    expect(spanDays).toBeLessThan(75)
  })
})

describe("ORDERS seed: customer join", () => {
  // The regression this block exists for: customers.ts used to BUILD its roster
  // by aggregating order.customer off ORDERS, so the join could not fail - a
  // customer existed precisely because an order had invented them. That also
  // meant an order placed for a new customer could never reach /customers, and
  // it fixed the arrow backwards: signup date was derived from the first order.
  // Orders now draw from the roster, so the join is real and can rot. Assert it.
  const customerById = new Map(CUSTOMERS.map((c) => [c.id, c]))

  it("resolves every order's customer handle to a real customer", () => {
    for (const order of ORDERS) {
      expect(
        customerById.has(order.customer.handle),
        `${order.id} has customer.handle "${order.customer.handle}"`
      ).toBe(true)
    }
  })

  it("keeps the embedded name and email in sync with the resolved customer", () => {
    // the embedded copy is a denormalised convenience; drift here is how a
    // renamed customer keeps their old name on every past order.
    for (const order of ORDERS) {
      const customer = customerById.get(order.customer.handle)!
      expect(order.customer.name, `${order.id} customer name`).toBe(
        customer.name
      )
      expect(order.customer.email, `${order.id} customer email`).toBe(
        customer.email
      )
    }
  })

  it("never dates an order before its customer signed up", () => {
    // The invariant the inversion put at risk. It used to hold for free (the
    // signup date was BACK-DATED from the first order); now customers are seeded
    // with no knowledge of orders, so it holds only because the signup window
    // starts beyond the oldest date an order can reach. See commerce.ts.
    for (const order of ORDERS) {
      const customer = customerById.get(order.customer.handle)!
      expect(
        new Date(order.date).getTime(),
        `${order.id} (${order.date}) predates ${customer.id} signup (${customer.createdAt})`
      ).toBeGreaterThanOrEqual(new Date(customer.createdAt).getTime())
    }
  })

  it("keeps every order inside the age ceiling the signup floor is built on", () => {
    // The other half of the invariant above: the generator must stay inside
    // ORDER_MAX_AGE_DAYS, or the signup floor stops being a guarantee and the
    // test above starts passing or failing on the luck of the PRNG.
    for (const order of ORDERS) {
      const ageDays = (Date.now() - new Date(order.date).getTime()) / 86_400_000
      expect(ageDays, `${order.id} age in days`).toBeLessThanOrEqual(
        ORDER_MAX_AGE_DAYS
      )
    }
  })

  it("ships every order to the city its customer lives in", () => {
    // the destination used to be a random pick from a local city list, unrelated
    // to the customer it was shipping to.
    //
    // Assert the address RESOLVES to the customer's city, rather than looking for
    // the city name inside the formatted string: a postal line is written the way
    // the destination country writes it ("1051 København K" for Copenhagen), so a
    // substring check would be testing spelling, not the join.
    for (const order of ORDERS) {
      const customer = customerById.get(order.customer.handle)!
      expect(customer.location, `${customer.id} has no location`).toBeDefined()
      const home = CITY_BY_NAME.get(customer.location!.city)
      expect(
        home,
        `${customer.id} lives in "${customer.location!.city}", which has no address template`
      ).toBeDefined()
      expect(
        order.shipping.to,
        `${order.id} ships to "${order.shipping.to}" but ${customer.id} lives in ${customer.location!.city}`
      ).toBe(`${home!.line}, ${home!.postal}`)
      expect(
        order.shipping.destinationLines,
        `${order.id} destination`
      ).toEqual([home!.line, `${home!.postal}, ${home!.countryCode}`])
    }
  })

  it("holds both cohorts: customers with orders and customers without", () => {
    // a roster where everyone has ordered never exercises the empty-orders
    // state; one where nobody has means the join above proves nothing.
    const handles = new Set(ORDERS.map((o) => o.customer.handle))
    const withOrders = CUSTOMERS.filter((c) => handles.has(c.id))
    const without = CUSTOMERS.filter((c) => !handles.has(c.id))
    expect(withOrders.length, "no customer has an order").toBeGreaterThan(0)
    expect(without.length, "every customer has an order").toBeGreaterThan(0)
  })

  it("gives every customer a unique id", () => {
    // the id is the orders join key and the /customers route param; a duplicate
    // would silently merge two people's order history.
    const ids = CUSTOMERS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe("ORDERS <-> INVENTORY_ITEMS: the fulfilment join", () => {
  // Fulfilling an order has to find the stock row the line came from. That join
  // is `line.sku -> item.sku`, and NOTHING in the codebase states it: the two
  // sides are built by different modules from different fields.
  //
  //   buildOrderLine  (commerce.ts)  writes  sku: variant.id
  //   buildInventoryItem (inventory.ts) writes sku: variant.sku
  //
  // It resolves today only because products.ts mints a variant's `id` and `sku`
  // from the same expression, on adjacent lines. That is a coincidence, not a
  // contract. The two describes on either side of this one each check ONE half
  // against its OWN key - line skus against variant ids, row skus against
  // variant skus - so both stay green if the two fields ever diverge, while
  // every order silently stops resolving to its stock.
  //
  // These pin the coincidence, so the day someone gives variants a real id
  // (`var_*`, or a backend-supplied one), this fails instead of fulfilment.

  const itemBySku = new Map(INVENTORY_ITEMS.map((item) => [item.sku, item]))

  it("resolves every order line to the stock row it must move", () => {
    for (const order of ORDERS) {
      for (const line of order.lines) {
        expect(
          itemBySku.has(line.sku),
          `${order.id} line sku "${line.sku}" resolves to no stock row: fulfilling it could not move stock`
        ).toBe(true)
      }
    }
  })

  it("lands each line on a stock row for the product the line claims", () => {
    // Resolving is not enough: it has to resolve to the RIGHT row. A sku that
    // hits some other product's row would decrement a stranger's stock.
    for (const order of ORDERS) {
      for (const line of order.lines) {
        const item = itemBySku.get(line.sku)
        if (!item) continue // covered by the case above
        expect(
          item.productId,
          `${order.id} line "${line.sku}" resolves to a row for ${item.productId}, not ${line.productId}`
        ).toBe(line.productId)
      }
    }
  })

  it("gives every variant in the catalog a distinct sku", () => {
    // Not that id and sku MATCH - they no longer have to. When this file was
    // written, buildOrderLine keyed a line to `variant.id` while the ledger keyed
    // rows to `variant.sku`, so the join survived only because the seed minted
    // both from one expression. It did not survive the variants editor, which
    // mints `variant-new-N` for the id and takes the sku from the form: an order
    // for an admin-created product carried a sku matching no stock row. The line
    // carries `variant.sku` now, so the two fields are free to differ.
    //
    // What still has to hold is this: the sku identifies ONE variant, because it
    // is what an order line and a stock row both key on.
    const skus = PRODUCTS.flatMap((p) => p.variants.map((v) => v.sku))
    expect(new Set(skus).size, "two variants share a sku").toBe(skus.length)
  })
})

describe("PRODUCTS seed: colourway imagery", () => {
  /** A variant's colour, or "" for a variant that has no colour axis. */
  function colorOf(product: Product, sku: string): string {
    return product.variants.find((v) => v.sku === sku)?.options.Color ?? ""
  }

  it("gives every variant a non-empty image", () => {
    // The fallback is the generator's job, so no consumer needs one. A variant
    // with no image is a broken src on the stock grid, not a blank cell.
    for (const product of PRODUCTS) {
      for (const variant of product.variants) {
        expect(
          variant.image,
          `${product.id} / ${variant.sku} has no image`
        ).not.toBe("")
      }
    }
  })

  it("shares one photo across the sizes of a colourway", () => {
    // A store shoots the colour, not each size of it. Sizes that disagreed would
    // mean the photo had been keyed to the sku somewhere.
    for (const product of PRODUCTS) {
      const byColor = new Map<string, Set<string>>()
      for (const variant of product.variants) {
        const color = colorOf(product, variant.sku)
        const images = byColor.get(color) ?? new Set<string>()
        images.add(variant.image)
        byColor.set(color, images)
      }
      for (const [color, images] of byColor) {
        expect(
          images.size,
          `${product.id} / ${color} has ${images.size} photos`
        ).toBe(1)
      }
    }
  })

  it("does not put one photo on every colour of a product", () => {
    // The defect this replaced: the navy, the oat and the rust all rendered the
    // product shot. A product whose colours are ALL unsourced would legitimately
    // land back here - source a photo for one of them rather than deleting this.
    for (const product of PRODUCTS) {
      const colors = new Set(
        product.variants.map((v) => colorOf(product, v.sku))
      )
      if (colors.size < 2) continue
      const images = new Set(product.variants.map((v) => v.image))
      expect(
        images.size,
        `${product.id} shows one photo for ${colors.size} colours`
      ).toBeGreaterThan(1)
    }
  })

  it("opens the gallery on the thumbnail and lists each photo once", () => {
    // The editor hydrates its gallery from `images` and saves images[0] back as
    // the thumbnail, so a gallery that led with a colourway would repoint the
    // catalog grid at that colour on the first save.
    for (const product of PRODUCTS) {
      expect(product.images[0], `${product.id} gallery`).toBe(product.thumbnail)
      expect(
        new Set(product.images).size,
        `${product.id} gallery repeats a photo`
      ).toBe(product.images.length)
      for (const variant of product.variants) {
        expect(
          product.images,
          `${product.id} gallery misses ${variant.sku}`
        ).toContain(variant.image)
      }
    }
  })
})

describe("INVENTORY_ITEMS seed: product join", () => {
  it("resolves every stock row to a real product", () => {
    for (const item of INVENTORY_ITEMS) {
      expect(
        productById.has(item.productId),
        `${item.id} ("${item.name}") has productId "${item.productId}"`
      ).toBe(true)
    }
  })

  it("keeps the stock row name and category in sync with the product", () => {
    for (const item of INVENTORY_ITEMS) {
      const product = productById.get(item.productId)!
      expect(item.name, `${item.id} name`).toBe(product.title)
      expect(item.category, `${item.id} category`).toBe(product.category)
    }
  })

  it("resolves every stock row's sku to a variant of ITS OWN product", () => {
    // The join the whole ledger exists for. A sku that belongs to some other
    // product's variant still resolves against a flat sku list, so check it
    // against the variants of the productId the row itself claims.
    for (const item of INVENTORY_ITEMS) {
      const product = productById.get(item.productId)
      expect(product, `${item.id} references unknown product`).toBeDefined()
      const skus = product!.variants.map((v) => v.sku)
      expect(
        skus,
        `${item.id} has sku "${item.sku}", which is not a variant of ${item.productId}`
      ).toContain(item.sku)
    }
  })

  it("tracks every variant of every product exactly once", () => {
    // Stock is held per VARIANT, not per product: a size that sells out has to
    // be able to run out on its own. So a product legitimately owns as many
    // rows as it has variants, and the old "at most one row per product" guard
    // was the previous grain written down - do not restore it.
    //
    // Stated as an exact set match in both directions because neither half is
    // implied by the other: a row per variant with one variant missed is a
    // silent hole in the catalog, and a variant tracked twice double-counts its
    // stock while each row reads correctly on its own.
    const tracked = INVENTORY_ITEMS.map(
      (item) => `${item.productId}::${item.sku}`
    )
    const expected = PRODUCTS.flatMap((product) =>
      product.variants.map((variant) => `${product.id}::${variant.sku}`)
    )
    expect([...tracked].sort()).toEqual([...expected].sort())
  })

  it("gives every stock row a unique id", () => {
    // id is the store's primary key: a duplicate is not a second row, it is a
    // write that would collide with the first one's levels on seed.
    const ids = INVENTORY_ITEMS.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("shows each stock row its own variant's photo", () => {
    // A row is one sku. It used to carry product.thumbnail, so every size and
    // every colour of a product rendered the same picture down the grid.
    for (const item of INVENTORY_ITEMS) {
      const product = productById.get(item.productId)!
      const variant = product.variants.find((v) => v.sku === item.sku)!
      expect(item.thumbnail, `${item.id} thumbnail`).toBe(variant.image)
    }
  })

  it("gives every stock row a unique sku", () => {
    // the sku is the row identity the grid renders and the key order lines join
    // on; two rows sharing one would split a variant's stock across both.
    const skus = INVENTORY_ITEMS.map((item) => item.sku)
    expect(new Set(skus).size).toBe(skus.length)
  })
})

describe("INVENTORY seed: supplier join", () => {
  const supplierIds = new Set(SUPPLIERS.map((supplier) => supplier.id))

  it("resolves every supplierId to a real supplier", () => {
    for (const item of INVENTORY_ITEMS) {
      expect(
        supplierIds.has(item.supplierId),
        `${item.sku} is supplied by "${item.supplierId}"`
      ).toBe(true)
    }
  })

  it("keeps suppliers distinct from product brands", () => {
    // The two used to share one name pool, which is what made a brand and a
    // distributor look like one field badly synced. A supplier named after a
    // brand would quietly bring that back.
    const vendors = new Set(PRODUCTS.map((product) => product.vendor))
    for (const supplier of SUPPLIERS) {
      expect(
        vendors.has(supplier.name),
        `supplier "${supplier.name}" is also a product vendor`
      ).toBe(false)
    }
  })
})

describe("INVENTORY seed: location join", () => {
  const locationIds = new Set(STOCK_LOCATIONS.map((location) => location.id))

  it("stocks every active location", () => {
    // The other direction of the join, and the one nothing else looks at: a
    // dangling locationId fails loudly below, but a location the seed simply
    // never reaches is silent - a seed stocking two of three locations reads
    // exactly like one stocking three of four. That is the shape a hand-kept
    // list of ids beside this one used to have, so the ledger is asserted to
    // cover what locations.ts actually owns.
    const stocked = new Set(
      INVENTORY_ITEMS.flatMap((item) => item.levels.map((l) => l.locationId))
    )
    for (const location of STOCK_LOCATIONS.filter((l) => l.isActive)) {
      expect(
        stocked.has(location.id),
        `no stock anywhere at "${location.id}" (${location.name})`
      ).toBe(true)
    }
  })

  it("resolves every level's locationId to a real location", () => {
    for (const item of INVENTORY_ITEMS) {
      for (const level of item.levels) {
        expect(
          locationIds.has(level.locationId),
          `${item.sku} has a level at locationId "${level.locationId}"`
        ).toBe(true)
      }
    }
  })

  it("never gives an item two levels at the same location", () => {
    // one level per item per location is the model, but it lives in an array:
    // nothing in the type stops a second entry, and a duplicate would double the
    // summed totals while each half looked correct.
    for (const item of INVENTORY_ITEMS) {
      const ids = item.levels.map((level) => level.locationId)
      expect(new Set(ids).size, `${item.sku} repeats a location`).toBe(
        ids.length
      )
    }
  })

  it("places every item at a location", () => {
    // a levelless item has no bin and no totals to sum, so the grid would show a
    // row that sits nowhere.
    for (const item of INVENTORY_ITEMS) {
      expect(item.levels.length, `${item.sku} holds no levels`).toBeGreaterThan(
        0
      )
    }
  })

  it("resolves every lot's locationId to a real location", () => {
    for (const item of INVENTORY_ITEMS) {
      for (const lot of item.lots) {
        expect(
          locationIds.has(lot.locationId),
          `${item.sku} lot "${lot.lot}" has locationId "${lot.locationId}"`
        ).toBe(true)
      }
    }
  })

  it("backs each level's onHand with the lots at THAT location", () => {
    // levels carry the quantity, lots carry the provenance of the same units, so
    // they have to agree location by location. Totalled across the item this
    // could balance while a lot sat at the wrong warehouse, which is exactly the
    // drift that makes a transfer read as a phantom.
    for (const item of INVENTORY_ITEMS) {
      for (const level of item.levels) {
        const lotQty = item.lots
          .filter((lot) => lot.locationId === level.locationId)
          .reduce((sum, lot) => sum + lot.qty, 0)
        expect(lotQty, `${item.sku} lots at ${level.locationId}`).toBe(
          level.onHand
        )
      }
    }
  })

  it("accounts for every lot in the summed levels", () => {
    // the per-location check above cannot see a lot parked at a location the item
    // holds no level at; the totals only match if none exists.
    for (const item of INVENTORY_ITEMS) {
      const lotQty = item.lots.reduce((sum, lot) => sum + lot.qty, 0)
      expect(lotQty, `${item.sku} total lot qty`).toBe(
        sumLevels(item.levels, (level) => level.onHand)
      )
    }
  })
})

describe("ORDERS seed: location join", () => {
  const locationById = new Map(
    STOCK_LOCATIONS.map((location) => [location.id, location])
  )
  const locationAddresses = new Set(
    STOCK_LOCATIONS.map((location) => location.address)
  )

  // The regression this block exists for: an order's origin used to be a bare
  // address string drawn from a WAREHOUSES list in commerce.ts, parallel to the
  // real location list. The two drifted - every order that drew the third entry
  // shipped from "88 Distribution Dr, Rotterdam 3011", an address no location
  // had - so an order's origin could not be joined to the stock meant to fulfil
  // it. The origin is a locationId now; these assert the join, not the spelling.

  it("resolves every order's shipping.locationId to a real location", () => {
    for (const order of ORDERS) {
      expect(
        locationById.has(order.shipping.locationId),
        `${order.id} ships from locationId "${order.shipping.locationId}"`
      ).toBe(true)
    }
  })

  it("keeps shipping.from equal to the resolved location's address", () => {
    // `from` is a snapshot of the reference, so it cannot say something the
    // location does not. If these can disagree, the duplication is back.
    for (const order of ORDERS) {
      const location = locationById.get(order.shipping.locationId)
      expect(order.shipping.from, `${order.id} shipping.from`).toBe(
        location?.address
      )
    }
  })

  it("never ships from an address that belongs to no location", () => {
    // Stated as the invariant rather than as a check for one bad string: any
    // future origin that exists nowhere in the location list fails here, whether
    // or not it happens to be spelled "Rotterdam".
    for (const order of ORDERS) {
      expect(
        locationAddresses.has(order.shipping.from),
        `${order.id} ships from "${order.shipping.from}", which is no location's address`
      ).toBe(true)
    }
  })
})
