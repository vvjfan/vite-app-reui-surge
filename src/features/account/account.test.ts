import { describe, expect, it } from "vitest"

import {
  DEFAULT_ACCOUNT_PREFERENCES,
  DEFAULT_ACCOUNT_PROFILE,
} from "@/lib/data/account"
import {
  PREFERENCE_SECTIONS,
  ROLE_OPTIONS,
  TIMEZONE_GROUPS,
} from "@/features/account/data"

describe("account profile defaults", () => {
  it("seeds a role that exists in ROLE_OPTIONS", () => {
    expect(ROLE_OPTIONS.map((option) => option.value)).toContain(
      DEFAULT_ACCOUNT_PROFILE.role
    )
  })

  it("seeds a timezone that exists in TIMEZONE_GROUPS", () => {
    const timezones = TIMEZONE_GROUPS.flatMap((group) => group.items)
    expect(timezones).toContain(DEFAULT_ACCOUNT_PROFILE.timezone)
  })
})

describe("preference matrix", () => {
  const items = PREFERENCE_SECTIONS.flatMap((section) => section.items)

  it("binds every select/switch row to a preference default of the matching type", () => {
    for (const item of items) {
      if (item.control === "theme") continue
      const current = DEFAULT_ACCOUNT_PREFERENCES[item.key]
      expect(current, `missing default for ${item.key}`).toBeDefined()
      expect(typeof current).toBe(
        item.control === "select" ? "string" : "boolean"
      )
    }
  })

  it("keeps every select's default value within its listed options", () => {
    for (const item of items) {
      if (item.control !== "select") continue
      const values = item.options.map((option) => option.value)
      expect(values, `${item.key} default not in options`).toContain(
        DEFAULT_ACCOUNT_PREFERENCES[item.key]
      )
    }
  })

  it("has unique row ids", () => {
    const ids = items.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("routes exactly one control to the theme (ThemeProvider owns it)", () => {
    expect(items.filter((item) => item.control === "theme")).toHaveLength(1)
  })
})
