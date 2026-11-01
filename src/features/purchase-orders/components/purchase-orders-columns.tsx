"use client"

import { type ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/reui/badge"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/features/products/lib/format"
import { formatOrderDate } from "@/features/orders/lib/format"
import type { StockLocation } from "@/lib/data/locations"
import {
  purchaseOrderDate,
  purchaseOrderTotal,
  purchaseOrderUnits,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from "@/lib/data/purchase-orders"
import {
  ProhibitIcon as BanIcon,
  DotsThreeIcon as MoreHorizontalIcon,
  PackageIcon as PackageCheckIcon,
} from "@phosphor-icons/react"

// ── Status badge ──

const STATUS_CONFIG: Record<
  PurchaseOrderStatus,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  draft: { label: "Draft", variant: "warning-light" },
  received: { label: "Received", variant: "success-light" },
  cancelled: { label: "Cancelled", variant: "secondary" },
}

export function PoStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const config = STATUS_CONFIG[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}

// ── Cells ──

function OrderCell({ order }: { order: PurchaseOrder }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="font-mono text-sm font-medium text-foreground">
        {order.id}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {order.supplierName}
      </span>
    </div>
  )
}

// The operative date reads differently per status, so the label says which.
function DateCell({ order }: { order: PurchaseOrder }) {
  const { label, iso } = purchaseOrderDate(order)
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm text-foreground tabular-nums">
        {formatOrderDate(iso)}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function RowActionsCell({
  order,
  onReceive,
  onCancel,
}: {
  order: PurchaseOrder
  onReceive: (order: PurchaseOrder) => void
  onCancel: (order: PurchaseOrder) => void
}) {
  // Only a draft can be received or cancelled; a settled PO has no actions, so
  // the trigger is hidden rather than opening an empty menu.
  if (order.status !== "draft") {
    return <div className="size-7" aria-hidden="true" />
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Open actions for ${order.id}`}
          />
        }
      >
        <MoreHorizontalIcon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onReceive(order)}>
            <PackageCheckIcon className="size-4" aria-hidden="true" />
            Receive
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onCancel(order)}
          >
            <BanIcon className="size-4" aria-hidden="true" />
            Cancel
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Columns ──

export function createPurchaseOrderColumns({
  locationsById,
  onReceive,
  onCancel,
}: {
  locationsById: Map<string, StockLocation>
  onReceive: (order: PurchaseOrder) => void
  onCancel: (order: PurchaseOrder) => void
}): ColumnDef<PurchaseOrder>[] {
  const nameOf = (id: string) =>
    locationsById.get(id)?.name ?? "Unknown location"
  return [
    {
      accessorKey: "id",
      id: "order",
      header: ({ column }) => (
        <DataGridColumnHeader title="Order" column={column} />
      ),
      cell: ({ row }) => <OrderCell order={row.original} />,
      minSize: 220,
      enableSorting: true,
      enableHiding: false,
      meta: {
        autoSize: true,
        headerClassName: "ps-(--frame-panel-px)",
        cellClassName: "ps-(--frame-panel-px)",
        skeleton: (
          <div className="flex min-w-0 flex-col gap-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ),
      },
    },
    {
      accessorFn: (row) => row.lines.length,
      id: "items",
      header: ({ column }) => (
        <DataGridColumnHeader title="Items" column={column} />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-foreground tabular-nums">
          {row.original.lines.length} SKU
          {row.original.lines.length === 1 ? "" : "s"} ·{" "}
          {purchaseOrderUnits(row.original).toLocaleString()} units
        </span>
      ),
      size: 170,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-4 w-24" /> },
    },
    {
      accessorFn: (row) => purchaseOrderTotal(row),
      id: "total",
      header: ({ column }) => (
        <DataGridColumnHeader title="Total" column={column} />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-medium text-foreground tabular-nums">
          {formatCurrency(purchaseOrderTotal(row.original))}
        </span>
      ),
      size: 120,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-4 w-16" /> },
    },
    {
      accessorFn: (row) => nameOf(row.locationId),
      id: "location",
      header: ({ column }) => (
        <DataGridColumnHeader title="Receive into" column={column} />
      ),
      cell: ({ row }) => (
        <span className="truncate text-sm text-muted-foreground">
          {nameOf(row.original.locationId)}
        </span>
      ),
      size: 160,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-4 w-24" /> },
    },
    {
      accessorFn: (row) => row.status,
      id: "status",
      header: ({ column }) => (
        <DataGridColumnHeader title="Status" column={column} />
      ),
      cell: ({ row }) => <PoStatusBadge status={row.original.status} />,
      size: 120,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-5 w-20 rounded-full" /> },
    },
    {
      accessorFn: (row) => purchaseOrderDate(row).iso,
      id: "date",
      header: ({ column }) => (
        <DataGridColumnHeader title="Date" column={column} />
      ),
      cell: ({ row }) => <DateCell order={row.original} />,
      size: 130,
      enableSorting: true,
      meta: { skeleton: <Skeleton className="h-4 w-20" /> },
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        // Stop the row's own click (which opens the detail sheet) so the menu
        // does not also open it.
        <div onClick={(e) => e.stopPropagation()}>
          <RowActionsCell
            order={row.original}
            onReceive={onReceive}
            onCancel={onCancel}
          />
        </div>
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
