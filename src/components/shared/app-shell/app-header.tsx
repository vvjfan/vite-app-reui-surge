import { useState } from "react"

import { cn } from "@/lib/utils"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { AppBreadcrumbs } from "./app-breadcrumbs"
import { WORKSPACES } from "./data"
import {
  DEFAULT_STORE_PROFILE,
  STORE_PROFILE_KEY,
  type StoreProfile,
} from "@/features/settings/components/general/data"
import { useSetting } from "@/features/settings/queries"
import { Logo } from "./logo"
import { StoreStatus } from "./store-status"
import {
  CaretUpDownIcon as ChevronsUpDownIcon,
  CheckIcon,
  PlusIcon,
} from "@phosphor-icons/react"

// ── Store Switcher ──

function StoreSwitcher() {
  const [activeStore, setActiveStore] = useState(WORKSPACES[0])
  // Reflect the saved store profile name on the primary store. Read only from
  // the store: `isPending` until the client's first read settles, so the name
  // shows a skeleton rather than the in-code default before it resolves.
  const { data: profile, isPending } = useSetting<StoreProfile>(
    STORE_PROFILE_KEY,
    DEFAULT_STORE_PROFILE
  )
  const storeName = profile?.name ?? DEFAULT_STORE_PROFILE.name
  const isPrimary = activeStore.id === WORKSPACES[0].id

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="text-foreground" />
        }
      >
        <activeStore.Logo className="size-3" />
        {isPrimary && isPending ? (
          <Skeleton className="hidden h-4 w-24 sm:block" />
        ) : (
          <span className="sr-only sm:not-sr-only">
            {isPrimary ? storeName : activeStore.name}
          </span>
        )}
        <ChevronsUpDownIcon
          className="size-3.5 opacity-60"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={8} className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Stores</DropdownMenuLabel>
          <DropdownMenuGroup>
            {WORKSPACES.map((store) => (
              <DropdownMenuItem
                key={store.id}
                onClick={() => setActiveStore(store)}
                className={cn(activeStore.id === store.id && "bg-accent")}
              >
                <store.Logo className="size-5 shrink-0" />
                <div className="flex min-w-0 flex-col">
                  {store.id === WORKSPACES[0].id && isPending ? (
                    <Skeleton className="h-4 w-24" />
                  ) : (
                    <span className="truncate text-sm">
                      {store.id === WORKSPACES[0].id ? storeName : store.name}
                    </span>
                  )}
                  <span className="truncate text-xs text-muted-foreground">
                    {store.tier}
                  </span>
                </div>
                {activeStore.id === store.id && (
                  <CheckIcon
                    className="ml-auto size-4 text-primary"
                    aria-hidden="true"
                  />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <PlusIcon aria-hidden="true" />
            Create store
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Site Header ──

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 flex w-full items-center border-b bg-background">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
        {/* Mobile sidebar trigger */}
        <SidebarTrigger className="md:hidden" />

        {/* Logo */}
        <div className="hidden items-center pl-0.5 md:flex">
          <Logo />
        </div>

        {/* Store switcher (a real scope switch) + a passive location trail. Nav
            itself lives in the sidebar, so the trail never re-lists nav targets. */}
        {/* min-w-0 + flex-nowrap: the row is a fixed h-(--header-height), so a
            trail that wraps spills past the border instead of pushing the header
            taller. It shrinks and truncates instead - see AppBreadcrumbs, which
            drops the ancestor segment on the narrowest screens. */}
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap gap-2">
            {/* The list gap is measured between BOXES, and every trail segment
                is bare text - except this one, a Button whose own px-2.5 sits
                inside its box. That padding lands on top of the gap, so the
                space after the store read ~19px against the trail's 8px. This
                pulls the rest of the trail back over the button's trailing
                padding, while the button keeps its own size and hover target.
                Stops at -2, not the full -2.5: one more pixel and the button's
                hover fill would paint under the "/" glyph, whose ink is only
                ~4px wide. */}
            <BreadcrumbItem className="-me-2">
              <StoreSwitcher />
            </BreadcrumbItem>
            <AppBreadcrumbs />
          </BreadcrumbList>
        </Breadcrumb>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1">
          <StoreStatus />
        </div>
      </div>
    </header>
  )
}
