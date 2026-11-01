import type { PurchaseOrdersRepository } from "../types"

// LIVE adapter template. Implement each method against YOUR backend, then set
// VITE_DATA_MODE=live to switch the Purchase orders page over with no component
// changes. The demo adapter (../demo/purchase-orders) is a working reference for
// the exact return shapes.
//
// THE LIFECYCLE CONTRACT: `receive` and `cancel` map 1:1 onto your own verbs
// (your receive endpoint, your cancel endpoint), and `update` must REJECT a
// patch touching `status` - it moves only through those two. `receive` is also
// the write that adds the ordered units to stock and records the restock, so it
// is a transaction on your side, not two calls a caller sequences.

const NOT_IMPLEMENTED =
  "Live purchase orders repository is not implemented. Fill in src/lib/data/repositories/live/purchase-orders.ts or keep VITE_DATA_MODE unset to use the demo store."

export const livePurchaseOrdersRepository: PurchaseOrdersRepository = {
  list: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
  get: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
  create: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
  update: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
  receive: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
  cancel: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
  remove: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
}
