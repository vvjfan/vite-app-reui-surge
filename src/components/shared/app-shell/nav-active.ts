import { NAV_MAIN } from "./data"
import type { NavChild, NavItem } from "./data"

// A declared nav href matches a pathname if it is the path itself or an
// ancestor of it (so detail routes keep their section active). "/" matches
// only the exact root.
function hrefMatches(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

// Every href declared in the nav tree (top-level leaves + group children).
function allNavHrefs() {
  const hrefs: string[] = []
  for (const item of NAV_MAIN) {
    if (item.href) hrefs.push(item.href)
    for (const child of item.children ?? []) hrefs.push(child.href)
  }
  return hrefs
}

// The one active nav href for a pathname: the longest declared href that
// matches. This makes a sub-route (e.g. /inventory/reorder) win over its
// sibling section root (/inventory) so exactly one item is highlighted.
export function activeNavHref(pathname: string): string {
  let best = ""
  for (const href of allNavHrefs()) {
    if (hrefMatches(pathname, href) && href.length > best.length) best = href
  }
  return best
}

// The item's own destination: a leaf's href, or a group's first child so the
// section dropdown can navigate to a landing page.
export function navItemHref(item: NavItem): string {
  return item.href ?? item.children?.[0]?.href ?? "/"
}

// The active top-level area for a pathname, plus the active child when that
// area is a collapsible group. Drives the breadcrumb section + sub-page
// dropdowns. Returns null when nothing matches.
export function activeNavTrail(
  pathname: string
): { item: NavItem; child?: NavChild } | null {
  const active = activeNavHref(pathname)
  for (const item of NAV_MAIN) {
    if (item.href && item.href === active) return { item }
    const child = item.children?.find((c) => c.href === active)
    if (child) return { item, child }
  }
  return null
}
