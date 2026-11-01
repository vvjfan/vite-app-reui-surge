import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"

import { NEWS_ARTICLES } from "./data"
import { NavMain } from "./nav-main"
import { NavUser } from "./nav-user"
import { SearchForm } from "./search-form"
import { SidebarNews } from "./sidebar-news"
import { SidebarRailToggle } from "./sidebar-rail-toggle"

// ── App Sidebar ──

export function AppSidebar() {
  const { isMobile } = useSidebar()

  return (
    <Sidebar
      collapsible="icon"
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
    >
      {/* Header */}
      <SidebarHeader className="flex flex-row items-center px-4 in-data-[state=collapsed]:flex-col in-data-[state=collapsed]:items-start in-data-[state=collapsed]:justify-center">
        <div className="w-full flex-1 pt-2">
          <SearchForm />
        </div>
      </SidebarHeader>

      {/* Sidebar */}
      <SidebarContent className="gap-2 px-2">
        <NavMain />

        <div className="mt-auto">
          <SidebarNews articles={NEWS_ARTICLES} />
        </div>
      </SidebarContent>

      {/* Footer */}
      {/* customize: mt-2 keeps a fixed gap above the footer so the news card never butts against it when the viewport shrinks and the content scrolls */}
      <SidebarFooter className="mt-2 px-4">
        <NavUser />
      </SidebarFooter>

      {!isMobile && <SidebarRailToggle />}
    </Sidebar>
  )
}
