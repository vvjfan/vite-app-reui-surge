import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/ui/sidebar"

export function SidebarRailToggle() {
  const { state, toggleSidebar } = useSidebar()
  const isExpanded = state === "expanded"

  return (
    <button
      type="button"
      aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
      onClick={toggleSidebar}
      style={{
        left: isExpanded ? "var(--sidebar-width)" : "var(--sidebar-width-icon)",
      }}
      className={cn(
        "group/rail fixed z-30 flex h-12 w-7 cursor-pointer items-center pl-2 outline-none",
        "top-[calc(var(--header-height)+50%)] -translate-y-1/2",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "focus-visible:rounded-sm",
        "transition-[left] duration-200 ease-linear"
      )}
    >
      <span className="flex flex-col items-center">
        <span
          aria-hidden="true"
          className={cn(
            "block h-2 w-0.5 rounded-t-full bg-foreground/40",
            "origin-bottom transition-all duration-100 ease-linear",
            isExpanded
              ? "group-hover/rail:rotate-40 group-hover/rail:bg-foreground/60"
              : "group-hover/rail:-rotate-40 group-hover/rail:bg-foreground/60"
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "block h-2 w-0.5 rounded-b-full bg-foreground/40",
            "origin-top transition-all duration-100 ease-linear",
            isExpanded
              ? "group-hover/rail:-rotate-40 group-hover/rail:bg-foreground/60"
              : "group-hover/rail:rotate-40 group-hover/rail:bg-foreground/60"
          )}
        />
      </span>

      <span
        className={cn(
          "absolute left-full -ml-2 border border-border bg-foreground px-2 py-0.5 text-xs font-medium whitespace-nowrap text-background shadow-xs shadow-black/5",
          "rounded-md",
          "pointer-events-none -translate-x-0.5 opacity-0 transition-all duration-200 ease-out",
          "group-hover/rail:translate-x-0 group-hover/rail:opacity-100"
        )}
      >
        {isExpanded ? "Collapse" : "Expand"}
      </span>
    </button>
  )
}
