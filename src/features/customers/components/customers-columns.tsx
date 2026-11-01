import { memo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { Badge } from "@/components/reui/badge"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import {
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/reui/data-grid/data-grid-table"
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
import { CustomerRefCell } from "@/components/shared/customer-ref"
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
import type { CustomerGroup } from "@/lib/data/types"
import { formatCurrency, formatOrderDate } from "@/features/orders/lib/format"
import { CustomerFormSheet } from "./customer-form-sheet"
import type { CustomerRow } from "../queries"
import { useDeleteCustomer } from "../queries"
import {
  DotsThreeIcon as MoreHorizontalIcon,
  EyeIcon,
  PencilIcon,
  CopyIcon,
  TrashIcon as Trash2Icon,
} from "@phosphor-icons/react"

export const AccountBadge = memo(function AccountBadge({
  hasAccount,
}: {
  hasAccount: boolean
}) {
  return hasAccount ? (
    <Badge variant="success-light">Registered</Badge>
  ) : (
    <Badge variant="secondary">Guest</Badge>
  )
})

function GroupsCell({
  ids,
  groupsById,
}: {
  ids: string[]
  groupsById: Map<string, CustomerGroup>
}) {
  const groups = ids
    .map((id) => groupsById.get(id))
    .filter((group): group is CustomerGroup => Boolean(group))
  if (groups.length === 0) {
    return <span className="text-sm text-muted-foreground">-</span>
  }
  const shown = groups.slice(0, 2)
  const extra = groups.length - shown.length
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {shown.map((group) => (
        <Link
          key={group.id}
          to="/customers/groups/$groupId"
          params={{ groupId: group.id }}
          onClick={(e) => e.stopPropagation()}
        >
          <Badge variant="secondary">{group.name}</Badge>
        </Link>
      ))}
      {extra > 0 ? (
        <Badge variant="secondary" className="tabular-nums">
          +{extra}
        </Badge>
      ) : null}
    </div>
  )
}

// ── Row actions ──

function ActionsCell({ row }: { row: Row<CustomerRow> }) {
  const { copyToClipboard } = useCopyToClipboard()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const customer = row.original
  const deleteCustomer = useDeleteCustomer()

  const handleCopyEmail = () => {
    copyToClipboard(customer.email)
    toast.success("Email copied", { description: customer.email })
  }

  const handleDeleteConfirm = () => {
    setDeleteOpen(false)
    deleteCustomer.mutate(customer.id, {
      onSuccess: () =>
        toast.success("Customer deleted", { description: customer.name }),
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
              aria-label="Customer actions"
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start" className="min-w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <Link
                  to="/customers/$handle"
                  params={{ handle: customer.id }}
                />
              }
            >
              <EyeIcon className="size-4" aria-hidden="true" />
              View profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <PencilIcon className="size-4" aria-hidden="true" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyEmail}>
              <CopyIcon className="size-4" aria-hidden="true" />
              Copy email
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
            <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-foreground">
                {customer.name}
              </span>
              . Their past orders keep their customer snapshot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep customer</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              Delete customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CustomerFormSheet
        mode="edit"
        customer={customer}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  )
}

// ── Columns factory (needs the groups lookup for the Groups cell) ──

export function createCustomerColumns(
  groupsById: Map<string, CustomerGroup>
): ColumnDef<CustomerRow>[] {
  return [
    {
      accessorKey: "id",
      id: "id",
      header: () => <DataGridTableRowSelectAll />,
      cell: ({ row }) => (
        <span
          className="flex items-center"
          onClick={(e) => e.stopPropagation()}
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
      accessorFn: (row) => row.name,
      id: "customer",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => (
        <CustomerRefCell
          customer={{
            name: row.original.name,
            id: row.original.id,
            avatar: row.original.avatar,
            email: row.original.email,
          }}
        />
      ),
      minSize: 200,
      enableSorting: true,
      enableHiding: true,
      enableResizing: true,
      meta: {
        headerTitle: "Customer",
        skeleton: (
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        ),
      },
    },
    {
      accessorFn: (row) => row.hasAccount,
      id: "status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => <AccountBadge hasAccount={row.original.hasAccount} />,
      size: 120,
      enableSorting: true,
      enableHiding: true,
      meta: {
        headerTitle: "Status",
        skeleton: <Skeleton className="h-5 w-20 rounded-sm" />,
      },
    },
    {
      accessorFn: (row) => row.groups.length,
      id: "groups",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => (
        <GroupsCell ids={row.original.groups} groupsById={groupsById} />
      ),
      size: 170,
      enableSorting: false,
      enableHiding: true,
      enableResizing: true,
      meta: {
        headerTitle: "Groups",
        skeleton: <Skeleton className="h-5 w-24 rounded-sm" />,
      },
    },
    {
      accessorFn: (row) => row.ordersCount,
      id: "orders",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-medium text-foreground tabular-nums">
          {row.original.ordersCount}
        </span>
      ),
      size: 90,
      enableSorting: true,
      enableHiding: true,
      meta: {
        headerTitle: "Orders",
        skeleton: <Skeleton className="h-4 w-8" />,
      },
    },
    {
      accessorFn: (row) => row.totalSpent,
      id: "totalSpent",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {formatCurrency(row.original.totalSpent)}
        </span>
      ),
      size: 120,
      enableSorting: true,
      enableHiding: true,
      meta: {
        headerTitle: "Total spent",
        skeleton: <Skeleton className="h-4 w-20" />,
      },
    },
    {
      accessorFn: (row) => row.location?.city ?? "",
      id: "location",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) =>
        row.original.location ? (
          <span className="truncate text-sm text-foreground">
            {row.original.location.city}, {row.original.location.countryCode}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
      size: 150,
      enableSorting: true,
      enableHiding: true,
      enableResizing: true,
      meta: {
        headerTitle: "Location",
        skeleton: <Skeleton className="h-4 w-24" />,
      },
    },
    {
      accessorFn: (row) => row.createdAt,
      id: "signedUp",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatOrderDate(row.original.createdAt)}
        </span>
      ),
      size: 120,
      enableSorting: true,
      enableHiding: true,
      meta: {
        headerTitle: "Signed up",
        skeleton: <Skeleton className="h-4 w-20" />,
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <ActionsCell row={row} />
        </div>
      ),
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
}
