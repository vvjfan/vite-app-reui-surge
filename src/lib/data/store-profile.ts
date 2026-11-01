// The store profile (General settings) shape + default, seeded into the demo
// settings singleton on first load. The feature's dropdown option lists
// (currencies, timezones, regions, colors) stay in the feature as UI config.

export const STORE_PROFILE_KEY = "store-profile"

export interface StoreProfile {
  name: string
  url: string
  timezone: string
  region: string
  currency: string
  brandColor: string
  dateFormat: string
  prefs: Record<string, boolean>
}

export const DEFAULT_STORE_PROFILE: StoreProfile = {
  name: "Manifest Store",
  url: "manifest.store",
  timezone: "america-new_york",
  region: "us",
  currency: "usd",
  brandColor: "#6366f1",
  dateFormat: "mdy",
  prefs: {
    "prices-tax-included": true,
    "password-protect": false,
    "maintenance-mode": false,
    "powered-by": true,
  },
}
