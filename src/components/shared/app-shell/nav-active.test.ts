import { describe, it, expect } from "vitest"

import { NAV_MAIN } from "./data"
import { activeNavHref, activeNavTrail, navItemHref } from "./nav-active"

const byId = (id: string) => {
  const item = NAV_MAIN.find((i) => i.id === id)
  if (!item) throw new Error(`nav item "${id}" not found`)
  return item
}

describe("activeNavHref (longest-prefix match)", () => {
  it("matches the root only exactly", () => {
    expect(activeNavHref("/")).toBe("/")
    // a deeper path must not fall back to the root
    expect(activeNavHref("/orders")).not.toBe("/")
  })

  it("keeps a leaf active on its detail routes", () => {
    expect(activeNavHref("/orders")).toBe("/orders")
    expect(activeNavHref("/orders/123")).toBe("/orders")
  })

  it("prefers the longest declared href for nested siblings", () => {
    // regression guard: a group-index route must not stay active on its
    // sibling sub-route, and vice versa.
    expect(activeNavHref("/inventory")).toBe("/inventory")
    expect(activeNavHref("/inventory/reorder")).toBe("/inventory/reorder")
    expect(activeNavHref("/settings")).toBe("/settings")
    expect(activeNavHref("/settings/team")).toBe("/settings/team")
  })

  it("returns an empty string when nothing matches", () => {
    expect(activeNavHref("/does-not-exist")).toBe("")
  })
})

describe("activeNavTrail", () => {
  it("resolves a top-level leaf with no child", () => {
    expect(activeNavTrail("/")).toMatchObject({ item: { id: "dashboard" } })
    expect(activeNavTrail("/")?.child).toBeUndefined()
    expect(activeNavTrail("/orders")).toMatchObject({ item: { id: "orders" } })
    expect(activeNavTrail("/orders")?.child).toBeUndefined()
  })

  it("resolves the active child inside a group", () => {
    expect(activeNavTrail("/inventory")).toMatchObject({
      item: { id: "inventory" },
      child: { id: "inv-stock" },
    })
    expect(activeNavTrail("/inventory/reorder")).toMatchObject({
      item: { id: "inventory" },
      child: { id: "inv-reorder" },
    })
    expect(activeNavTrail("/settings/team")).toMatchObject({
      item: { id: "settings" },
      child: { id: "set-team" },
    })
  })

  it("returns null for an unknown route", () => {
    expect(activeNavTrail("/does-not-exist")).toBeNull()
  })
})

describe("navItemHref", () => {
  it("returns a leaf's own href", () => {
    expect(navItemHref(byId("orders"))).toBe("/orders")
  })

  it("returns a group's first child href", () => {
    expect(navItemHref(byId("inventory"))).toBe("/inventory")
    expect(navItemHref(byId("settings"))).toBe("/settings")
  })
})
