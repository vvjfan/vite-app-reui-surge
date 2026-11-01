import type { TeamMembersRepository } from "../types"

// LIVE adapter template for team members. Implement against your backend and set
// VITE_DATA_MODE=live. The demo adapter (../demo/team) is a working reference.

const NOT_IMPLEMENTED =
  "Live team members repository is not implemented. Fill in src/lib/data/repositories/live/team.ts or keep VITE_DATA_MODE unset to use the demo store."

export const liveTeamMembersRepository: TeamMembersRepository = {
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
