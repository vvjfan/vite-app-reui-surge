"use client"

import { Badge } from "@/components/reui/badge"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import {
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/reui/data-grid/data-grid-table"
import { type ColumnDef } from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { ProductRef } from "@/components/shared/product-ref"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { type ReorderRow, type ReorderStatus } from "./reorder-data"
import {
  ArchiveIcon,
  WarningIcon as TriangleAlertIcon,
  PackageIcon,
  TruckIcon,
  ClockIcon,
  DotsThreeIcon as MoreHorizontalIcon,
  EyeIcon,
  ShoppingCartIcon,
  GearSixIcon as Settings2Icon,
} from "@phosphor-icons/react"

// ── Status badge ──

const STATUS_CONFIG: Record<
  ReorderStatus,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  out_of_stock: { label: "Out of stock", variant: "destructive-light" },
  low_stock: { label: "Low stock", variant: "warning-light" },
}

export function StatusBadge({ status }: { status: ReorderStatus }) {
  const config = STATUS_CONFIG[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}

// ── Cells ──

export function ProductCell({ row }: { row: ReorderRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {row.thumbnail ? (
        <div className="relative shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border/60">
          <img
            src={row.thumbnail}
            alt={row.name}
            className="h-10 w-10 object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : (
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-border/60"
          aria-hidden="true"
        >
          <ArchiveIcon className="size-4" aria-hidden="true" />
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <ProductRef product={{ id: row.productId, title: row.name }} />
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
          <span className="truncate font-mono">{row.sku}</span>
          <span
            className="size-1 shrink-0 rounded-full bg-muted-foreground/40"
            aria-hidden="true"
          />
          <StatusBadge status={row.status} />
        </span>
      </div>
    </div>
  )
}

function MetricCell({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <span
      className={cn(
        "text-sm font-medium text-foreground tabular-nums",
        className
      )}
    >
      {value.toLocaleString()}
    </span>
  )
}

function DeficitCell({ deficit }: { deficit: number }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full text-sm font-medium text-destructive tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={`Deficit hint, ${deficit.toLocaleString()} units below reorder point`}
          />
        }
      >
        <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
        {deficit.toLocaleString()}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-52 p-2.5 text-xs leading-5">
        Reorder gap, units needed to reach the reorder point.
      </TooltipContent>
    </Tooltip>
  )
}

function SuggestedPoCell({ qty, onOrder }: { qty: number; onOrder: number }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge variant="secondary" className="tabular-nums">
        <PackageIcon className="size-3" aria-hidden="true" />
        {qty.toLocaleString()}
      </Badge>
      {/* What a raised PO already covers, so the suggested quantity above is the
          remaining gap, not a re-order of units on the way. */}
      {onOrder > 0 ? (
        <span className="text-xs text-muted-foreground tabular-nums">
          {onOrder.toLocaleString()} on order
        </span>
      ) : null}
    </div>
  )
}

function SupplierCell({ row }: { row: ReorderRow }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-sm font-medium text-foreground">
        {row.supplier}
      </span>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <TruckIcon className="size-3.5" aria-hidden="true" />
        {row.leadTimeDays}d lead
      </span>
    </div>
  )
}

function DaysOfCoverCell({ days }: { days: number }) {
  const critical = days < 7

  const content = (
    <>
      <ClockIcon className="size-3.5" aria-hidden="true" />
      {days === 0 ? "0 days" : `${days} days`}
    </>
  )

  if (!critical) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground tabular-nums">
        {content}
      </span>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full text-sm font-medium text-destructive tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={`Days of cover warning, ${days === 0 ? "0 days" : `${days} days`} remaining`}
          />
        }
      >
        {content}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-52 p-2.5 text-xs leading-5">
        Critical cover, create a PO before stock runs out.
      </TooltipContent>
    </Tooltip>
  )
}

function RowActionsCell({
  row,
  onView,
  onCreatePo,
  onEdit,
}: {
  row: ReorderRow
  onView: (row: ReorderRow) => void
  onCreatePo: (row: ReorderRow) => void
  onEdit: (row: ReorderRow) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Open actions for ${row.name}`}
          />
        }
      >
        <MoreHorizontalIcon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onView(row)}>
            <EyeIcon className="size-4" aria-hidden="true" />
            View detail
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCreatePo(row)}>
            <ShoppingCartIcon className="size-4" aria-hidden="true" />
            Create PO
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onEdit(row)}>
            <Settings2Icon className="size-4" aria-hidden="true" />
            Edit reorder point
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Columns ──

export function createReorderColumns({
  onView,
  onCreatePo,
  onEdit,
}: {
  onView: (row: ReorderRow) => void
  onCreatePo: (row: ReorderRow) => void
  onEdit: (row: ReorderRow) => void
}): ColumnDef<ReorderRow>[] {
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
      minSize: 260,
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
      accessorFn: (row) => row.available,
      id: "available",
      header: ({ column }) => (
        <DataGridColumnHeader title="Available" column={column} />
      ),
      cell: ({ row }) => <MetricCell value={row.original.available} />,
      size: 110,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-4 w-10" /> },
    },
    {
      accessorFn: (row) => row.reorderPoint,
      id: "reorderPoint",
      header: ({ column }) => (
        <DataGridColumnHeader title="Reorder point" column={column} />
      ),
      cell: ({ row }) => (
        <MetricCell
          value={row.original.reorderPoint}
          className="text-muted-foreground"
        />
      ),
      size: 130,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-4 w-10" /> },
    },
    {
      accessorFn: (row) => row.deficit,
      id: "deficit",
      header: ({ column }) => (
        <DataGridColumnHeader title="Deficit" column={column} />
      ),
      cell: ({ row }) => <DeficitCell deficit={row.original.deficit} />,
      size: 110,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-4 w-8" /> },
    },
    {
      accessorFn: (row) => row.suggestedPo,
      id: "suggestedPo",
      header: ({ column }) => (
        <DataGridColumnHeader title="Suggested PO" column={column} />
      ),
      cell: ({ row }) => (
        <SuggestedPoCell
          qty={row.original.suggestedPo}
          onOrder={row.original.onOrder}
        />
      ),
      size: 130,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-4 w-12" /> },
    },
    {
      accessorFn: (row) => row.supplier,
      id: "supplier",
      header: ({ column }) => (
        <DataGridColumnHeader title="Supplier" column={column} />
      ),
      cell: ({ row }) => <SupplierCell row={row.original} />,
      size: 190,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-4 w-28" /> },
    },
    {
      accessorFn: (row) => row.daysOfCover,
      id: "daysOfCover",
      header: ({ column }) => (
        <DataGridColumnHeader title="Days of cover" column={column} />
      ),
      cell: ({ row }) => <DaysOfCoverCell days={row.original.daysOfCover} />,
      size: 140,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-4 w-14" /> },
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <RowActionsCell
          row={row.original}
          onView={onView}
          onCreatePo={onCreatePo}
          onEdit={onEdit}
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
