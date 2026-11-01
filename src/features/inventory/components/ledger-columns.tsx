import { Badge } from "@/components/reui/badge"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import {
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/reui/data-grid/data-grid-table"
import { type ColumnDef, type Row } from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { ProductRef } from "@/components/shared/product-ref"
import { LocationRef } from "@/components/shared/location-ref"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { InventoryItem } from "@/lib/data/inventory"
import type { StockLocation } from "@/lib/data/locations"
import type { Supplier } from "@/lib/data/suppliers"
import type { StockRow } from "../queries"
import { statusVariant } from "./ledger-data"
import {
  PackageIcon,
  MapPinIcon,
  WarningIcon as TriangleAlertIcon,
  DotsThreeIcon as MoreHorizontalIcon,
  EyeIcon,
  PencilIcon,
  GearSixIcon as Settings2Icon,
  ArrowsLeftRightIcon as ArrowLeftRightIcon,
  ReceiptIcon as ReceiptTextIcon,
} from "@phosphor-icons/react"

// ── Cells ──

function ProductCell({ row }: { row: StockRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-border/60">
        {row.thumbnail ? (
          <img
            src={row.thumbnail}
            alt={row.name}
            className="h-10 w-10 object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <PackageIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <ProductRef product={{ id: row.productId, title: row.name }} />
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
          <span>SKU</span>
          <span
            className="size-1 shrink-0 rounded-full bg-muted-foreground/40"
            aria-hidden="true"
          />
          <span className="truncate font-mono">{row.sku}</span>
        </span>
      </div>
    </div>
  )
}

function LocationCell({
  row,
  locationsById,
}: {
  row: StockRow
  locationsById: Map<string, StockLocation>
}) {
  // The cell names the primary location, but the row's totals are summed across
  // every location it stocks. Naming one place and nothing else would read as
  // "all of it is here", so a multi-location row also carries how many other
  // places hold stock; the sheet is where those get named.
  const otherCount = row.levels.filter((level) => level.onHand > 0).length - 1
  const primaryLocation = locationsById.get(row.primaryLocationId)
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-sm text-foreground">
        <MapPinIcon
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        {primaryLocation ? (
          <LocationRef name={primaryLocation.name} />
        ) : (
          <span className="truncate">Unknown location</span>
        )}
        {row.isMultiLocation && otherCount > 0 ? (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            +{otherCount}
          </span>
        ) : null}
      </span>
      <span className="truncate font-mono text-xs text-muted-foreground">
        {row.bin}
      </span>
    </div>
  )
}

function NumberCell({ value, muted }: { value: number; muted?: boolean }) {
  return (
    <span
      className={cn(
        "text-sm font-medium tabular-nums",
        muted ? "text-muted-foreground" : "text-foreground"
      )}
    >
      {value.toLocaleString()}
    </span>
  )
}

function AvailableCell({ row }: { row: StockRow }) {
  const belowReorder = row.available <= row.reorderPoint
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium tabular-nums",
        belowReorder ? "text-warning-foreground" : "text-foreground"
      )}
    >
      {belowReorder ? (
        <TriangleAlertIcon
          className="size-3.5 shrink-0 text-warning"
          aria-hidden="true"
        />
      ) : null}
      {row.available.toLocaleString()}
    </span>
  )
}

function StatusCell({ status }: { status: InventoryItem["status"] }) {
  return <Badge variant={statusVariant[status]}>{status}</Badge>
}

function LedgerActionsCell({
  row,
  onView,
  onAdjust,
  onEdit,
  onTransfer,
  onCreatePO,
}: {
  row: Row<StockRow>
  onView: (item: StockRow) => void
  onAdjust: (item: StockRow) => void
  onEdit: (item: StockRow) => void
  onTransfer: (item: StockRow) => void
  onCreatePO: (item: StockRow) => void
}) {
  const item = row.original
  // Nothing can move off a row whose every unit is allocated or gone, so the
  // action is offered only when there is something to move.
  const canTransfer = item.available > 0
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Open actions for ${item.name}`}
          />
        }
      >
        <MoreHorizontalIcon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onView(item)}>
            <EyeIcon className="size-4" aria-hidden="true" />
            View ledger
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAdjust(item)}>
            <Settings2Icon className="size-4" aria-hidden="true" />
            Adjust stock
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(item)}>
            <PencilIcon className="size-4" aria-hidden="true" />
            Edit item
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canTransfer}
            onClick={() => onTransfer(item)}
          >
            <ArrowLeftRightIcon className="size-4" aria-hidden="true" />
            Transfer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onCreatePO(item)}>
            <ReceiptTextIcon className="size-4" aria-hidden="true" />
            Create PO
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Columns ──

export function createLedgerColumns({
  onView,
  onAdjust,
  onEdit,
  onTransfer,
  onCreatePO,
  locationsById,
}: {
  onView: (item: StockRow) => void
  onAdjust: (item: StockRow) => void
  onEdit: (item: StockRow) => void
  onTransfer: (item: StockRow) => void
  onCreatePO: (item: StockRow) => void
  locationsById: Map<string, StockLocation>
  suppliersById: Map<string, Supplier>
}): ColumnDef<StockRow>[] {
  return [
    {
      accessorKey: "id",
      id: "select",
      header: () => <DataGridTableRowSelectAll />,
      cell: ({ row }) => <DataGridTableRowSelect row={row} />,
      enableSorting: false,
      enableResizing: false,
      enableHiding: false,
      size: 36,
      meta: {
        headerClassName: "ps-(--frame-panel-px)",
        cellClassName: "ps-(--frame-panel-px)",
        skeleton: <Skeleton className="size-4 rounded" />,
      },
    },
    {
      accessorFn: (row) => row.name,
      id: "product",
      header: ({ column }) => (
        <DataGridColumnHeader title="Product" column={column} />
      ),
      cell: ({ row }) => <ProductCell row={row.original} />,
      minSize: 240,
      enableSorting: true,
      enableHiding: false,
      meta: {
        autoSize: true,
        skeleton: (
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 shrink-0 rounded" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ),
      },
    },
    {
      // Sort by the resolved primary name, not the opaque id.
      accessorFn: (row) => locationsById.get(row.primaryLocationId)?.name ?? "",
      id: "location",
      header: ({ column }) => (
        <DataGridColumnHeader title="Location" column={column} />
      ),
      cell: ({ row }) => (
        <LocationCell row={row.original} locationsById={locationsById} />
      ),
      size: 180,
      enableSorting: true,
      meta: {
        skeleton: (
          <div className="flex min-w-0 flex-col gap-0.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        ),
      },
    },
    {
      accessorFn: (row) => row.onHand,
      id: "onHand",
      header: ({ column }) => (
        <DataGridColumnHeader title="On hand" column={column} />
      ),
      cell: ({ row }) => <NumberCell value={row.original.onHand} />,
      size: 100,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-4 w-10" /> },
    },
    {
      accessorFn: (row) => row.allocated,
      id: "allocated",
      header: ({ column }) => (
        <DataGridColumnHeader title="Allocated" column={column} />
      ),
      cell: ({ row }) => <NumberCell value={row.original.allocated} muted />,
      size: 110,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-4 w-8" /> },
    },
    {
      accessorFn: (row) => row.available,
      id: "available",
      header: ({ column }) => (
        <DataGridColumnHeader title="Available" column={column} />
      ),
      cell: ({ row }) => <AvailableCell row={row.original} />,
      size: 120,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-4 w-12" /> },
    },
    {
      accessorFn: (row) => row.reorderPoint,
      id: "reorderPoint",
      header: ({ column }) => (
        <DataGridColumnHeader title="Reorder point" column={column} />
      ),
      cell: ({ row }) => <NumberCell value={row.original.reorderPoint} muted />,
      size: 130,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-4 w-10" /> },
    },
    {
      accessorFn: (row) => row.status,
      id: "status",
      header: ({ column }) => (
        <DataGridColumnHeader title="Status" column={column} />
      ),
      cell: ({ row }) => <StatusCell status={row.original.status} />,
      size: 130,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-5 w-20 rounded-sm" /> },
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <LedgerActionsCell
          row={row}
          onView={onView}
          onAdjust={onAdjust}
          onEdit={onEdit}
          onTransfer={onTransfer}
          onCreatePO={onCreatePO}
        />
      ),
      size: 50,
      enableSorting: false,
      enableResizing: false,
      meta: {
        headerClassName: "pr-(--frame-panel-px)",
        cellClassName: "pr-(--frame-panel-px)",
        skeleton: <Skeleton className="size-7 rounded" />,
      },
    },
  ]
}
