import type { Supplier } from "../../suppliers"
import { makeDemoCollection } from "./make-collection"

// Suppliers are a standard CRUD collection (flat rows, referenced by
// InventoryItem.supplierId), so the demo adapter uses the makeDemoCollection
// factory. The id is assigned by the repo; create supplies the rest.
export const demoSuppliersRepository = makeDemoCollection<Supplier>(
  (db) => db.suppliers
)
