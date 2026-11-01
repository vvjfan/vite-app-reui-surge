// Stock locations: the places inventory physically sits.
//
// A real entity rather than a string on each row, the way a commerce backend
// models it and the way an admin surfaces it (Settings > Locations). Inventory
// rows reference a location by id, so renaming "East DC" in settings renames it
// everywhere at once instead of orphaning every row that spelled it the old way.
//
// Swap for a real API later via the repository seam (src/lib/data/repositories).

export type StockLocationKind = "warehouse" | "fulfillment" | "store"

export interface StockLocation {
  /** Stable id, also the store's primary key. Referenced by InventoryItem.locationId. */
  id: string
  name: string
  kind: StockLocationKind
  address: string
  /** Inactive locations stay on their rows but are not offered for new stock. */
  isActive: boolean
}

export const STOCK_LOCATION_KIND_LABEL: Record<StockLocationKind, string> = {
  warehouse: "Warehouse",
  fulfillment: "Fulfillment center",
  store: "Retail store",
}

export const STOCK_LOCATIONS: StockLocation[] = [
  {
    id: "loc_main",
    name: "Main Warehouse",
    kind: "warehouse",
    address: "1234 Industrial Way, Dallas, TX 75201",
    isActive: true,
  },
  {
    id: "loc_east",
    name: "East DC",
    kind: "fulfillment",
    address: "500 Logistics Park, Newark, NJ 07114",
    isActive: true,
  },
  {
    id: "loc_brooklyn",
    name: "Store-Brooklyn",
    kind: "store",
    address: "88 Wythe Avenue, Brooklyn, NY 11249",
    isActive: true,
  },
]

/** Resolve a location id to its name. Falls back rather than throwing, so one
 *  dangling reference cannot blank a whole grid. */
export function locationName(
  locations: readonly StockLocation[],
  id: string
): string {
  return (
    locations.find((location) => location.id === id)?.name ?? "Unknown location"
  )
}

export function locationById(
  locations: readonly StockLocation[]
): Map<string, StockLocation> {
  return new Map(locations.map((location) => [location.id, location]))
}
