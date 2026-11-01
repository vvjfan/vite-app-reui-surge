import type { CustomersRepository } from "../types"

// LIVE adapter template. Implement each method against your backend, then set
// VITE_DATA_MODE=live. The demo adapter (../demo/customers) is a working
// reference for the exact shapes.

const NOT_IMPLEMENTED =
  "Live customers repository is not implemented. Fill in src/lib/data/repositories/live/customers.ts or keep VITE_DATA_MODE unset to use the demo store."

export const liveCustomersRepository: CustomersRepository = {
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
