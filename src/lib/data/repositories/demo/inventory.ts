import type { InventoryItem } from "../../inventory"
import { makeDemoCollection } from "./make-collection"

export const demoInventoryRepository = makeDemoCollection<InventoryItem>(
  (db) => db.inventory,
  // A stock row's id is `inv_<sku>`, so it is derived from the row's variant,
  // and nextId is handed nothing that could tell it the sku. Nothing calls
  // create(): a stock row exists because its variant does, so it is the variant
  // that has to be created first. Refuse rather than hand back an id that would
  // be wrong - including the random one the factory would otherwise default to.
  () => {
    throw new Error(
      "Stock rows are keyed by variant sku (inv_<sku>). Create the variant, not the stock row."
    )
  }
)
