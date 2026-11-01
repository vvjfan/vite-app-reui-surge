import type { Promotion } from "../../promotions"
import { makeDemoCollection } from "./make-collection"

// Promotions are a standard CRUD collection (discount rows, no nested joins), so
// the demo adapter uses the makeDemoCollection factory. The id is assigned by the
// repo; create supplies the rest of the record.
export const demoPromotionsRepository = makeDemoCollection<Promotion>(
  (db) => db.promotions
)
