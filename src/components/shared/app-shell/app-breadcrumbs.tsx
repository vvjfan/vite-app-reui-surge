import { Fragment } from "react"
import { Link, useRouterState } from "@tanstack/react-router"

import { cn } from "@/lib/utils"
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { activeNavTrail, navItemHref } from "./nav-active"
import { useRecordCrumbLabel } from "./page-crumb"

// ── App Breadcrumbs ──
// A passive "you are here" trail, not navigation. The left sidebar already owns
// browse-nav (top-level areas + their children with active highlighting), so the
// header states location instead of re-listing those same targets as dropdowns:
// the active area, then its active child, then the record when you are on one.
//
// Rendered inside the header's shared BreadcrumbList, after the store switcher.
//
// Every segment above the last one links to its own destination; the last is a
// non-interactive BreadcrumbPage carrying aria-current. That distinction used to
// be wrong on record routes - /categories/tees resolved to the Categories
// section and rendered IT as the current page, so the header claimed you were on
// the list you had just navigated out of, and offered no way back to it. The
// record segment comes from the page itself (see useRecordCrumb): the nav tree
// knows declared hrefs, not the name of a row.

export function AppBreadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const trail = activeNavTrail(pathname)
  const record = useRecordCrumbLabel()
  if (!trail) return null

  const { item, child } = trail

  // Built as a list so the "last one is the current page" and "only the last one
  // survives a phone" rules are stated once, rather than re-derived per depth.
  const crumbs: { label: string; href: string }[] = [
    { label: item.label, href: navItemHref(item) },
  ]
  if (child) crumbs.push({ label: child.label, href: child.href })
  // A record has no href of its own to link to - it IS the current page, and the
  // last crumb never renders as a link.
  if (record) crumbs.push({ label: record, href: "" })

  return (
    <>
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1
        return (
          <Fragment key={`${crumb.href}-${crumb.label}`}>
            <BreadcrumbSeparator
              className={cn(
                "text-xs text-muted-foreground",
                // Only the first separator survives a phone: it divides the
                // trail from the store switcher, which never hides. The rest
                // would strand a "/" next to the hidden ancestors.
                index > 0 && "hidden sm:block"
              )}
            >
              /
            </BreadcrumbSeparator>
            {isLast ? (
              // The last segment is the one that gives, so a long record label
              // truncates rather than shoving the status badge off the row.
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate">
                  {crumb.label}
                </BreadcrumbPage>
              </BreadcrumbItem>
            ) : (
              // Ancestors go away on the narrowest screens, leaving the store
              // switcher and the page you are actually on. They are what can be
              // dropped without losing where you are: the sidebar already
              // highlights the area, and the trail is passive anyway. The full
              // trail plus the store status badge does not fit across a phone,
              // and wrapping it is what pushed it out of the fixed-height header.
              <BreadcrumbItem className="hidden sm:inline-flex">
                <BreadcrumbLink render={<Link to={crumb.href} />}>
                  {crumb.label}
                </BreadcrumbLink>
              </BreadcrumbItem>
            )}
          </Fragment>
        )
      })}
    </>
  )
}
