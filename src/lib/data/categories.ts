// Category taxonomy for the store: a real Category entity that is
// hierarchical (parentId), rank-ordered among siblings, with active/internal
// status. Products link via the single Product.category string (the category
// name), so this is additive - no Product model change. See docs/DATA-LAYER.md.

export interface Category {
  /** URL-safe handle, also the route param. */
  id: string
  name: string
  handle: string
  description: string
  /**
   * Merchant-authored category art, or null to fall back to a product photo.
   * Owning it here keeps a category's identity stable: surfaces that show a
   * category image (the dashboard's Top categories card) used to borrow the
   * best-selling product's photo, so the picture changed as sales moved.
   */
  image: string | null
  isActive: boolean
  isInternal: boolean
  /** Order among siblings that share a parentId. */
  rank: number
  /** null for a top-level category; otherwise the parent's id. */
  parentId: string | null
}

const active = (
  id: string,
  name: string,
  description: string,
  rank: number,
  parentId: string | null,
  overrides: Partial<Category> = {}
): Category => ({
  id,
  name,
  handle: id,
  description,
  image: null,
  isActive: true,
  isInternal: false,
  rank,
  parentId,
  ...overrides,
})

/** Unsplash art per top-level category, sized like the product thumbnails. */
const art = (photoId: string) =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=200&h=200&q=80`

// The 7 top-level categories match the app taxonomy (Product.category values),
// each with a couple of subcategories to exercise the tree. A couple carry
// non-default status to show the Inactive / Internal badges.
// Every category owns its art, subcategories included: the top-level photos are
// the merchant-authored set, and each subcategory borrows a distinct, on-theme
// photo from a product in its branch (a fixed pick, not a live "best seller"
// borrow - see the Category.image note). All ids are drawn from the audited
// catalog in products.ts, so no thumbnail renders an initials placeholder.
export const CATEGORIES: Category[] = [
  active(
    "apparel",
    "Apparel",
    "Tees, shirts, knits, and everyday layers.",
    0,
    null,
    {
      image: art("photo-1521572163474-6864f9cf17ab"),
    }
  ),
  active("tees", "Tees", "Short and long sleeve tees.", 0, "apparel", {
    image: art("photo-1581655353564-df123a1eb820"),
  }),
  active(
    "shirts",
    "Shirts",
    "Button-ups, overshirts, and camp collars.",
    1,
    "apparel",
    {
      image: art("photo-1713881604560-085594ed2c3d"),
    }
  ),
  active("knitwear", "Knitwear", "Sweaters and knit layers.", 2, "apparel", {
    image: art("photo-1740442535162-fc915d5403f2"),
    isInternal: true,
  }),

  active(
    "footwear",
    "Footwear",
    "Shoes, boots, trainers, and sandals.",
    1,
    null,
    {
      image: art("photo-1542291026-7eec264c27ff"),
    }
  ),
  active("sneakers", "Sneakers", "Low and high-top trainers.", 0, "footwear", {
    image: art("photo-1667999164629-3da22367bf46"),
  }),
  active("boots", "Boots", "Chelsea, hiking, and work boots.", 1, "footwear", {
    image: art("photo-1616688577198-0462bcecbdf9"),
  }),

  active(
    "outerwear",
    "Outerwear",
    "Jackets, shells, vests, and seasonal layers.",
    2,
    null,
    {
      image: art("photo-1551028719-00167b16eac5"),
    }
  ),
  active(
    "jackets",
    "Jackets",
    "Field, puffer, and shell jackets.",
    0,
    "outerwear",
    {
      image: art("photo-1591047139829-d91aecb6caea"),
    }
  ),
  active("vests", "Vests", "Down and quilted vests.", 1, "outerwear", {
    image: art("photo-1734697188154-bfe7122c9233"),
    isActive: false,
  }),

  active("bags", "Bags", "Totes, backpacks, weekenders, and carry.", 3, null, {
    image: art("photo-1547949003-9792a18a2601"),
  }),
  active("totes", "Totes", "Everyday and market totes.", 0, "bags", {
    image: art("photo-1544816155-12df9643f363"),
  }),
  active("backpacks", "Backpacks", "Commuter and travel packs.", 1, "bags", {
    image: art("photo-1624292981551-e3aa15c0056d"),
  }),

  active(
    "accessories",
    "Accessories",
    "Caps, socks, wallets, and add-ons.",
    4,
    null,
    {
      image: art("photo-1511499767150-a48a237f0083"),
    }
  ),
  active("hats", "Hats", "Caps, beanies, and bucket hats.", 0, "accessories", {
    image: art("photo-1667587029116-3ccb580c7858"),
  }),
  active("belts", "Belts", "Leather and webbing belts.", 1, "accessories", {
    image: art("photo-1677326767891-0dfe94a94a1c"),
  }),

  active(
    "activewear",
    "Activewear",
    "Performance tops, shorts, and training kit.",
    5,
    null,
    {
      image: art("photo-1483721310020-03333e577078"),
    }
  ),
  active(
    "active-tops",
    "Active tops",
    "Compression and training tops.",
    0,
    "activewear",
    {
      image: art("photo-1737094540214-261561588b89"),
    }
  ),
  active(
    "active-shorts",
    "Active shorts",
    "Running and training shorts.",
    1,
    "activewear",
    {
      image: art("photo-1518459031867-a89b944bffe4"),
    }
  ),

  active(
    "denim",
    "Denim",
    "Jeans, jackets, and washed indigo staples.",
    6,
    null,
    {
      image: art("photo-1542272604-787c3835535d"),
    }
  ),
  active("jeans", "Jeans", "Slim, straight, and relaxed jeans.", 0, "denim", {
    image: art("photo-1475178626620-a4d074967452"),
  }),
  active(
    "denim-jackets",
    "Denim jackets",
    "Trucker and washed denim jackets.",
    1,
    "denim",
    {
      image: art("photo-1665615837850-99bfaf83bab8"),
    }
  ),
]

// ── Tree helpers ──

export function topLevelCategories(categories: Category[]): Category[] {
  return categories
    .filter((category) => category.parentId === null)
    .sort((a, b) => a.rank - b.rank)
}

export function childCategories(
  categories: Category[],
  parentId: string
): Category[] {
  return categories
    .filter((category) => category.parentId === parentId)
    .sort((a, b) => a.rank - b.rank)
}

/** A category's id plus the ids of every descendant (for cycle-safe parent selects). */
export function descendantIds(categories: Category[], id: string): Set<string> {
  const result = new Set<string>([id])
  const walk = (parentId: string) => {
    for (const child of categories.filter((c) => c.parentId === parentId)) {
      if (!result.has(child.id)) {
        result.add(child.id)
        walk(child.id)
      }
    }
  }
  walk(id)
  return result
}

/**
 * Products in a category: a direct name match plus a rollup of every descendant
 * category's matches (products carry a single top-level category name, so most
 * counts land on the parents).
 */
export function categoryProductCount(
  category: Category,
  categories: Category[],
  products: { category: string }[]
): number {
  const names = new Set<string>()
  const collect = (node: Category) => {
    names.add(node.name)
    for (const child of categories.filter((c) => c.parentId === node.id)) {
      collect(child)
    }
  }
  collect(category)
  return products.filter((product) => names.has(product.category)).length
}
