import type { CategoriesRepository } from "../types"

// LIVE adapter template. Implement each method against your backend, then set
// VITE_DATA_MODE=live. The demo adapter (../demo/categories) is a working
// reference for the exact return shapes.

const NOT_IMPLEMENTED =
  "Live categories repository is not implemented. Fill in src/lib/data/repositories/live/categories.ts or keep VITE_DATA_MODE unset to use the demo store."

export const liveCategoriesRepository: CategoriesRepository = {
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
