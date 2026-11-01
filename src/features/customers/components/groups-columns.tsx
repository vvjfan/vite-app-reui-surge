import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { toast } from "sonner"

import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import {
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/reui/data-grid/data-grid-table"
import type { ColumnDef } from "@tanstack/react-table"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { IconTile } from "@/components/shared/icon-tile"
import { formatOrderDate } from "@/features/orders/lib/format"
import { formatCurrency } from "@/features/products/lib/format"
import type { Customer, CustomerGroup } from "@/lib/data/types"
import { useDeleteGroup } from "../queries"
import { GroupFormSheet } from "./group-form-sheet"
import {
  DotsThreeIcon as MoreHorizontalIcon,
  PencilIcon,
  TrashIcon as Trash2Icon,
  UsersIcon as UsersRoundIcon,
} from "@phosphor-icons/react"

/** One grid row: the group plus everything derived from the customers and
 * orders reads (the same joins the customers page derives per customer). */
export interface GroupRow {
  group: CustomerGroup
  members: Customer[]
  /** Fraction of the whole customer base that sits in this group. */
  share: number
  /** Orders placed by members, summed. */
  ordersCount: number
  /** Members' lifetime spend, summed. */
  totalSpent: number
  /** The most recent order date across members, or null before any order. */
  lastOrderDate: string | null
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
}

// ── Cells ──

function GroupCell({ row }: { row: GroupRow }) {
  const { group } = row
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <IconTile>
        <UsersRoundIcon aria-hidden="true" />
      </IconTile>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          to="/customers/groups/$groupId"
          params={{ groupId: group.id }}
          className="w-fit truncate text-sm font-medium text-foreground hover:text-primary"
          onClick={(event) => event.stopPropagation()}
        >
          {group.name}
        </Link>
        <span className="truncate text-xs text-muted-foreground">
          {group.description ?? "No description"}
        </span>
      </div>
    </div>
  )
}

function MembersCell({ row }: { row: GroupRow }) {
  const shown = row.members.slice(0, 4)
  if (row.members.length === 0) {
    return <span className="text-sm text-muted-foreground">No members</span>
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {shown.map((customer) => (
          <Avatar key={customer.id} className="size-6 ring-2 ring-background">
            {customer.avatar ? (
              <AvatarImage src={customer.avatar} alt="" />
            ) : null}
            <AvatarFallback className="text-[10px]">
              {initials(customer.name)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span className="text-sm text-foreground tabular-nums">
        {row.members.length}
      </span>
    </div>
  )
}

function ShareCell({ row }: { row: GroupRow }) {
  return (
    <span className="text-sm text-foreground tabular-nums">
      {Math.round(row.share * 100)}%
      <span className="ms-1 text-xs text-muted-foreground">of customers</span>
    </span>
  )
}

function ActionsCell({ row }: { row: GroupRow }) {
  const { group } = row
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteGroup = useDeleteGroup()

  return (
    <div
      className="flex justify-end"
      onClick={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label={`Actions for ${group.name}`}
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" className="min-w-36">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <PencilIcon className="size-4" aria-hidden="true" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon className="size-4" aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <GroupFormSheet
        mode="edit"
        group={group}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this group?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the{" "}
              <span className="font-medium text-foreground">{group.name}</span>{" "}
              group. Customers keep their records; they just leave this segment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep group</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDeleteOpen(false)
                deleteGroup.mutate(group.id, {
                  onSuccess: () =>
                    toast.success("Group deleted", { description: group.name }),
                })
              }}
            >
              Delete group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Columns ──

export const groupsColumns: ColumnDef<GroupRow>[] = [
  {
    accessorFn: (row) => row.group.id,
    id: "id",
    header: () => <DataGridTableRowSelectAll />,
    cell: ({ row }) => (
      <span
        className="flex items-center"
        onClick={(event) => event.stopPropagation()}
      >
        <DataGridTableRowSelect row={row} />
      </span>
    ),
    enableSorting: false,
    size: 35,
    enableResizing: false,
    enableHiding: false,
    meta: {
      skeleton: <Skeleton className="size-4 rounded" />,
      headerClassName: "ps-(--frame-panel-px)",
      cellClassName: "ps-(--frame-panel-px)",
    },
  },
  {
    accessorFn: (row) => row.group.name,
    id: "group",
    header: ({ column }) => (
      <DataGridColumnHeader title="Group" column={column} />
    ),
    cell: ({ row }) => <GroupCell row={row.original} />,
    minSize: 260,
    enableSorting: true,
    enableHiding: false,
    meta: {
      headerTitle: "Group",
      autoSize: true,
      skeleton: (
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
      ),
    },
  },
  {
    accessorFn: (row) => row.members.length,
    id: "members",
    header: ({ column }) => (
      <DataGridColumnHeader title="Members" column={column} />
    ),
    cell: ({ row }) => <MembersCell row={row.original} />,
    size: 160,
    enableSorting: true,
    meta: {
      headerTitle: "Members",
      skeleton: (
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-6" />
        </div>
      ),
    },
  },
  {
    accessorFn: (row) => row.share,
    id: "share",
    header: ({ column }) => (
      <DataGridColumnHeader title="Share" column={column} />
    ),
    cell: ({ row }) => <ShareCell row={row.original} />,
    size: 150,
    enableSorting: true,
    meta: {
      headerTitle: "Share",
      skeleton: <Skeleton className="h-4 w-20" />,
    },
  },
  {
    accessorFn: (row) => row.ordersCount,
    id: "orders",
    header: ({ column }) => (
      <DataGridColumnHeader title="Orders" column={column} />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-foreground tabular-nums">
        {row.original.ordersCount}
      </span>
    ),
    size: 100,
    enableSorting: true,
    meta: {
      headerTitle: "Orders",
      skeleton: <Skeleton className="h-4 w-8" />,
    },
  },
  {
    accessorFn: (row) => row.totalSpent,
    id: "totalSpent",
    header: ({ column }) => (
      <DataGridColumnHeader title="Total spent" column={column} />
    ),
    cell: ({ row }) => (
      <span className="text-sm font-medium text-foreground tabular-nums">
        {formatCurrency(row.original.totalSpent)}
      </span>
    ),
    size: 130,
    enableSorting: true,
    meta: {
      headerTitle: "Total spent",
      skeleton: <Skeleton className="h-4 w-16" />,
    },
  },
  {
    accessorFn: (row) => row.lastOrderDate ?? "",
    id: "lastOrder",
    header: ({ column }) => (
      <DataGridColumnHeader title="Last order" column={column} />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground tabular-nums">
        {row.original.lastOrderDate
          ? formatOrderDate(row.original.lastOrderDate)
          : "-"}
      </span>
    ),
    size: 130,
    enableSorting: true,
    meta: {
      headerTitle: "Last order",
      skeleton: <Skeleton className="h-4 w-20" />,
    },
  },
  {
    accessorFn: (row) => row.group.createdAt,
    id: "created",
    header: ({ column }) => (
      <DataGridColumnHeader title="Created" column={column} />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground tabular-nums">
        {formatOrderDate(row.original.group.createdAt)}
      </span>
    ),
    size: 130,
    enableSorting: true,
    meta: {
      headerTitle: "Created",
      skeleton: <Skeleton className="h-4 w-20" />,
    },
  },
  {
    id: "actions",
    header: () => null,
    cell: ({ row }) => <ActionsCell row={row.original} />,
    size: 56,
    enableSorting: false,
    enableResizing: false,
    meta: {
      skeleton: <Skeleton className="size-7 rounded" />,
    },
  },
]
