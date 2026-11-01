import type { CustomerGroupsRepository } from "../types"

// LIVE adapter template. Mirror ../live/customers; the demo adapter
// (../demo/customer-groups) is a working reference for the exact shapes.

const NOT_IMPLEMENTED =
  "Live customer groups repository is not implemented. Fill in src/lib/data/repositories/live/customer-groups.ts or keep VITE_DATA_MODE unset to use the demo store."

export const liveCustomerGroupsRepository: CustomerGroupsRepository = {
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
