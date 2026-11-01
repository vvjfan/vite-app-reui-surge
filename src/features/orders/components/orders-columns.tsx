import { memo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { OrderRef } from "@/components/shared/order-ref"
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
import {
  CustomerRefCell,
  type CustomerRefTarget,
} from "@/components/shared/customer-ref"
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
  canCancel,
  canDelete,
  canRefund,
  type OrderTransition,
} from "@/lib/data/order-lifecycle"
import {
  orderItemCount,
  type FulfillmentStatus,
  type Order,
  type OrderCustomer,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/data/types"
import { formatCurrency, formatOrderDate } from "../lib/format"
import { transitionReasonSentence } from "../lib/lifecycle-copy"
import { useDeleteOrder, useOrderTransition } from "../queries"
import {
  DotsThreeIcon as MoreHorizontalIcon,
  EyeIcon,
  CopyIcon,
  DownloadSimpleIcon as DownloadIcon,
  ProhibitIcon as BanIcon,
  MoneyIcon as BanknoteIcon,
  TrashIcon as Trash2Icon,
} from "@phosphor-icons/react"

/** What each verb says once it has happened. */
const TRANSITION_TOAST: Record<OrderTransition, string> = {
  cancel: "Order cancelled",
  fulfill: "Order fulfilled",
  refund: "Order refunded",
}

// ── Status badges ──

export const StatusBadge = memo(function StatusBadge({
  status,
}: {
  status: OrderStatus
}) {
  if (status === "fulfilled")
    return <Badge variant="success-light">Fulfilled</Badge>
  if (status === "processing")
    return <Badge variant="info-light">Processing</Badge>
  if (status === "pending")
    return <Badge variant="warning-light">Pending</Badge>
  return <Badge variant="destructive-light">Cancelled</Badge>
})

export const PaymentBadge = memo(function PaymentBadge({
  payment,
}: {
  payment: PaymentStatus
}) {
  if (payment === "paid") return <Badge variant="success-light">Paid</Badge>
  if (payment === "pending")
    return <Badge variant="warning-light">Pending</Badge>
  return <Badge variant="secondary">Refunded</Badge>
})

export const FulfillmentBadge = memo(function FulfillmentBadge({
  fulfillment,
}: {
  fulfillment: FulfillmentStatus
}) {
  if (fulfillment === "fulfilled")
    return <Badge variant="success-light">Fulfilled</Badge>
  if (fulfillment === "partial")
    return <Badge variant="warning-light">Partial</Badge>
  return <Badge variant="secondary">Unfulfilled</Badge>
})

// ── Customer reference ──

/** `handle` IS the customer id (see types.ts), so it addresses the ref directly. */
export function customerRefOf(customer: OrderCustomer): CustomerRefTarget {
  return {
    name: customer.name,
    id: customer.handle,
    avatar: customer.avatar,
    email: customer.email,
  }
}

export function CustomerCell({ customer }: { customer: OrderCustomer }) {
  return <CustomerRefCell customer={customerRefOf(customer)} />
}

// ── Row actions ──

export function ActionsCell({ row }: { row: Row<Order> }) {
  const { copyToClipboard } = useCopyToClipboard()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const order = row.original
  const transitionOrder = useOrderTransition()
  const deleteOrder = useDeleteOrder()

  const handleCopyNumber = () => {
    copyToClipboard(order.number)
    toast.success("Order number copied", { description: order.number })
  }

  /**
   * One handler for all three verbs: the intent is named, and the rule decides
   * what it costs the order. The menu items below are already disabled when a
   * verb is illegal, so a refusal here means the order moved under us (a stale
   * row, a double click) - which is exactly when the operator needs the reason
   * rather than a silent no-op.
   */
  const runTransition = (action: OrderTransition, close: () => void) => {
    close()
    const result = transitionOrder.run(order, action)
    if (result.ok) {
      toast.message(TRANSITION_TOAST[action], { description: order.number })
    } else {
      toast.error(`Could not ${action} this order`, {
        description: transitionReasonSentence(result.reason),
      })
    }
  }

  const handleDeleteConfirm = () => {
    setDeleteOpen(false)
    const check = deleteOrder.run(order)
    if (check.ok) {
      toast.success("Order deleted", { description: order.number })
    } else {
      toast.error("Could not delete this order", {
        description: transitionReasonSentence(check.reason),
      })
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="icon-sm" variant="ghost" aria-label="Order actions" />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start" className="min-w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <Link to="/orders/$orderId" params={{ orderId: order.id }} />
              }
            >
              <EyeIcon className="size-4" aria-hidden="true" />
              View details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyNumber}>
              <CopyIcon className="size-4" aria-hidden="true" />
              Copy number
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                toast.success("Invoice", {
                  description: "Demo. Download from your storage.",
                })
              }
            >
              <DownloadIcon className="size-4" aria-hidden="true" />
              Download invoice
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Each item asks the rule, rather than restating a piece of it. The
                three predicates are the same functions the store guards with, so
                the menu cannot offer an action the store would refuse. */}
            <DropdownMenuItem
              disabled={!canCancel(order)}
              onClick={() => setCancelOpen(true)}
            >
              <BanIcon className="size-4" aria-hidden="true" />
              Cancel order
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canRefund(order)}
              onClick={() => setRefundOpen(true)}
            >
              <BanknoteIcon className="size-4" aria-hidden="true" />
              Refund order
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={!canDelete(order)}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon className="size-4" aria-hidden="true" />
              Delete order
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This cancels{" "}
              <span className="font-mono text-sm text-foreground">
                {order.number}
              </span>
              {order.payment === "paid"
                ? " and refunds the payment: a cancelled order does not keep the customer's money."
                : ". No payment was captured, so there is nothing to refund."}{" "}
              It stops counting towards revenue. In production this also
              notifies the customer - wire that to your commerce backend.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                runTransition("cancel", () => setCancelOpen(false))
              }
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={refundOpen} onOpenChange={setRefundOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Refund this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This returns{" "}
              <span className="font-mono text-sm text-foreground">
                {formatCurrency(order.totals.total)}
              </span>{" "}
              for{" "}
              <span className="font-mono text-sm text-foreground">
                {order.number}
              </span>
              . The order stays as it is - it was placed and it shipped - but it
              stops counting towards revenue. In production this reaches your
              payment provider; wire it to your commerce backend.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep payment</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                runTransition("refund", () => setRefundOpen(false))
              }
            >
              Refund order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-mono text-sm text-foreground">
                {order.number}
              </span>{" "}
              from your store. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              Delete order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Columns ──

export const columns: ColumnDef<Order>[] = [
  {
    accessorKey: "id",
    id: "id",
    header: () => <DataGridTableRowSelectAll />,
    // Stop the click from bubbling to the row's onClick (which navigates).
    cell: ({ row }) => (
      <span className="flex items-center" onClick={(e) => e.stopPropagation()}>
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
    accessorFn: (row) => row.date,
    id: "order",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <OrderRef
          order={{ number: row.original.number, id: row.original.id }}
        />
        <span className="text-xs text-muted-foreground">
          {formatOrderDate(row.original.date)}
        </span>
      </div>
    ),
    size: 150,
    enableSorting: true,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Order",
      skeleton: (
        <div className="flex min-w-0 flex-col gap-0.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      ),
    },
  },
  {
    accessorFn: (row) => row.customer.name,
    id: "customer",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => <CustomerCell customer={row.original.customer} />,
    minSize: 150,
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
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ),
    },
  },
  {
    accessorFn: (row) => orderItemCount(row),
    id: "items",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => {
      const count = orderItemCount(row.original)
      const products = row.original.lines.length
      return (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground tabular-nums">
            {count} {count === 1 ? "item" : "items"}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {products} {products === 1 ? "product" : "products"}
          </span>
        </div>
      )
    },
    size: 110,
    enableSorting: true,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Items",
      skeleton: (
        <div className="flex flex-col gap-0.5">
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-3 w-20" />
        </div>
      ),
    },
  },
  {
    accessorFn: (row) => row.fulfillment,
    id: "fulfillment",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => (
      <FulfillmentBadge fulfillment={row.original.fulfillment} />
    ),
    size: 130,
    enableSorting: true,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Fulfillment",
      skeleton: <Skeleton className="h-5 w-24 rounded-sm" />,
    },
  },
  {
    accessorFn: (row) => row.totals.total,
    id: "total",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => (
      <span className="font-semibold tabular-nums">
        {formatCurrency(row.original.totals.total)}
      </span>
    ),
    size: 110,
    enableSorting: true,
    enableHiding: true,
    meta: {
      headerTitle: "Total",
      skeleton: <Skeleton className="h-4 w-20" />,
    },
  },
  {
    accessorFn: (row) => row.payment,
    id: "payment",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => <PaymentBadge payment={row.original.payment} />,
    size: 110,
    enableSorting: true,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Payment",
      skeleton: <Skeleton className="h-5 w-16 rounded-sm" />,
    },
  },
  {
    accessorFn: (row) => row.status,
    id: "status",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    size: 110,
    enableSorting: true,
    enableHiding: true,
    enableResizing: false,
    meta: {
      headerTitle: "Status",
      skeleton: <Skeleton className="h-5 w-20 rounded-sm" />,
    },
  },
  {
    id: "actions",
    header: "",
    // Stop the click from bubbling to the row's onClick (which navigates).
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
