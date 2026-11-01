import type { ReactNode } from "react"

// The one icon container for the whole template: any icon that sits in a tile
// renders through this, never a per-page variant. The tile owns the glyph size,
// so callers pass a bare icon with no size class.
//
// The classes are the registry's icon container verbatim (solution-analytics-9):
// a muted plate behind the glyph, lifted off the surface by a white ring that
// the soft shadow makes readable, thinning to a hairline in dark mode.
export function IconTile({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border-2 border-background bg-muted shadow-[0_1px_3px_0_oklch(0.2_0.01_260/0.16)] dark:border [&_svg]:size-4 [&_svg]:text-accent-foreground">
      {children}
    </div>
  )
}
