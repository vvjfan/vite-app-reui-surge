import type { ProductsRepository } from "../types"

// LIVE adapter template. Mirror ../live/orders.ts: implement each method against
// your backend and set VITE_DATA_MODE=live. The demo adapter (../demo/products)
// is a working reference for the exact return shapes.

const NOT_IMPLEMENTED =
  "Live products repository is not implemented. Fill in src/lib/data/repositories/live/products.ts or keep VITE_DATA_MODE unset to use the demo store."

export const liveProductsRepository: ProductsRepository = {
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
  remove: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
}
