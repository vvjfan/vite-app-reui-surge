import { mulberry32, pick, round2, slugify } from "./seed-utils"

// Deterministic mock product catalog. Categories match the app taxonomy used by
// the dashboard and orders (Apparel, Footwear, ...); status matches the
// add-product form (active / draft / scheduled). Swap for a real API later via
// the repository seam (src/lib/data/repositories).
//
// The seed helpers come from ./seed-utils rather than a private copy: this file
// mints the product ids (slugify) that inventory, reviews and every order line
// join against, so a second copy of that function is a second definition of what
// a product id IS. See seed-utils' own header for the PRNG version of the same
// hazard.

// ── Types ──

export type ProductStatus = "active" | "draft" | "scheduled"
export type ProductKind = "Physical" | "Digital"

/**
 * A sellable variant. Stock is deliberately NOT a field here: the inventory
 * ledger holds one row per sku with a level per location, so a scalar on the
 * variant would be a second copy of the same fact and would go stale the moment
 * stock moved. Sum that sku's levels to get a variant's stock, the way a
 * commerce backend computes an inventory quantity. This module cannot do the
 * sum itself: the ledger imports the catalog, so importing it back would cycle.
 */
export interface ProductVariant {
  id: string
  sku: string
  /** Human label, e.g. "Sand / M". */
  title: string
  /** Sparse: a variant carries only the axes it has (a colour-only product has
   *  no Size, and a default variant has no options at all), so a lookup can miss. */
  options: Record<string, string | undefined>
  price: number
  /**
   * The photo of this variant's COLOUR, not of this variant. Every size of one
   * colourway shares it, because a store photographs a colourway and not each
   * size of it.
   *
   * Never empty. A colour with no photo of its own carries the product image, so
   * a consumer can render this without a fallback of its own - and every
   * consumer that used to reach for `product.thumbnail` per sku was showing the
   * same photo for the navy, the oat and the rust.
   */
  image: string
}

export interface Product {
  /** URL-safe handle, also the route param. */
  id: string
  title: string
  subtitle: string
  description: string
  status: ProductStatus
  category: string
  kind: ProductKind
  vendor: string
  thumbnail: string
  images: string[]
  tags: string[]
  collections: string[]
  variants: ProductVariant[]
}

// ── Derived ──

export function productVariantCount(product: Product): number {
  return product.variants.length
}

export function productPriceRange(product: Product): {
  min: number
  max: number
} {
  const prices = product.variants.map((v) => v.price)
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

// ── Catalog seed (name, category, base price, image, sku prefix, sizes) ──

/**
 * One colour of a product, and that colour's photo.
 *
 * The photo sits ON the colour rather than in an `images` array indexed against
 * a `colors` array: two parallel lists come apart the first time someone inserts
 * a colour and forgets to insert its photo at the same index, and nothing would
 * report it - every colour after the gap would simply wear its neighbour's
 * picture. Here a colour and its photo cannot be separated.
 *
 * `image` is optional because sourcing a photo per colourway is real work that
 * sometimes comes up empty. An omitted photo means "we have no shot of this
 * colour", and buildProduct fills it with the product image.
 */
interface Colorway {
  color: string
  image?: string
}

interface CatalogItem {
  name: string
  category: string
  skuPrefix: string
  price: number
  /** The product-level shot: the catalog grid's thumbnail, and the stand-in for
   *  any colourway with no photo of its own. */
  image: string
  sizes?: string[]
  colorways: Colorway[]
}

const APPAREL_SIZES = ["XS", "S", "M", "L", "XL"]
const SHOE_SIZES = ["7", "8", "9", "10", "11"]

function img(id: string): string {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=200&h=200&q=80`
}

// Every item carries its own image, every COLOUR carries its own image, and no
// two neighbours share a category: repeated thumbnails and contiguous category
// blocks are what make a catalog read as generated. Category counts are
// deliberately uneven for the same reason. The generator below keys off the
// array index, so reordering this list reshuffles the derived statuses, variants
// and vendors with it.
//
// Two colourways have no photo of their own (Everyday Tote / Navy and
// Featherlight Running Short / Coral's sibling Navy): nothing on the image host
// showed those garments in that colour, and a near-miss colour is worse than the
// product shot, since the whole point of the per-colour photo is that the colour
// is right. They omit `image` and inherit the item's.
const CATALOG: readonly CatalogItem[] = [
  {
    name: "Pima Cotton Crewneck",
    category: "Apparel",
    skuPrefix: "AP",
    price: 48,
    image: img("photo-1521572163474-6864f9cf17ab"),
    sizes: APPAREL_SIZES,
    colorways: [
      { color: "Sand", image: img("photo-1697425603592-23863028592b") },
      { color: "Charcoal", image: img("photo-1555024905-8ceaab2aed08") },
      { color: "Ecru", image: img("photo-1620799140408-edc6dcb6d633") },
    ],
  },
  {
    name: "Linen Low-Top Sneaker",
    category: "Footwear",
    skuPrefix: "FT",
    price: 145,
    image: img("photo-1667999164629-3da22367bf46"),
    sizes: SHOE_SIZES,
    colorways: [{ color: "White" }, { color: "Stone" }],
  },
  {
    name: "Quilted Field Jacket",
    category: "Outerwear",
    skuPrefix: "OW",
    price: 268,
    image: img("photo-1591047139829-d91aecb6caea"),
    sizes: APPAREL_SIZES,
    colorways: [
      { color: "Olive", image: img("photo-1629353689974-af4d5c70440f") },
      { color: "Black", image: img("photo-1614031679232-0dae776a72ee") },
    ],
  },
  {
    name: "Canvas Weekender",
    category: "Bags",
    skuPrefix: "BG",
    price: 184,
    image: img("photo-1511301813671-6283d5fba583"),
    colorways: [
      { color: "Tan", image: img("photo-1448582649076-3981753123b5") },
      { color: "Black", image: img("photo-1758542988969-39a10168b2ce") },
    ],
  },
  {
    name: "Recycled Wool Overshirt",
    category: "Apparel",
    skuPrefix: "AP",
    price: 198,
    image: img("photo-1631835778535-908c4e00035c"),
    sizes: APPAREL_SIZES,
    colorways: [
      { color: "Charcoal" },
      { color: "Olive", image: img("photo-1633931764577-dd4bd5b9304e") },
    ],
  },
  {
    name: "Wave Strike Boost Sneaker",
    category: "Footwear",
    skuPrefix: "FT",
    price: 132,
    image: img("photo-1583130627608-219adc0bf6c6"),
    sizes: SHOE_SIZES,
    colorways: [
      { color: "Red", image: img("photo-1625860191460-10a66c7384fb") },
      { color: "Black" },
    ],
  },
  {
    name: "Merino Ribbed Beanie",
    category: "Accessories",
    skuPrefix: "AC",
    price: 38,
    image: img("photo-1667587029116-3ccb580c7858"),
    colorways: [
      { color: "Navy", image: img("photo-1763581201983-6705daee2204") },
      { color: "Oat", image: img("photo-1620997539116-e6887d793b75") },
      { color: "Rust", image: img("photo-1612887726773-e64e20cf08fe") },
    ],
  },
  {
    name: "Performance Track Pant",
    category: "Activewear",
    skuPrefix: "AV",
    price: 96,
    image: img("photo-1552902865-b72c031ac5ea"),
    sizes: APPAREL_SIZES,
    colorways: [
      { color: "Black", image: img("photo-1569032915512-922c2e506c51") },
      { color: "Slate", image: img("photo-1776186432015-9258ba5ea4c7") },
    ],
  },
  {
    name: "Selvedge Slim Denim",
    category: "Denim",
    skuPrefix: "DN",
    price: 158,
    image: img("photo-1754555009601-498e9873197e"),
    sizes: SHOE_SIZES,
    colorways: [
      { color: "Indigo", image: img("photo-1714143164072-7646ef5cb24d") },
      { color: "Washed Black" },
    ],
  },
  {
    name: "Linen Camp Shirt",
    category: "Apparel",
    skuPrefix: "AP",
    price: 88,
    image: img("photo-1713881604560-085594ed2c3d"),
    sizes: APPAREL_SIZES,
    colorways: [
      { color: "White", image: img("photo-1713881604560-085594ed2c3d") },
      { color: "Sky", image: img("photo-1713881842156-3d9ef36418cc") },
    ],
  },
  {
    name: "Trail Runner GTX",
    category: "Footwear",
    skuPrefix: "FT",
    price: 168,
    image: img("photo-1726133731483-d4b8bcabeb43"),
    sizes: SHOE_SIZES,
    colorways: [{ color: "Slate" }, { color: "Lime" }],
  },
  {
    name: "Alpine Down Vest",
    category: "Outerwear",
    skuPrefix: "OW",
    price: 176,
    image: img("photo-1734697188154-bfe7122c9233"),
    sizes: APPAREL_SIZES,
    colorways: [
      { color: "Slate", image: img("photo-1684405257395-27293dd89ba3") },
      { color: "Rust", image: img("photo-1707513592623-3ac6b89e118d") },
    ],
  },
  {
    name: "Everyday Tote",
    category: "Bags",
    skuPrefix: "BG",
    price: 92,
    image: img("photo-1544816155-12df9643f363"),
    colorways: [
      { color: "Stone", image: img("photo-1732963947955-858ad7d5e540") },
      { color: "Navy" },
    ],
  },
  {
    name: "Boxy Pocket Tee",
    category: "Apparel",
    skuPrefix: "AP",
    price: 36,
    image: img("photo-1581655353564-df123a1eb820"),
    sizes: APPAREL_SIZES,
    colorways: [
      { color: "Black", image: img("photo-1571455786673-9d9d6c194f90") },
      { color: "Bone", image: img("photo-1581655353564-df123a1eb820") },
      { color: "Moss" },
    ],
  },
  {
    name: "Suede Chukka Boot",
    category: "Footwear",
    skuPrefix: "FT",
    price: 210,
    image: img("photo-1616688577198-0462bcecbdf9"),
    sizes: SHOE_SIZES,
    colorways: [
      { color: "Tobacco", image: img("photo-1608629601270-a0007becead3") },
      { color: "Sand", image: img("photo-1517389274750-a758d503b69e") },
    ],
  },
  {
    name: "Leather Card Holder",
    category: "Accessories",
    skuPrefix: "AC",
    price: 64,
    image: img("photo-1677326767891-0dfe94a94a1c"),
    colorways: [
      { color: "Cognac" },
      { color: "Black", image: img("photo-1629958513881-a086d21383cd") },
    ],
  },
  {
    name: "Seamless Training Tee",
    category: "Activewear",
    skuPrefix: "AV",
    price: 58,
    image: img("photo-1737094540214-261561588b89"),
    sizes: APPAREL_SIZES,
    colorways: [{ color: "Graphite" }, { color: "Lime" }],
  },
  {
    name: "Relaxed Straight Jean",
    category: "Denim",
    skuPrefix: "DN",
    price: 138,
    image: img("photo-1475178626620-a4d074967452"),
    sizes: SHOE_SIZES,
    colorways: [
      { color: "Rinse", image: img("photo-1624378439575-d8705ad7ae80") },
      { color: "Stone" },
    ],
  },
  {
    name: "Garment-Dyed Henley",
    category: "Apparel",
    skuPrefix: "AP",
    price: 68,
    image: img("photo-1706859935646-4b4ced0b0542"),
    sizes: APPAREL_SIZES,
    colorways: [
      { color: "Clay", image: img("photo-1548207766-507f0258d224") },
      { color: "Fog" },
    ],
  },
  {
    name: "Canvas Deck Shoe",
    category: "Footwear",
    skuPrefix: "FT",
    price: 98,
    image: img("photo-1649920566440-eb5678255340"),
    sizes: SHOE_SIZES,
    colorways: [
      { color: "Ecru" },
      { color: "Navy", image: img("photo-1496202703211-aa28e9500c30") },
    ],
  },
  {
    name: "Storm Shell Parka",
    category: "Outerwear",
    skuPrefix: "OW",
    price: 320,
    image: img("photo-1624548140129-74786c5f1279"),
    sizes: APPAREL_SIZES,
    colorways: [{ color: "Navy" }, { color: "Graphite" }],
  },
  {
    name: "Commuter Backpack",
    category: "Bags",
    skuPrefix: "BG",
    price: 148,
    image: img("photo-1624292981551-e3aa15c0056d"),
    colorways: [
      { color: "Charcoal", image: img("photo-1581605405669-fcdf81165afa") },
      { color: "Olive", image: img("photo-1583300418584-8332e32b710e") },
    ],
  },
  {
    name: "Brushed Flannel Shirt",
    category: "Apparel",
    skuPrefix: "AP",
    price: 92,
    image: img("photo-1763909131423-7a5e3301859f"),
    sizes: APPAREL_SIZES,
    colorways: [
      { color: "Ember", image: img("photo-1588795904317-2f4ab1a0a852") },
      { color: "Pine", image: img("photo-1742346688038-b93bc6dc8bda") },
    ],
  },
  {
    name: "Silk Blend Scarf",
    category: "Accessories",
    skuPrefix: "AC",
    price: 78,
    image: img("photo-1686212164366-b25166623992"),
    colorways: [
      { color: "Ink", image: img("photo-1645199220777-ee9bee70a277") },
      { color: "Blush", image: img("photo-1745670457825-acdabc30498e") },
    ],
  },
  {
    name: "Featherlight Running Short",
    category: "Activewear",
    skuPrefix: "AV",
    price: 52,
    image: img("photo-1518459031867-a89b944bffe4"),
    sizes: APPAREL_SIZES,
    colorways: [
      { color: "Navy" },
      { color: "Coral", image: img("photo-1588689653274-cd16f09dc67b") },
    ],
  },
  {
    name: "Denim Trucker Jacket",
    category: "Denim",
    skuPrefix: "DN",
    price: 168,
    image: img("photo-1665615837850-99bfaf83bab8"),
    sizes: APPAREL_SIZES,
    colorways: [
      { color: "Indigo", image: img("photo-1611312449408-fcece27cdbb7") },
      { color: "Bleach", image: img("photo-1543076447-215ad9ba6923") },
    ],
  },
  {
    name: "Merino Zip Cardigan",
    category: "Outerwear",
    skuPrefix: "OW",
    price: 158,
    image: img("photo-1740442535162-fc915d5403f2"),
    sizes: APPAREL_SIZES,
    colorways: [
      { color: "Oat", image: img("photo-1574201635302-388dd92a4c3f") },
      { color: "Charcoal", image: img("photo-1603570112520-fdc514048979") },
    ],
  },
  {
    name: "Leather Duffle",
    category: "Bags",
    skuPrefix: "BG",
    price: 340,
    image: img("photo-1549943872-1af399ac7e3a"),
    colorways: [
      { color: "Cognac", image: img("photo-1525103504173-8dc1582c7430") },
      { color: "Espresso", image: img("photo-1636098196667-2f5a16d35fa7") },
    ],
  },
] as const

const VENDORS = [
  "Manifest Atelier",
  "Aster Goods",
  "Field Supply",
  "Maven & Co.",
]
const COLLECTIONS = [
  "New Arrivals",
  "Best Sellers",
  "Weather Ready",
  "Editorial Feature",
]
const STATUS_WEIGHTED: ProductStatus[] = [
  "active",
  "active",
  "active",
  "active",
  "active",
  "draft",
  "draft",
  "scheduled",
]

// ── Generator ──

function buildProduct(item: CatalogItem, index: number): Product {
  const rng = mulberry32((0x1f2e3d4c ^ (index * 2654435761)) >>> 0)
  const status = STATUS_WEIGHTED[Math.floor(rng() * STATUS_WEIGHTED.length)]

  // Variants: color x size (or color-only for accessories/bags).
  const variants: ProductVariant[] = []
  const sizes = item.sizes ?? [""]
  const colorCount = 1 + Math.floor(rng() * Math.min(item.colorways.length, 3))
  const chosen = item.colorways.slice(0, colorCount)
  let v = 0
  for (const colorway of chosen) {
    // Resolved once per colourway, not once per variant: the sizes of one colour
    // are the same photo, and this is the only place the fallback is applied, so
    // no consumer has to know that a colour can lack a picture.
    const image = colorway.image ?? item.image
    for (const size of sizes) {
      const priceJitter = Math.round(rng() * 6) - 3
      variants.push({
        id: `${item.skuPrefix}-${1000 + index * 40 + v}`,
        sku: `${item.skuPrefix}-${1000 + index * 40 + v}`,
        title: size ? `${colorway.color} / ${size}` : colorway.color,
        options: size
          ? { Color: colorway.color, Size: size }
          : { Color: colorway.color },
        price: round2(item.price + priceJitter),
        image,
      })
      v++
    }
  }

  const collectionCount = Math.floor(rng() * 3)
  const collections = COLLECTIONS.slice(0, collectionCount)

  // The gallery: the product shot, then one frame per colourway. Deduped and
  // product-shot-first on purpose - the editor hydrates its gallery from this
  // list and saves images[0] back as the thumbnail, so a list that opened on a
  // colourway would quietly repoint the catalog grid at that colour the first
  // time anyone pressed Save. A colourway with no photo of its own contributes
  // the product shot, which the dedupe then folds away.
  const images = [
    ...new Set([item.image, ...variants.map((variant) => variant.image)]),
  ]

  return {
    id: slugify(item.name),
    title: item.name,
    subtitle: `${item.category} - ${chosen.length} ${chosen.length === 1 ? "colour" : "colours"}`,
    description: `${item.name} in premium ${item.category.toLowerCase()} construction. Considered details, durable materials, and a fit refined across seasons.`,
    status,
    category: item.category,
    kind: "Physical",
    vendor: pick(rng, VENDORS),
    thumbnail: item.image,
    images,
    tags: [item.category, ...chosen.map((colorway) => colorway.color)].slice(
      0,
      4
    ),
    collections,
    variants,
  }
}

export const PRODUCTS: Product[] = CATALOG.map((item, i) =>
  buildProduct(item, i)
)
