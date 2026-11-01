// Suppliers: the companies stock is bought from.
//
// A real entity rather than a string on each row, for the same reason locations
// became one: the reorder queue filters, searches and sorts by supplier, and
// offers "Create PO" - a purchase order is raised TO a counterparty, so it
// cannot be a name someone typed. A typo used to invent a filter option.
//
// A supplier is NOT a product's vendor, and the two must not be conflated.
// A product's vendor is who made or branded it - a plain string on the catalog
// entry, used for filtering and reports - while a supplier is who the stock is
// purchased from, which is a counterparty the purchasing side manages.
// So the names here are deliberately distributors that are
// nobody's brand: a product branded "Aster Goods" is restocked through
// "Meridian Distribution", and both facts are true at once. Sharing one name
// pool (as the old seed did) is what made two different fields look like one
// field badly synced.
//
// Swap for a real API later via the repository seam (src/lib/data/repositories).

export interface Supplier {
  /** Stable id, also the store's primary key. Referenced by InventoryItem.supplierId. */
  id: string
  name: string
  contactEmail: string
  /** Inactive suppliers stay on their rows but are not offered for new stock. */
  isActive: boolean
}

// Ids are hand-written rather than slugified: "Maven & Co." would slug badly,
// and an id is a stable key, not a label.
export const SUPPLIERS: Supplier[] = [
  {
    id: "sup_meridian",
    name: "Meridian Distribution",
    contactEmail: "orders@meridian-dist.example.com",
    isActive: true,
  },
  {
    id: "sup_harbor",
    name: "Harbor Supply Co.",
    contactEmail: "purchasing@harborsupply.example.com",
    isActive: true,
  },
  {
    id: "sup_atlas",
    name: "Atlas Wholesale",
    contactEmail: "accounts@atlaswholesale.example.com",
    isActive: true,
  },
  {
    id: "sup_cedar",
    name: "Cedar Logistics",
    contactEmail: "supply@cedarlogistics.example.com",
    isActive: true,
  },
]

/** Resolve a supplier id to its name. Falls back rather than throwing, so one
 *  dangling reference cannot blank a whole grid. */
export function supplierName(
  suppliers: readonly Supplier[],
  id: string
): string {
  return (
    suppliers.find((supplier) => supplier.id === id)?.name ?? "Unknown supplier"
  )
}

export function supplierById(
  suppliers: readonly Supplier[]
): Map<string, Supplier> {
  return new Map(suppliers.map((supplier) => [supplier.id, supplier]))
}
