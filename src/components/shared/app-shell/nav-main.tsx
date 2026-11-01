import { useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"

import { cn } from "@/lib/utils"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { NAV_GROUPS } from "./data"
import type { NavChild, NavGroup, NavItem } from "./data"
import { activeNavHref } from "./nav-active"
import { CaretRightIcon as ChevronRightIcon } from "@phosphor-icons/react"

// ── Nav Sub Items ──

function NavSubItem({
  child,
  activeHref,
}: {
  child: NavChild
  activeHref: string
}) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        render={<Link to={child.href} />}
        isActive={child.href === activeHref}
      >
        {child.label}
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function NavSubMenu({
  id,
  items,
  activeHref,
}: {
  id: string
  items: NavChild[]
  activeHref: string
}) {
  return (
    <SidebarMenuSub id={`subnav-${id}`}>
      {items.map((child) => (
        <NavSubItem key={child.id} child={child} activeHref={activeHref} />
      ))}
    </SidebarMenuSub>
  )
}

// ── Collapsible Nav Item ──

function CollapsibleNavItem({
  item,
  activeHref,
}: {
  item: NavItem & { children: NavChild[] }
  activeHref: string
}) {
  const childActive = item.children.some((c) => c.href === activeHref)
  const [open, setOpen] = useState(childActive)

  // The sidebar persists across client-side navigation, so open state must
  // react to the route: auto-expand when we land inside this group (e.g. via
  // the breadcrumb section dropdown). Manual collapse still works until the
  // next navigation into the group.
  const resetInputs1 = [childActive] as const
  const [previousInputs1, setPreviousInputs1] = useState<
    typeof resetInputs1 | null
  >(null)
  if (
    previousInputs1 === null ||
    resetInputs1.some(
      (input, index) => !Object.is(input, previousInputs1[index])
    )
  ) {
    setPreviousInputs1(resetInputs1)

    if (childActive) setOpen(true)
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.label}
        isActive={childActive}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={`subnav-${item.id}`}
      >
        {item.icon}
        <span>{item.label}</span>
        <ChevronRightIcon
          className={cn(
            "ml-auto size-4 shrink-0 opacity-60 transition-transform duration-200 group-data-[collapsible=icon]:hidden",
            open && "rotate-90"
          )}
          aria-hidden="true"
        />
      </SidebarMenuButton>

      {open && (
        <NavSubMenu
          id={item.id}
          items={item.children}
          activeHref={activeHref}
        />
      )}
    </SidebarMenuItem>
  )
}

// ── Leaf Nav Item ──

function LeafNavItem({
  item,
  activeHref,
}: {
  item: NavItem
  activeHref: string
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.label}
        isActive={item.href === activeHref}
        render={<Link to={item.href ?? "/"} />}
      >
        {item.icon}
        <span>{item.label}</span>
        {item.badge !== undefined && (
          <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

// ── Nav Group ──

function NavGroupSection({
  group,
  activeHref,
}: {
  group: NavGroup
  activeHref: string
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="in-data-[state=collapsed]:hidden">
        {group.label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.25">
          {group.items.map((item) =>
            item.children ? (
              <CollapsibleNavItem
                key={item.id}
                item={item as NavItem & { children: NavChild[] }}
                activeHref={activeHref}
              />
            ) : (
              <LeafNavItem key={item.id} item={item} activeHref={activeHref} />
            )
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

// ── Nav Main ──

export function NavMain() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const activeHref = activeNavHref(pathname)

  return (
    <>
      {NAV_GROUPS.map((group) => (
        <NavGroupSection key={group.id} group={group} activeHref={activeHref} />
      ))}
    </>
  )
}
