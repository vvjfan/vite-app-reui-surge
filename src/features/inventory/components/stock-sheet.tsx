import type { ReactNode } from "react"

import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"

// The shared shell for every inventory sheet: a floating, inset, rounded right
// drawer. The inset and size land on `data-[side=right]:` so they beat the
// SheetContent primitive's own side classes, which otherwise pin the panel flush
// to the edges and drop the outer margin.
//
// Kept in one place so Adjust stock, Transfer stock, Edit item, and Stock detail
// share one panel exactly, rather than four copies of the same long class list
// drifting apart.
// z-50 is the app's modal layer (the SheetContent primitive, dialogs, and every
// popup). It must NOT be raised above that: base-ui portals a Select/Combobox
// popup opened inside the sheet into the sheet's own portal, so a higher z here
// paints the panel over the open dropdown and it reads as "not opening".
export const STOCK_SHEET_CONTENT_CLASS =
  "z-50 flex flex-col gap-0 overflow-hidden rounded-xl bg-popover p-0 outline-none data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:left-auto data-[side=right]:h-[calc(100svh-2rem)] data-[side=right]:w-[min(30rem,calc(100vw-2rem))] data-[side=right]:max-w-none data-[side=right]:sm:max-w-none"

// A card inside a sheet drops its shadow: it reads by its border, not a float of
// its own.
const FRAME_PANEL_RESET = "shadow-none!"

// SectionCard: one dense Frame card. Every block in an inventory sheet panel is
// one of these, so the panels keep a single card rhythm top to bottom - the same
// rhythm the Stock detail (ledger) sheet stacks its cards in.
export function SectionCard({
  label,
  children,
}: {
  label?: string
  children: ReactNode
}) {
  return (
    <Frame dense spacing="sm" className="w-full">
      {label ? (
        <FrameHeader>
          <FrameTitle className="text-sm">{label}</FrameTitle>
        </FrameHeader>
      ) : null}
      <FramePanel className={FRAME_PANEL_RESET}>{children}</FramePanel>
    </Frame>
  )
}
