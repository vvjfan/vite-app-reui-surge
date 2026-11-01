import { memo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { Badge } from "@/components/reui/badge"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import {
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/reui/data-grid/data-grid-table"
import { DataGridTableDndRowHandle } from "@/components/reui/data-grid/data-grid-table-dnd-rows"
import type { ColumnDef, Row } from "@tanstack/react-table"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  PROMOTION_STATUS_META,
  summarizePromotion,
  type Promotion,
  type PromotionStatus,
} from "@/lib/data/promotions"
import { useDeletePromotion, useUpdatePromotion } from "../queries"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  CheckIcon,
  DotsThreeIcon as MoreHorizontalIcon,
  PencilIcon,
  CopyIcon,
  CheckCircleIcon as CircleCheckIcon,
  PauseCircleIcon as CirclePauseIcon,
  TrashIcon as Trash2Icon,
} from "@phosphor-icons/react"

// The code cell copies on click, the way a customer would lift it from an admin
// to paste into support. The icon is the affordance and the tick is the receipt:
// it swaps in on copy and the tooltip says so, then both settle back.
function PromoCodeCell({ code, name }: { code: string; name: string }) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 1500 })
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                copyToClipboard(code)
              }}
              aria-label={`Copy code ${code}`}
              className="group/code -ms-1 flex w-fit min-w-0 items-center gap-1.5 rounded px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            />
          }
        >
          <span className="truncate font-mono text-sm font-medium text-foreground">
            {code}
          </span>
          {isCopied ? (
            <CheckIcon
              className="size-3.5 shrink-0 text-success"
              aria-hidden="true"
            />
          ) : (
            <CopyIcon
              className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/code:opacity-100"
              aria-hidden="true"
            />
          )}
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {isCopied ? "Copied" : "Copy code"}
        </TooltipContent>
      </Tooltip>
      <span className="truncate text-xs text-muted-foreground">{name}</span>
    </div>
  )
}

// ── Formatting ──

const scheduleFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

function formatScheduleDate(iso: string): string {
  return scheduleFmt.format(new Date(iso))
}

// ── Status badge (reused by the grid's filter chip) ──

export const StatusBadge = memo(function StatusBadge({
  status,
}: {
  status: PromotionStatus
}) {
  const meta = PROMOTION_STATUS_META[status]
  return <Badge variant={meta.variant}>{meta.label}</Badge>
})

// ── Row actions ──

export function ActionsCell({ row }: { row: Row<Promotion> }) {
  const { copyToClipboard } = useCopyToClipboard()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const promotion = row.original
  const navigate = useNavigate()
  const updatePromotion = useUpdatePromotion()
  const deletePromotion = useDeletePromotion()

  const handleCopyCode = () => {
    copyToClipboard(promotion.code)
    toast.success("Promotion code copied", { description: promotion.code })
  }

  // The full-page editor is the detail route, so Edit is a navigation.
  const handleEdit = () => {
    navigate({
      to: "/promotions/$promotionId",
      params: { promotionId: promotion.id },
    })
  }

  const handleSetStatus = (status: PromotionStatus, label: string) => {
    updatePromotion.mutate(
      { id: promotion.id, patch: { status } },
      {
        onSuccess: () => toast.success(label, { description: promotion.code }),
      }
    )
  }

  const handleDeleteConfirm = () => {
    setDeleteOpen(false)
    deletePromotion.mutate(promotion.id, {
      onSuccess: () =>
        toast.success("Promotion deleted", { description: promotion.code }),
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Promotion actions"
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start" className="min-w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={handleEdit}>
              <PencilIcon className="size-4" aria-hidden="true" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyCode}>
              <CopyIcon className="size-4" aria-hidden="true" />
              Copy code
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={promotion.status === "active"}
              onClick={() => handleSetStatus("active", "Promotion enabled")}
            >
              <CircleCheckIcon className="size-4" aria-hidden="true" />
              Enable
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={promotion.status === "draft"}
              onClick={() => handleSetStatus("draft", "Promotion disabled")}
            >
              <CirclePauseIcon className="size-4" aria-hidden="true" />
              Disable
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon className="size-4" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this promotion?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-mono text-foreground">
                {promotion.code}
              </span>{" "}
              from your store. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep promotion</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              Delete promotion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Columns ──

export const columns: ColumnDef<Promotion>[] = [
  {
    id: "drag",
    header: "",
    // The row itself navigates on click; the handle only drags.
    cell: () => (
      <div onClick={(e) => e.stopPropagation()}>
        <DataGridTableDndRowHandle />
      </div>
    ),
    enableSorting: false,
    enableResizing: false,
    enableHiding: false,
    // Sized to the handle (default 8px inset + the 28px grip) with its trailing
    // pad dropped, so the grip does not float in a wide cell away from the
    // checkbox that follows it.
    size: 36,
    meta: {
      cellClassName: "pe-0!",
      skeleton: <Skeleton className="size-7 rounded" />,
    },
  },
  {
    accessorKey: "id",
    id: "id",
    header: () => <DataGridTableRowSelectAll />,
    cell: ({ row }) => <DataGridTableRowSelect row={row} />,
    enableSorting: false,
    size: 35,
    enableResizing: false,
    enableHiding: false,
    // The frame inset is already spent by the drag column ahead of it, so the
    // checkbox only needs a small gap off the grip, not the full panel pad.
    meta: {
      skeleton: <Skeleton className="size-4 rounded" />,
      headerClassName: "ps-1.5!",
      cellClassName: "ps-1.5!",
    },
  },
  {
    accessorFn: (row) => row.code,
    id: "promotion",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => (
      <PromoCodeCell code={row.original.code} name={row.original.name} />
    ),
    minSize: 160,
    enableSorting: true,
    enableHiding: false,
    enableResizing: true,
    meta: {
      headerTitle: "Code",
      skeleton: (
        <div className="flex min-w-0 flex-col gap-0.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      ),
    },
  },
  {
    accessorFn: (row) => summarizePromotion(row),
    id: "type",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => (
      <span className="block truncate text-sm font-medium text-foreground">
        {summarizePromotion(row.original)}
      </span>
    ),
    size: 180,
    enableSorting: true,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Type",
      skeleton: <Skeleton className="h-3.5 w-24" />,
    },
  },
  {
    accessorFn: (row) => row.status,
    id: "status",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    size: 120,
    enableSorting: true,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Status",
      skeleton: <Skeleton className="h-5 w-20 rounded-sm" />,
    },
  },
  {
    accessorFn: (row) => row.usedCount,
    id: "usage",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => {
      const { usedCount, usageLimit } = row.original
      return (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground tabular-nums">
            {usedCount.toLocaleString()}
            {usageLimit !== null && ` / ${usageLimit.toLocaleString()}`}
          </span>
          <span className="text-xs text-muted-foreground">
            {usageLimit === null ? "Unlimited" : "used"}
          </span>
        </div>
      )
    },
    size: 120,
    enableSorting: true,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Usage",
      skeleton: (
        <div className="flex flex-col gap-0.5">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      ),
    },
  },
  {
    accessorFn: (row) => row.startsAt ?? "",
    id: "schedule",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => {
      const { startsAt, endsAt } = row.original
      return (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm text-foreground tabular-nums">
            {startsAt ? formatScheduleDate(startsAt) : "Not scheduled"}
          </span>
          <span className="truncate text-xs text-muted-foreground tabular-nums">
            {endsAt ? `to ${formatScheduleDate(endsAt)}` : "No end"}
          </span>
        </div>
      )
    },
    size: 150,
    enableSorting: true,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Schedule",
      skeleton: (
        <div className="flex flex-col gap-0.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      ),
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <ActionsCell row={row} />,
    size: 50,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    meta: {
      skeleton: <Skeleton className="size-7 rounded" />,
      headerClassName:
        "[--data-grid-header-cell-pe:var(--frame-panel-header-px)]",
      cellClassName: "[--data-grid-body-cell-pe:var(--frame-panel-px)]",
    },
  },
]
