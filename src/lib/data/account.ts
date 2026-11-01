// Account: the signed-in person's own profile (an identity singleton) and their
// app preferences (a second singleton). Both persist as settings singletons, the
// same mechanism the store profile and billing config use. The option lists that
// populate their controls are static config and live with the account feature.

export const ACCOUNT_PROFILE_KEY = "account-profile"

export interface AccountProfile {
  name: string
  email: string
  username: string
  /** E.164, e.g. +14155550188. */
  phone: string
  website: string
  bio: string
  /** A ROLE_OPTIONS value. */
  role: string
  /** A TIMEZONE_GROUPS entry. */
  timezone: string
  /** Image URL or data URI. */
  avatar: string
}

// Seeded to the same person the app shell shows in the sidebar (USER), so the
// profile page and the avatar menu open on one identity.
export const DEFAULT_ACCOUNT_PROFILE: AccountProfile = {
  name: "Nick Bold",
  email: "nick@reui.io",
  username: "nickbold",
  phone: "+819012345678",
  website: "nickbold.reui.io",
  bio: "Runs day-to-day operations, catalog, and fulfilment across the Manifest storefronts.",
  role: "store-owner",
  timezone: "(GMT+9) Tokyo",
  avatar:
    "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
}

export const ACCOUNT_PREFERENCES_KEY = "account-preferences"

// Personal, per-person app behavior. The color theme is intentionally NOT stored
// here: it belongs to ThemeProvider (the sidebar avatar menu toggles the same
// source), so the preferences page reads and writes the theme through that, and
// the two controls stay in sync.
export interface AccountPreferences {
  defaultView: string
  dateFormat: string
  weekStart: string
  autoSaveDrafts: boolean
  richTextEditing: boolean
  sidebarPosition: string
  reduceAnimations: boolean
  showTooltips: boolean
}

export const DEFAULT_ACCOUNT_PREFERENCES: AccountPreferences = {
  defaultView: "board",
  dateFormat: "mm/dd/yyyy",
  weekStart: "monday",
  autoSaveDrafts: true,
  richTextEditing: true,
  sidebarPosition: "left",
  reduceAnimations: false,
  showTooltips: true,
}

export const ACCOUNT_SECURITY_KEY = "account-security"

// How the signed-in person proves who they are, and what the account tells them
// about sign-ins. No secret is stored here and none ever should be: a password
// is not a setting, so this holds only the metadata a settings page can show
// (when it last changed) and the switches the person actually owns.
export interface AccountSecurity {
  /** ISO 8601 of the last password change; the row reads "Last changed ...". */
  passwordChangedAt: string
  twoFactorEnabled: boolean
  /** A TWO_FACTOR_OPTIONS value. Only meaningful while twoFactorEnabled. */
  twoFactorMethod: string
  passkeyEnabled: boolean
  /** Email this person when a new device signs in. */
  signInAlerts: boolean
  /** Devices currently holding a session, this one included. */
  activeSessions: number
}

export const DEFAULT_ACCOUNT_SECURITY: AccountSecurity = {
  passwordChangedAt: "2026-05-14T09:12:00.000Z",
  twoFactorEnabled: true,
  twoFactorMethod: "authenticator",
  passkeyEnabled: false,
  signInAlerts: true,
  activeSessions: 3,
}
