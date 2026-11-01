import type { CSSProperties, ReactNode } from "react"

import { cn } from "@/lib/utils"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { AppHeader } from "./app-header"
import { AppSidebar } from "./app-sidebar"
import { RecordCrumbProvider } from "./page-crumb"

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <RecordCrumbProvider>
      <SidebarProvider
        className={cn(
          "flex flex-col",
          "[--sidebar:var(--color-background)]",
          "[--sidebar-accent:color-mix(in_oklab,var(--color-primary)_5%,transparent)]",
          "[--sidebar-accent-foreground:var(--color-primary)]"
        )}
        style={
          {
            "--sidebar-width": "260px",
            "--sidebar-width-icon": "62px",
            "--header-height": "50px",
          } as CSSProperties
        }
      >
        {/* Header */}
        <AppHeader />
        <div className="flex flex-1">
          <AppSidebar />
          {/* min-w-0 lets this flex item shrink below its content's intrinsic
            width, so wide data-grids scroll inside their own scroll area
            instead of pushing the page into horizontal overflow. */}
          <SidebarInset className="min-w-0">{children}</SidebarInset>
        </div>
      </SidebarProvider>
    </RecordCrumbProvider>
  )
}
