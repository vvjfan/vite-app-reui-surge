import type { BadgeProps } from "@/components/reui/badge"
import type { AccountPreferences, AccountSecurity } from "@/lib/data/account"

// Static config for the account pages: the dropdown enums and the preference
// matrix. Like the store settings enums, these are code — not stored data — and
// the persisted shapes/defaults live in @/lib/data/account.

export interface SelectOption {
  value: string
  label: string
}

export interface TimezoneGroup {
  value: string
  items: string[]
}

// Role reads as a job on the storefront's ops team, not a SaaS product title.
export const ROLE_OPTIONS: SelectOption[] = [
  { value: "store-owner", label: "Store owner" },
  { value: "operations-manager", label: "Operations manager" },
  { value: "fulfilment-lead", label: "Fulfilment lead" },
  { value: "merchandiser", label: "Merchandiser" },
  { value: "support-lead", label: "Support lead" },
]

export const TIMEZONE_GROUPS: TimezoneGroup[] = [
  {
    value: "Americas",
    items: [
      "(GMT-5) New York",
      "(GMT-8) Los Angeles",
      "(GMT-6) Chicago",
      "(GMT-5) Toronto",
      "(GMT-8) Vancouver",
      "(GMT-3) Sao Paulo",
    ],
  },
  {
    value: "Europe",
    items: [
      "(GMT+0) London",
      "(GMT+1) Paris",
      "(GMT+1) Berlin",
      "(GMT+1) Rome",
      "(GMT+1) Madrid",
      "(GMT+1) Amsterdam",
    ],
  },
  {
    value: "Asia/Pacific",
    items: [
      "(GMT+9) Tokyo",
      "(GMT+8) Shanghai",
      "(GMT+8) Singapore",
      "(GMT+4) Dubai",
      "(GMT+11) Sydney",
      "(GMT+9) Seoul",
    ],
  },
]

// ── Preferences matrix ──
//
// Each row binds a control to one AccountPreferences field, except the color
// theme, which the preferences page routes to ThemeProvider (see the note in
// @/lib/data/account). `key` is typed to the fields whose value type the control
// produces, so a select can never target a boolean field, or a switch a string.

export interface PreferenceBadge {
  label: string
  variant: BadgeProps["variant"]
}

type StringPrefKey = {
  [K in keyof AccountPreferences]: AccountPreferences[K] extends string
    ? K
    : never
}[keyof AccountPreferences]

type BooleanPrefKey = {
  [K in keyof AccountPreferences]: AccountPreferences[K] extends boolean
    ? K
    : never
}[keyof AccountPreferences]

interface SelectPreference {
  id: string
  title: string
  description: string
  control: "select"
  key: StringPrefKey
  options: SelectOption[]
  badge?: PreferenceBadge
}

interface SwitchPreference {
  id: string
  title: string
  description: string
  control: "switch"
  key: BooleanPrefKey
  badge?: PreferenceBadge
}

interface ThemePreference {
  id: string
  title: string
  description: string
  control: "theme"
  options: SelectOption[]
  badge?: PreferenceBadge
}

export type PreferenceItem =
  SelectPreference | SwitchPreference | ThemePreference

export interface PreferenceSection {
  id: string
  title: string
  items: PreferenceItem[]
}

export const PREFERENCE_SECTIONS: PreferenceSection[] = [
  {
    id: "general",
    title: "General",
    items: [
      {
        id: "default-view",
        title: "Default view",
        description: "Choose which layout opens when you sign in.",
        control: "select",
        key: "defaultView",
        options: [
          { value: "board", label: "Dashboard" },
          { value: "list", label: "Orders" },
          { value: "timeline", label: "Products" },
          { value: "calendar", label: "Analytics" },
        ],
      },
      {
        id: "date-format",
        title: "Date format",
        description: "How dates appear across the admin.",
        control: "select",
        key: "dateFormat",
        options: [
          { value: "mm/dd/yyyy", label: "MM/DD/YYYY" },
          { value: "dd/mm/yyyy", label: "DD/MM/YYYY" },
          { value: "yyyy-mm-dd", label: "YYYY-MM-DD" },
        ],
      },
      {
        id: "week-start",
        title: "First day of week",
        description: "Used by calendars and date pickers.",
        control: "select",
        key: "weekStart",
        options: [
          { value: "monday", label: "Monday" },
          { value: "sunday", label: "Sunday" },
          { value: "saturday", label: "Saturday" },
        ],
      },
      {
        id: "auto-save",
        title: "Auto-save drafts",
        description: "Keep unsaved edits as you work.",
        control: "switch",
        key: "autoSaveDrafts",
        badge: { label: "Recommended", variant: "success-light" },
      },
      {
        id: "rich-text",
        title: "Rich text editing",
        description: "Show the formatting toolbar in text fields.",
        control: "switch",
        key: "richTextEditing",
        badge: { label: "Editor", variant: "focus-light" },
      },
    ],
  },
  {
    id: "display",
    title: "Display",
    items: [
      {
        id: "color-theme",
        title: "Color theme",
        description: "Applies everywhere, including the sidebar toggle.",
        control: "theme",
        options: [
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ],
      },
      {
        id: "sidebar-position",
        title: "Sidebar position",
        description: "Place the navigation on either side.",
        control: "select",
        key: "sidebarPosition",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
      },
      {
        id: "reduce-animations",
        title: "Reduce animations",
        description: "Minimize motion across the interface.",
        control: "switch",
        key: "reduceAnimations",
        badge: { label: "Accessibility", variant: "warning-light" },
      },
      {
        id: "show-tooltips",
        title: "Show tooltips",
        description: "Reveal helpful hints on hover.",
        control: "switch",
        key: "showTooltips",
      },
    ],
  },
]

// ── Security ──
//
// The same section/row grammar as the preferences matrix, with one extra control
// kind: an `action` row, whose button runs a handler rather than persisting a
// field (change password, sign other devices out).

type BooleanSecurityKey = {
  [K in keyof AccountSecurity]: AccountSecurity[K] extends boolean ? K : never
}[keyof AccountSecurity]

export const TWO_FACTOR_OPTIONS: SelectOption[] = [
  { value: "authenticator", label: "Authenticator app" },
  { value: "sms", label: "Text message" },
  { value: "security-key", label: "Security key" },
]

interface SecurityRowBase {
  id: string
  title: string
  description?: string
  badge?: { label: string; variant: BadgeProps["variant"] }
}

export interface SecuritySwitchRow extends SecurityRowBase {
  control: "switch"
  key: BooleanSecurityKey
}

export interface SecuritySelectRow extends SecurityRowBase {
  control: "select"
  key: "twoFactorMethod"
  options: SelectOption[]
  /** Only offered while two-factor is on: a method with nothing to protect is
   *  a setting the person cannot act on. */
  requiresTwoFactor?: boolean
}

export interface SecurityActionRow extends SecurityRowBase {
  control: "action"
  /** Which handler the page runs; the page owns what each one does. */
  action: "change-password" | "sign-out-others"
  actionLabel: string
}

export type SecurityRow =
  SecuritySwitchRow | SecuritySelectRow | SecurityActionRow

export interface SecuritySection {
  id: string
  title: string
  items: SecurityRow[]
}

export const SECURITY_SECTIONS: SecuritySection[] = [
  {
    id: "sign-in",
    title: "Sign-in",
    items: [
      {
        id: "password",
        title: "Password",
        control: "action",
        action: "change-password",
        actionLabel: "Change password",
      },
      {
        id: "two-factor",
        title: "Two-factor authentication",
        description: "Ask for a second step when signing in.",
        control: "switch",
        key: "twoFactorEnabled",
        badge: { label: "Recommended", variant: "success-light" },
      },
      {
        id: "two-factor-method",
        title: "Second step",
        description: "How the second step reaches you.",
        control: "select",
        key: "twoFactorMethod",
        options: TWO_FACTOR_OPTIONS,
        requiresTwoFactor: true,
      },
      {
        id: "passkey",
        title: "Passkey",
        description: "Sign in with this device instead of a password.",
        control: "switch",
        key: "passkeyEnabled",
        badge: { label: "Passwordless", variant: "focus-light" },
      },
    ],
  },
  {
    id: "activity",
    title: "Activity",
    items: [
      {
        id: "sign-in-alerts",
        title: "New sign-in alerts",
        description: "Email you when a new device signs in.",
        control: "switch",
        key: "signInAlerts",
      },
      {
        id: "sessions",
        title: "Active sessions",
        control: "action",
        action: "sign-out-others",
        actionLabel: "Sign out others",
      },
    ],
  },
]
