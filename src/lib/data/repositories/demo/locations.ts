import type { StockLocation } from "../../locations"
import { makeDemoCollection } from "./make-collection"

// Stock locations are a standard CRUD collection (flat rows, referenced by
// InventoryItem.locationId), so the demo adapter uses the makeDemoCollection
// factory. The id is assigned by the repo; create supplies the rest.
export const demoLocationsRepository = makeDemoCollection<StockLocation>(
  (db) => db.locations
)
