import { SEED_NOW } from "./commerce"
import {
  STOCK_LOCATIONS,
  locationName,
  type StockLocationKind,
} from "./locations"
import { PRODUCTS, productPriceRange } from "./products"
import { mulberry32, pick } from "./seed-utils"
import { SUPPLIERS } from "./suppliers"
import type { Product, ProductVariant } from "./products"
import type { Supplier } from "./suppliers"

// Deterministic mock stock ledger. Every choice is generated from a fixed seed
// rather than Math.random, so the dataset is identical across reloads,
// SSR/client and test runs. The only moving part is the date anchor, which rolls
// - see SEED_NOW in commerce.ts.
//
// One row per catalog VARIANT, drawn from the REAL catalog (PRODUCTS). Stock is
// held per variant because a size sells out on its own, and an earlier version
// kept a hand-written row per PRODUCT under an invented sku namespace: it
// covered half the catalog, and no order line could join the stock meant to fill
// it. products.ts must never import this module, or the two would cycle.
//
// The grid, header, and detail sheet read this ONLY through the demo store
// via TanStack Query; production data never touches it. `inventoryRepository`
// is the seam. See docs/DATA-LAYER.md.

// ── Types ──

export type StockStatus =
  "In stock" | "Low stock" | "Out of stock" | "Backordered" | "Discontinued"

export interface StockLot {
  id: string
  lot: string
  locationId: string
  qty: number
  cost: number
}

export type MovementKind = "Restock" | "Sale" | "Adjustment" | "Transfer"

export interface StockMovement {
  id: string
  kind: MovementKind
  title: string
  detail?: string
  timeLabel: string
  author: { name: string; initials: string; avatar?: string }
  /** Signed on-hand change. Present on ledger adjustments; absent on seed rows. */
  delta?: number
}

/**
 * Stock of one item at one location, and deliberate about which quantities it
 * stores: on-hand is held, everything else is worked out.
 *
 * On-hand is the only number here because it is the only one that is a fact
 * about the SHELF. Allocated is a fact about the ORDERS - it used to be stored
 * alongside, and only the seed ever wrote it: placing an order reserved nothing
 * and fulfilling released nothing, so a seeded reservation could never be undone
 * and permanently double-counted its units out of `available`. It is derived
 * from the open orders now (features/inventory/allocations.ts), which is why
 * fulfilling an order releases its hold without anything having to remember to.
 * Available follows from the two.
 *
 * One level per location per item. `bin` is here rather than on the item because
 * a shelf only means something inside a warehouse.
 */
export interface StockLevel {
  /** StockLocation.id in locations.ts. */
  locationId: string
  bin: string
  /** Physically stocked at this location. */
  onHand: number
}

export interface InventoryItem {
  /** Stable id, also the store's primary key. One row per SKU. */
  id: string
  /**
   * The product this stock row tracks (Product.id in products.ts). Every row
   * resolves; seed-integrity.test.ts is the guard.
   */
  productId: string
  name: string
  sku: string
  thumbnail: string | null
  category: string
  /** The company this stock is bought from (Supplier.id in suppliers.ts). Not
   *  the product's vendor: a brand and its distributor are different firms. */
  supplierId: string
  /**
   * Where the stock sits, one entry per location. The item carries NO scalar
   * onHand/allocated/available: those are sums across levels, derived at read
   * time by buildStockRows, so a per-location write cannot leave a stale total
   * behind. Transfers move quantity between two of these.
   */
  levels: StockLevel[]
  /** SKU-level thresholds, compared against the summed available. */
  reorderPoint: number
  unitCost: number
  /**
   * Stored rather than derived because "Discontinued" is a decision, not a
   * count. Every write recomputes it from the summed levels (deriveStockStatus),
   * which is why it stays in step with them.
   */
  status: StockStatus
  safetyStock: number
  leadTimeDays: number
  dailyVelocity: number
  upc: string
  /** Batch provenance (lot number + cost). Not the quantity source: levels are. */
  lots: StockLot[]
  movements: StockMovement[]
}

/**
 * Available is on-hand minus what open orders hold; incoming stock does not
 * count.
 *
 * The allocation is passed in rather than read off the level, because it is a
 * fact about the orders and the level knows nothing about them. Floors at zero:
 * more units committed than are on the shelf is an oversell, which is real and
 * worth seeing, but it does not make `available` negative.
 */
export function levelAvailable(level: StockLevel, allocated: number): number {
  return Math.max(0, level.onHand - allocated)
}

/** Sum a quantity across every location the item holds stock at. */
export function sumLevels(
  levels: readonly StockLevel[],
  select: (level: StockLevel) => number
): number {
  return levels.reduce((total, level) => total + select(level), 0)
}

/**
 * The location a row reads as "its" location: the one holding the most stock.
 * Ties and empty rows fall back to the first level, so a zero-stock item still
 * names a place. Derived, never stored - a transfer moves it on its own.
 */
export function primaryLevel(levels: readonly StockLevel[]): StockLevel | null {
  if (levels.length === 0) return null
  return levels.reduce((best, level) =>
    level.onHand > best.onHand ? level : best
  )
}

/**
 * The ledger rows a product needs the moment it exists: one per variant, empty.
 *
 * Stock is keyed to the catalog one row per variant, and only the seed ever
 * minted those rows. So a product created through the admin had none - and since
 * stock moves only by adjusting or transferring an EXISTING row, and /inventory
 * offers no way to add one, it was stranded at "Out of stock" permanently. The
 * variants editor's stock cell looked its sku up in the ledger and found
 * nothing, forever. The refactor that keyed stock to the catalog made this
 * strictly worse, because it left the ledger as the only place stock lives.
 *
 * The rows start empty rather than inventing a shelf: a product that was just
 * typed into a form has no stock, and saying it has some would be a lie the
 * reorder queue would then act on. An adjustment is how it gains any, which is
 * the same path a real receipt of goods takes.
 *
 * Deliberately NOT the seed's builder: that one draws a profile, a threshold and
 * a lot spread from a seeded rng to tell a plausible story. None of that is true
 * of a product that did not exist a second ago.
 */
export function ledgerRowsForProduct(product: Product): InventoryItem[] {
  return product.variants.map((variant) => ({
    id: `inv_${variant.sku}`,
    productId: product.id,
    name: product.title,
    sku: variant.sku,
    // The variant's own photo, so a row shows the colour it stocks. A product
    // typed into the form has no per-colour gallery, so its variants carry the
    // product image and this resolves to the same picture on every row - which
    // is correct there, not a regression: one photo is all that product has.
    thumbnail: variant.image || product.thumbnail,
    category: product.category,
    // No supplier yet: the product form does not ask, and picking one would
    // invent a commercial relationship. supplierName() already reads an
    // unresolved id as "Unknown supplier", so the grid says so rather than break.
    supplierId: "",
    // No shelf anywhere. A level exists because stock sits at a location, and
    // none does - counting some in through an adjustment is what creates one.
    levels: [],
    reorderPoint: 0,
    unitCost: 0,
    status: "Out of stock",
    safetyStock: 0,
    leadTimeDays: 0,
    dailyVelocity: 0,
    upc: "",
    lots: [],
    movements: [],
  }))
}

// ── Movement authors (avatars reused from the donor block) ──

const AUTHOR_AJ = {
  name: "Alex Johnson",
  initials: "AJ",
  avatar:
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
}
const AUTHOR_MS = {
  name: "Mira Stone",
  initials: "MS",
  avatar:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
}
const AUTHOR_LG = {
  name: "Leo Grant",
  initials: "LG",
  avatar:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&dpr=2&q=80",
}
const AUTHOR_NV = {
  name: "Nora Vale",
  initials: "NV",
  avatar:
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80",
}

const AUTHORS = [AUTHOR_AJ, AUTHOR_MS, AUTHOR_LG, AUTHOR_NV]

// ── Stock profiles ──

/**
 * The stock story a row tells. Drawn per variant and the counts generated to
 * MATCH it, rather than the reverse: two of the five statuses cannot be
 * recovered from a number. "Backordered" is an open PO against a fully committed
 * shelf, and "Discontinued" is a decision - deriveStockStatus (features/
 * inventory/queries.ts) can only ever return the other three, so a ledger that
 * derived its status from the counts would leave the Backordered badge, its
 * filter option and its header legend segment matching zero rows forever.
 */
type StockProfile = "healthy" | "low" | "out" | "backordered"

const PROFILE_WEIGHTED: StockProfile[] = [
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "low",
  "low",
  "low",
  "out",
  "out",
  "backordered",
]

const STATUS_BY_PROFILE: Record<StockProfile, StockStatus> = {
  healthy: "In stock",
  low: "Low stock",
  out: "Out of stock",
  backordered: "Backordered",
}

/** Fixed seed for the profile deal, so the same rows carry the same status on
 *  every run. */
const PROFILE_SEED = 0x5104_c0de

/** How many locations hold a stocked row. Weighted to keep one location the
 *  norm while leaving a real minority for the Transfer dialog and the grid's
 *  multi-location marker to work on. */
const LEVEL_COUNT_WEIGHTED = [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3]

/**
 * How many lines are being wound down. Drawn as a COUNT over the catalog rather
 * than as a per-product chance: a chance can land on nobody, and a ledger with
 * no discontinued row leaves that badge, its filter option and its header legend
 * segment matching nothing. Per product, not per variant - discontinuing a line
 * takes every size with it.
 */
const DISCONTINUED_COUNT = 2

/** Fixed seed for the wind-down draw, so the same lines close on every run. */
const DISCONTINUED_SEED = 0xd15c_0117

const DISCONTINUED: ReadonlySet<string> = (() => {
  const rng = mulberry32(DISCONTINUED_SEED)
  return new Set(
    PRODUCTS.map((product) => ({ id: product.id, draw: rng() }))
      .sort((a, b) => a.draw - b.draw)
      .slice(0, DISCONTINUED_COUNT)
      .map((entry) => entry.id)
  )
})()

// ── Location and bin coding ──

/**
 * How much of the catalog a place carries, by what KIND of place it is: a
 * warehouse holds the bulk, a store the least.
 *
 * Keyed on `kind` rather than on location ids, because the ids are not this
 * module's to list. A hand-kept list of ids beside the one locations.ts owns is
 * how an order came to ship from a warehouse that existed nowhere in the
 * location list; a new location added there would simply never be stocked here,
 * and would never be caught, since a seed that stocks two of three locations
 * looks exactly like a seed that stocks three of four.
 */
const WEIGHT_BY_KIND: Record<StockLocationKind, number> = {
  warehouse: 3,
  fulfillment: 2,
  store: 1,
}

/**
 * The draw pool, one entry per unit of weight.
 *
 * Only ACTIVE locations: an inactive location keeps the stock already on its
 * shelves but "is not offered for new stock" (see locations.ts), and a seed is
 * nothing but new stock.
 */
const LOCATION_WEIGHTED = STOCK_LOCATIONS.filter(
  (location) => location.isActive
).flatMap((location) =>
  Array<string>(WEIGHT_BY_KIND[location.kind]).fill(location.id)
)

/**
 * A shelf code names its building, so the prefix is not free to drift.
 *
 * Derived from each location's position in the list rather than a map written
 * out by hand: a map keyed by id yields `undefined` for any location added
 * later, and every bin in that building would then read "undefined-12-04-02-B".
 */
const BIN_PREFIX = new Map(
  STOCK_LOCATIONS.map((location, index) => [
    location.id,
    String.fromCharCode(65 + index),
  ])
)

const BIN_SLOTS = ["A", "B", "C", "D"]

function pad(value: number, size = 2): string {
  return String(value).padStart(size, "0")
}

/**
 * Distinct locations for one item, primary first. Rotating through the rest
 * rather than sampling them keeps the picks distinct by construction: two levels
 * at one location would double the item's summed totals while each half read
 * correctly.
 */
function locationIdsFor(rng: () => number, count: number): string[] {
  const primary = pick(rng, LOCATION_WEIGHTED)
  const others = STOCK_LOCATIONS.filter(
    (location) => location.isActive && location.id !== primary
  ).map((location) => location.id)
  const offset = Math.floor(rng() * others.length)
  const ids = [primary]
  for (let i = 0; i < count - 1 && i < others.length; i++) {
    ids.push(others[(offset + i) % others.length])
  }
  return ids
}

function binAt(rng: () => number, locationId: string): string {
  const aisle = pad(1 + Math.floor(rng() * 24))
  const bay = pad(1 + Math.floor(rng() * 8))
  const shelf = pad(1 + Math.floor(rng() * 6))
  return `${BIN_PREFIX.get(locationId) ?? "A"}-${aisle}-${bay}-${shelf}-${pick(rng, BIN_SLOTS)}`
}

// ── Barcodes ──

/** UPC-A check digit: odd positions weigh 3, even 1, round up to the next ten. */
function upcCheckDigit(body: string): number {
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    sum += Number(body[i]) * (i % 2 === 0 ? 3 : 1)
  }
  return (10 - (sum % 10)) % 10
}

/** The first number of the run the store's barcodes are allocated from. */
const UPC_START = 1234567890

/** Sequential UPC-A. The check digit is computed, not decorative: a scanner
 *  rejects a code whose twelfth digit does not add up. */
function upcFor(index: number): string {
  const body = String(UPC_START + index).padStart(11, "0")
  return `${body}${upcCheckDigit(body)}`
}

// ── Quantity splitting ──

/**
 * Split a total into `parts` positive integers. Callers must pass parts <= total
 * so every part lands at 1 or more: a level or a lot holding nothing is a row
 * that sits nowhere.
 */
function splitAcross(
  rng: () => number,
  total: number,
  parts: number
): number[] {
  const out: number[] = []
  let left = total
  for (let i = 0; i < parts - 1; i++) {
    const ceiling = left - (parts - 1 - i)
    out.push(
      Math.min(ceiling, Math.max(1, Math.round(left * (0.35 + rng() * 0.3))))
    )
    left -= out[i]
  }
  out.push(left)
  return out
}

// ── Per-product facts ──

interface ProductStock {
  /**
   * The distributor this product is restocked through. One product buys through
   * ONE supplier: a product whose sizes scattered across four of them would make
   * the "{n} SKUs" count each supplier is deleted against meaningless.
   */
  supplier: Supplier
  discontinued: boolean
  /**
   * The cheapest variant's price. Unit cost is derived against this rather than
   * against each variant's own, so a product whose sizes spread upward cannot
   * produce a row that costs more than the product's floor sells for.
   */
  retailFloor: number
}

function planProduct(product: Product, index: number): ProductStock {
  const rng = mulberry32((0x510c_a15e + index * 2654435761) >>> 0)
  return {
    // Any draw is safe: suppliers.ts keeps the supplier and vendor name pools
    // disjoint on purpose, so a row can never be supplied by its own brand.
    supplier: pick(rng, SUPPLIERS),
    discontinued: DISCONTINUED.has(product.id),
    retailFloor: productPriceRange(product).min,
  }
}

const STOCK_BY_PRODUCT = new Map<string, ProductStock>(
  PRODUCTS.map((product, index) => [product.id, planProduct(product, index)])
)

// ── Movement narratives ──

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/** "Jun 14", formatted off the rolling anchor. Written out rather than taken
 *  from a locale API so the label reads the same on the server and the client. */
function dayLabel(time: number): string {
  const date = new Date(time)
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`
}

/** Stamps the ledger newest first, walking back from the seed clock: the sheet
 *  renders the movements in the order it is handed them. */
function movementClock(rng: () => number): () => string {
  let daysAgo = 1 + Math.floor(rng() * 4)
  return () => {
    const label = dayLabel(SEED_NOW - daysAgo * 86_400_000)
    daysAgo += 2 + Math.floor(rng() * 5)
    return label
  }
}

type MovementDraft = Pick<StockMovement, "kind" | "title" | "detail">

interface MovementContext {
  id: string
  rng: () => number
  profile: StockProfile
  discontinued: boolean
  supplier: Supplier
  reorderPoint: number
  levels: StockLevel[]
  lots: StockLot[]
}

/**
 * The ledger behind a row's numbers. Narratives are templated off the same draw
 * the counts came from, so the timeline explains the shelf rather than
 * contradicting it. Every detail that names a company names the row's SUPPLIER:
 * printing the product's vendor here is the conflation the supplier entity was
 * introduced to end.
 */
function buildMovements(ctx: MovementContext): StockMovement[] {
  const { rng, profile, discontinued, supplier, levels, lots } = ctx
  const primary = primaryLevel(levels)!
  const onHand = sumLevels(levels, (level) => level.onHand)
  // Narrative only. The movement log tells the story of how this shelf got where
  // it is, and "we reserved some units that week" is part of it. The LIVE figure
  // is not stored anywhere: it is derived from the open orders at read time (see
  // features/inventory/allocations), so this is history, not state.
  const allocatedThen = Math.max(1, Math.round(onHand * (0.2 + rng() * 0.3)))
  const home = locationName(STOCK_LOCATIONS, primary.locationId)
  const po = `PO-${2020 + Math.floor(rng() * 60)}`
  const adj = `ADJ-${1180 + Math.floor(rng() * 60)}`
  const cnt = `CNT-${pad(80 + Math.floor(rng() * 30), 4)}`
  const trf = `TRF-${pad(350 + Math.floor(rng() * 40), 4)}`
  const week = dayLabel(SEED_NOW - (7 + Math.floor(rng() * 10)) * 86_400_000)

  const drafts: MovementDraft[] = []

  if (discontinued) {
    drafts.push({
      kind: "Adjustment",
      title: `Marked discontinued, ${adj}`,
      detail:
        onHand > 0
          ? `No replenishment planned, selling through remaining ${onHand}.`
          : `No replenishment planned, ${supplier.name} closed the line.`,
    })
    drafts.push(
      onHand > 0
        ? {
            kind: "Transfer",
            title: `Consolidated ${onHand} units at ${home}`,
            detail: `${trf} pulled the last lots together.`,
          }
        : {
            kind: "Sale",
            title: "Sold through the final run",
            detail: `${home} cleared the last lot before the line closed.`,
          }
    )
    return stamp(ctx, drafts)
  }

  if (profile === "healthy") {
    const received = Math.max(
      1,
      Math.round(primary.onHand * (0.5 + rng() * 0.4))
    )
    drafts.push({
      kind: "Restock",
      title: `Received ${received} units on ${po}`,
      detail: `${supplier.name}, ${lots[0].lot} booked to ${primary.bin}.`,
    })
    const outpost = levels.find(
      (level) => level.locationId !== primary.locationId
    )
    if (outpost) {
      const there = locationName(STOCK_LOCATIONS, outpost.locationId)
      drafts.push({
        kind: "Transfer",
        title: `Transferred ${outpost.onHand} units to ${there}`,
        detail: `${trf}, balancing ${there} coverage.`,
      })
    }
    if (onHand > 0) {
      drafts.push({
        kind: "Sale",
        title: `Allocated ${allocatedThen} units to open orders`,
        detail: `Reserved against fulfillment for the week of ${week}.`,
      })
    }
    return stamp(ctx, drafts)
  }

  if (profile === "low") {
    drafts.push({
      kind: "Sale",
      title: `Allocated ${allocatedThen} units to open orders`,
      detail: `Available dipped under the ${ctx.reorderPoint} reorder point after allocation.`,
    })
    drafts.push({
      kind: "Adjustment",
      title: `Flagged for reorder, ${adj}`,
      detail: `Cycle count ${cnt} confirmed ${onHand} on hand.`,
    })
    return stamp(ctx, drafts)
  }

  if (profile === "out") {
    drafts.push({
      kind: "Sale",
      title: `Sold through remaining ${6 + Math.floor(rng() * 30)} units`,
      detail: `${home} cleared the last lot.`,
    })
    drafts.push({
      kind: "Adjustment",
      title: `Marked out of stock, ${adj}`,
      detail: `Awaiting ${po} from ${supplier.name}.`,
    })
    return stamp(ctx, drafts)
  }

  const inbound = 60 + Math.floor(rng() * 180)
  drafts.push({
    kind: "Sale",
    title: `Fully allocated remaining ${onHand} units`,
    detail: `Backorder opened for ${inbound} units against ${po}.`,
  })
  drafts.push({
    kind: "Restock",
    title: `Inbound ${inbound} units on ${po}`,
    detail: `${supplier.name}, expected to land ${dayLabel(
      SEED_NOW + (8 + Math.floor(rng() * 20)) * 86_400_000
    )}.`,
  })
  return stamp(ctx, drafts)
}

function stamp(ctx: MovementContext, drafts: MovementDraft[]): StockMovement[] {
  const at = movementClock(ctx.rng)
  return drafts.map((draft, i) => ({
    id: `${ctx.id}-mov-${i + 1}`,
    ...draft,
    timeLabel: at(),
    author: pick(ctx.rng, AUTHORS),
  }))
}

// ── Generator ──

/**
 * One row per variant, in catalog order. Drafts are included: the new-order form
 * does not filter by product status, so a draft variant is bookable, and a
 * variant with no ledger row would allocate from nowhere.
 */
const VARIANT_ROWS: readonly { product: Product; variant: ProductVariant }[] =
  PRODUCTS.flatMap((product) =>
    product.variants.map((variant) => ({ product, variant }))
  )

/**
 * Which row gets which profile. Dealt across the ledger rather than drawn per
 * row, for the reason DISCONTINUED_COUNT is a count and not a chance: an
 * independent draw lands where it lands, and healthy wins ten times in sixteen,
 * so it can seat a whole page of one status. It did exactly that - the first
 * page came up every row "In stock", which leaves the status tabs above the
 * table looking like they filter nothing.
 *
 * So each status is spread evenly across the whole ledger rather than shuffled,
 * which a run can still front-load. Every status gets its share of slots, each
 * slot placed at its even fraction of the way through (the k-th of n sits near
 * k/n), with a small seeded jitter so the interleave does not read as a fixed
 * pattern. Sorting by that fraction lays them down proportionally, so any page,
 * the first most of all, shows the same mix the totals do.
 */
const PROFILE_BY_ROW: readonly StockProfile[] = (() => {
  const rng = mulberry32(PROFILE_SEED)
  const total = VARIANT_ROWS.length
  const unit = PROFILE_WEIGHTED.length

  const shareOf: Record<StockProfile, number> = {
    healthy: 0,
    low: 0,
    out: 0,
    backordered: 0,
  }
  for (const profile of PROFILE_WEIGHTED) shareOf[profile] += 1

  // Turn each weight into a whole number of rows. Largest-remainder keeps the
  // rounding honest, so the counts still sum to exactly one per ledger row.
  const exact = (Object.keys(shareOf) as StockProfile[]).map((profile) => {
    const raw = (shareOf[profile] / unit) * total
    return { profile, base: Math.floor(raw), rem: raw - Math.floor(raw) }
  })
  let assigned = exact.reduce((sum, e) => sum + e.base, 0)
  exact.sort((a, b) => b.rem - a.rem)
  for (let i = 0; assigned < total; i++, assigned++)
    exact[i % exact.length].base += 1

  const slots: { profile: StockProfile; at: number }[] = []
  for (const { profile, base } of exact) {
    for (let k = 0; k < base; k++) {
      slots.push({ profile, at: (k + rng() * 0.9) / base })
    }
  }
  slots.sort((a, b) => a.at - b.at)
  return slots.map((s) => s.profile)
})()

/** Lot letters run out at six, which is the ceiling this generator can reach:
 *  three locations, two lots each. */
const LOT_LETTERS = ["A", "B", "C", "D", "E", "F"]

function buildInventoryItem(index: number): InventoryItem {
  const { product, variant } = VARIANT_ROWS[index]
  const plan = STOCK_BY_PRODUCT.get(product.id)!
  const rng = mulberry32((0x1b0c_5eed + index * 2654435761) >>> 0)
  const id = `inv_${variant.sku}`

  const profile = PROFILE_BY_ROW[index]
  const status = plan.discontinued ? "Discontinued" : STATUS_BY_PROFILE[profile]

  // The threshold the counts are drawn around. A discontinued row publishes 0
  // (nothing is on order for it) but still holds a plausible shelf, so the draw
  // keeps its own number rather than reading the published one back.
  const threshold = 20 + Math.floor(rng() * 60)
  const reorderPoint = plan.discontinued ? 0 : threshold
  const unitCost = Math.max(
    1,
    Math.round(plan.retailFloor * (0.38 + rng() * 0.1))
  )

  const onHandTotal =
    profile === "out"
      ? 0
      : profile === "backordered"
        ? 8 + Math.floor(rng() * 33)
        : profile === "low"
          ? // At or under the threshold, so the summed available cannot climb
            // back over the reorder point and contradict the badge.
            Math.max(1, Math.round(threshold * (0.4 + rng() * 0.6)))
          : Math.round(threshold * (2 + rng() * 3))
  // Preserve the seed generator sequence used by the original demo.
  void (profile === "backordered"
    ? 1
    : profile === "out"
      ? 0
      : profile === "low"
        ? 0.3 + rng() * 0.5
        : 0.05 + rng() * 0.2)

  const levelCount =
    profile === "out"
      ? 1
      : Math.min(pick(rng, LEVEL_COUNT_WEIGHTED), onHandTotal)
  const shares =
    profile === "out" ? [0] : splitAcross(rng, onHandTotal, levelCount)
  const levels: StockLevel[] = locationIdsFor(rng, levelCount).map(
    (locationId, i) => ({
      locationId,
      bin: binAt(rng, locationId),
      onHand: shares[i],
    })
  )

  // Lots are cut FROM the levels rather than drawn beside them: they are the
  // provenance of the same units, so their quantities have to add back up to the
  // shelf they sit on, location by location. An empty shelf has no provenance.
  const lots: StockLot[] = []
  for (const level of levels) {
    if (level.onHand === 0) continue
    const lotCount = level.onHand >= 100 && rng() > 0.4 ? 2 : 1
    for (const qty of splitAcross(rng, level.onHand, lotCount)) {
      // The batch code carries the id, so the letter runs off the item's lot
      // count: two lots on one row can draw the same number and stay distinct.
      const batch = `${pad(2 + Math.floor(rng() * 57))}${LOT_LETTERS[lots.length]}`
      lots.push({
        id: `${id}-lot-${batch.toLowerCase()}`,
        lot: `LOT-${batch}`,
        locationId: level.locationId,
        qty,
        cost: Math.max(1, unitCost + Math.round(rng() * 4) - 2),
      })
    }
  }

  return {
    id,
    productId: product.id,
    // The grid renders the title and the sku as two lines, so the name stays the
    // bare product title: the sku is what tells two rows of it apart.
    name: product.title,
    sku: variant.sku,
    // The variant's, not the product's: a row is one sku, and the product
    // thumbnail put the same photo on the navy, the oat and the rust.
    thumbnail: variant.image,
    category: product.category,
    supplierId: plan.supplier.id,
    levels,
    reorderPoint,
    unitCost,
    status,
    safetyStock: plan.discontinued ? 0 : Math.round(threshold * 0.45),
    leadTimeDays: plan.discontinued ? 0 : 12 + Math.floor(rng() * 13),
    dailyVelocity: 1 + Math.floor(rng() * 9),
    upc: upcFor(index),
    lots,
    movements: buildMovements({
      id,
      rng,
      profile,
      discontinued: plan.discontinued,
      supplier: plan.supplier,
      reorderPoint,
      levels,
      lots,
    }),
  }
}

export const INVENTORY_ITEMS: InventoryItem[] = VARIANT_ROWS.map((_, index) =>
  buildInventoryItem(index)
)
