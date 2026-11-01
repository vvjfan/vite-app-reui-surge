// Options for the General (store profile) settings page. Adapted from the ReUI
// settings-3 block's data module, remapped to commerce store concepts.

export type SelectOption = { value: string; label: string }

// The per-store on/off state lives in the persisted profile (StoreProfile.prefs,
// seeded from DEFAULT_STORE_PROFILE); this list only carries each toggle's copy.
export type StorePreference = {
  id: string
  label: string
  description: string
}

export type BrandColorOption = { name: string; value: string }

export function getOptionLabel(options: SelectOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}

export const TIMEZONES: SelectOption[] = [
  { value: "america-new_york", label: "(GMT-05:00) New York" },
  { value: "america-chicago", label: "(GMT-06:00) Chicago" },
  { value: "america-los_angeles", label: "(GMT-08:00) Los Angeles" },
  { value: "europe-london", label: "(GMT+00:00) London" },
  { value: "europe-berlin", label: "(GMT+01:00) Berlin" },
  { value: "asia-tokyo", label: "(GMT+09:00) Tokyo" },
  { value: "australia-sydney", label: "(GMT+11:00) Sydney" },
]

export const CURRENCIES: SelectOption[] = [
  { value: "usd", label: "USD · US Dollar" },
  { value: "eur", label: "EUR · Euro" },
  { value: "gbp", label: "GBP · British Pound" },
  { value: "jpy", label: "JPY · Japanese Yen" },
  { value: "aud", label: "AUD · Australian Dollar" },
]

export const REGIONS: SelectOption[] = [
  { value: "us", label: "United States" },
  { value: "eu", label: "European Union" },
  { value: "uk", label: "United Kingdom" },
  { value: "jp", label: "Japan" },
  { value: "au", label: "Australia" },
]

export const BRAND_COLORS: BrandColorOption[] = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Orange", value: "#f97316" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Emerald", value: "#10b981" },
  { name: "Sky", value: "#0ea5e9" },
]

export const STOREFRONT_PREFERENCES: StorePreference[] = [
  {
    id: "prices-tax-included",
    label: "Show prices with tax included.",
    description: "Display tax-inclusive prices across the storefront.",
  },
  {
    id: "password-protect",
    label: "Password-protect storefront.",
    description: "Require a password before customers can view the store.",
  },
  {
    id: "maintenance-mode",
    label: "Enable maintenance mode.",
    description: "Temporarily take the storefront offline for updates.",
  },
  {
    id: "powered-by",
    label: 'Show "Powered by" badge.',
    description: "Display the platform badge in the storefront footer.",
  },
]

// ── Persisted store profile (shape + seed live in the data layer) ──

export {
  STORE_PROFILE_KEY,
  DEFAULT_STORE_PROFILE,
  type StoreProfile,
} from "@/lib/data/store-profile"
