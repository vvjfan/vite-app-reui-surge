import { type ReactNode } from "react"

import type { BadgeProps } from "@/components/reui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type {
  MovementKind,
  StockMovement,
  StockStatus,
} from "@/lib/data/inventory"
import type { StockRow } from "../queries"
import {
  ArrowsLeftRightIcon as ArrowLeftRightIcon,
  ArrowUpIcon,
  CheckCircleIcon as CircleCheckIcon,
  PackageIcon,
  GearSixIcon as Settings2Icon,
} from "@phosphor-icons/react"

// Presentational config for the stock ledger. This is the CODE half of the
// donor block's data module: badge tones, filter options, the search blob, the
// movement icon/tone maps, the author avatar, and toast icons. The DATA half
// (rows, lots, movements, metrics) lives in the demo store instead.

// ── Toast icons ──

export const TOAST_SUCCESS_ICON = (
  <CircleCheckIcon className="size-[18px] text-success" aria-hidden="true" />
)

// ── Badge tone map ──

export const statusVariant: Record<StockStatus, BadgeProps["variant"]> = {
  "In stock": "success-light",
  "Low stock": "warning-light",
  "Out of stock": "destructive-light",
  Backordered: "destructive-light",
  Discontinued: "secondary",
}

// ── Filter options (leading "all" entry is the placeholder label) ──
//
// Category, supplier, and location options are NOT listed here: they are user
// data, so they derive from the store (see ../hooks/use-filter-options). Status
// stays in code because StockStatus is a closed union, not something a client
// adds to.

export const STATUS_OPTIONS: { value: StockStatus | "all"; label: string }[] = [
  { value: "all", label: "Status" },
  { value: "In stock", label: "In stock" },
  { value: "Low stock", label: "Low stock" },
  { value: "Out of stock", label: "Out of stock" },
  { value: "Backordered", label: "Backordered" },
  { value: "Discontinued", label: "Discontinued" },
]

/**
 * Rows reference locations by id, so the caller resolves the names and passes
 * them in; searching "Brooklyn" should still find the row.
 *
 * Every name the row holds stock at is searchable, not just the primary one:
 * the row IS at East DC, so "East DC" has to find it even when the grid names
 * somewhere else. Bins come off the levels for the same reason.
 */
export function getStockSearchBlob(
  item: StockRow,
  locationNames: readonly string[],
  // Resolved by the caller: the row carries a supplierId, but a person
  // searching this grid types the supplier's name.
  supplier: string
) {
  return [
    item.name,
    item.sku,
    item.category,
    supplier,
    ...locationNames,
    ...item.levels.map((level) => level.bin),
  ]
    .join(" ")
    .toLowerCase()
}

// ── Detail sheet: fact rows ──

export interface StockFact {
  label: string
  value: ReactNode
  mono?: boolean
}

// ── Movement timeline: icon + tone maps ──

export const movementKindIcon: Record<MovementKind, ReactNode> = {
  Restock: <PackageIcon aria-hidden="true" />,
  Sale: <ArrowUpIcon aria-hidden="true" />,
  Adjustment: <Settings2Icon aria-hidden="true" />,
  Transfer: <ArrowLeftRightIcon aria-hidden="true" />,
}

// Filled tinted indicators, the grammar sheet-11's activity timeline uses. Base
// tints only (no dark: override): a token's /10 fill tracks the theme on its own.
export const movementKindIndicatorClass: Record<MovementKind, string> = {
  Restock: "border-success/20 bg-success/10 text-success",
  Sale: "border-border bg-muted text-muted-foreground",
  Adjustment: "border-warning/20 bg-warning/10 text-warning",
  Transfer: "border-info/20 bg-info/10 text-info",
}

export function MovementAuthorAvatar({
  author,
}: {
  author: StockMovement["author"]
}) {
  return (
    <Avatar className="size-5">
      {author.avatar ? (
        <AvatarImage src={author.avatar} alt={author.name} />
      ) : null}
      <AvatarFallback className="text-[9px]">{author.initials}</AvatarFallback>
    </Avatar>
  )
}
