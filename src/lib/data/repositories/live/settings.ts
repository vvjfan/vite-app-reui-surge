import type { SettingsRepository } from "../types"

// LIVE adapter template for settings singletons. Implement against your backend
// (a key/value settings endpoint, or one row per key) and set VITE_DATA_MODE=live.
// The demo adapter (../demo/settings) is a working reference.

const NOT_IMPLEMENTED =
  "Live settings repository is not implemented. Fill in src/lib/data/repositories/live/settings.ts or keep VITE_DATA_MODE unset to use the demo store."

export const liveSettingsRepository: SettingsRepository = {
  get: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
  set: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
}
