import { memo, useState } from "react"
import type { ColumnDef, Row } from "@tanstack/react-table"
import { toast } from "sonner"

import { Badge } from "@/components/reui/badge"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import {
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/reui/data-grid/data-grid-table"
import { Rating } from "@/components/reui/rating"
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
import { avatarForKey } from "@/lib/data/avatars"
import type { Product } from "@/lib/data/products"
import type { Review, ReviewStatus } from "@/lib/data/reviews"
import type { Customer } from "@/lib/data/types"
import { formatReviewDate } from "../lib/format"
import { useDeleteReview, useUpdateReview } from "../queries"
import {
  CustomerAvatar,
  CustomerRef,
  type CustomerRefTarget,
} from "@/components/shared/customer-ref"
import { ProductRef } from "@/components/shared/product-ref"
import { TruncatedText } from "@/components/shared/truncated-text"
import {
  ProhibitIcon as BanIcon,
  CheckCircleIcon as CircleCheckIcon,
  DotsThreeIcon as MoreHorizontalIcon,
  TrashIcon as Trash2Icon,
} from "@phosphor-icons/react"

// Each review resolves its product and its reviewer through the table meta
// rather than denormalizing them onto the row, so products and customers stay
// the single source of truth for titles, thumbnails and avatars.
export type ReviewsTableMeta = {
  productById: Map<string, Product>
  customerById: Map<string, Customer>
}

export function reviewerOf(
  review: Review,
  customer?: Customer
): CustomerRefTarget {
  return {
    name: review.authorName,
    id: review.customerId,
    // A linked reviewer wears their customer photo. A guest has no record to
    // carry one, so resolve a stable face from their email - every reviewer
    // shows a portrait, and the initials survive only as the load-fail fallback.
    avatar: customer?.avatar ?? avatarForKey(review.authorEmail),
  }
}

// ── Status badge ──

export const StatusBadge = memo(function StatusBadge({
  status,
}: {
  status: ReviewStatus
}) {
  if (status === "approved")
    return <Badge variant="success-light">Approved</Badge>
  if (status === "rejected") return <Badge variant="secondary">Rejected</Badge>
  return <Badge variant="warning-light">Pending</Badge>
})

// ── Row actions ──

export function ActionsCell({ row }: { row: Row<Review> }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const review = row.original
  const updateReview = useUpdateReview()
  const deleteReview = useDeleteReview()

  // The moderation write. Approve and reject are both a status update, so both
  // actions are one patch.
  const moderate = (status: ReviewStatus) => {
    updateReview.mutate({ id: review.id, patch: { status } })
    toast.success(
      status === "approved" ? "Review approved" : "Review rejected",
      {
        description: review.title,
      }
    )
  }

  const handleDeleteConfirm = () => {
    setDeleteOpen(false)
    deleteReview.mutate(review.id, {
      onSuccess: () =>
        toast.success("Review deleted", { description: review.title }),
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
              aria-label="Review actions"
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start" className="min-w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={review.status === "approved"}
              onClick={() => moderate("approved")}
            >
              <CircleCheckIcon className="size-4" aria-hidden="true" />
              Approve
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={review.status === "rejected"}
              onClick={() => moderate("rejected")}
            >
              <BanIcon className="size-4" aria-hidden="true" />
              Reject
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
            <AlertDialogTitle>Delete this review?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-foreground">
                {review.title}
              </span>{" "}
              by {review.authorName}. Rejecting it instead keeps the record and
              hides it from the storefront.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep review</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              Delete review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Columns ──

export const columns: ColumnDef<Review>[] = [
  {
    accessorKey: "id",
    id: "id",
    header: () => <DataGridTableRowSelectAll />,
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
    accessorFn: (row) => row.productId,
    id: "product",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row, table }) => {
      const meta = table.options.meta as ReviewsTableMeta | undefined
      const product = meta?.productById.get(row.original.productId)
      if (!product) {
        return (
          <span className="text-sm text-muted-foreground">
            {row.original.productId}
          </span>
        )
      }
      return (
        <div className="flex items-center gap-2.5">
          <img
            src={product.thumbnail}
            alt=""
            loading="lazy"
            className="size-9 shrink-0 rounded-md border object-cover"
          />
          <ProductRef product={{ id: product.id, title: product.title }} />
        </div>
      )
    },
    size: 240,
    minSize: 190,
    enableSorting: true,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Product",
      skeleton: (
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-9 shrink-0 rounded-md" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      ),
    },
  },
  {
    accessorFn: (row) => row.rating,
    id: "rating",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => (
      <Rating rating={row.original.rating} size="sm" className="gap-0.5" />
    ),
    size: 120,
    enableSorting: true,
    enableHiding: true,
    enableResizing: false,
    meta: {
      headerTitle: "Rating",
      skeleton: <Skeleton className="h-4 w-20" />,
    },
  },
  {
    accessorFn: (row) => row.title,
    id: "review",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <TruncatedText
          text={row.original.title}
          className="text-sm font-medium text-foreground"
        />
        <TruncatedText
          text={row.original.content}
          className="text-sm text-muted-foreground"
        />
      </div>
    ),
    minSize: 220,
    enableSorting: true,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Review",
      skeleton: (
        <div className="flex min-w-0 flex-col gap-0.5">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3.5 w-52" />
        </div>
      ),
    },
  },
  {
    accessorFn: (row) => row.authorName,
    id: "author",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row, table }) => {
      const meta = table.options.meta as ReviewsTableMeta | undefined
      const review = row.original
      const reviewer = reviewerOf(
        review,
        review.customerId
          ? meta?.customerById.get(review.customerId)
          : undefined
      )
      // A linked name already says "registered shopper", so only the guest case
      // is worth spelling out: it is what tells a moderator the review is
      // unattributable.
      return (
        <div className="flex min-w-0 items-center gap-2.5">
          <CustomerAvatar customer={reviewer} />
          <CustomerRef customer={reviewer} />
          {reviewer.id ? null : (
            <Badge variant="secondary" className="shrink-0">
              Guest
            </Badge>
          )}
        </div>
      )
    },
    size: 190,
    enableSorting: true,
    enableHiding: true,
    enableResizing: true,
    meta: {
      headerTitle: "Author",
      skeleton: (
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      ),
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
    accessorFn: (row) => row.createdAt,
    id: "date",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} visibility={true} />
    ),
    cell: ({ row }) => (
      <span className="text-sm whitespace-nowrap text-muted-foreground">
        {formatReviewDate(row.original.createdAt)}
      </span>
    ),
    size: 120,
    enableSorting: true,
    enableHiding: true,
    enableResizing: false,
    meta: {
      headerTitle: "Date",
      skeleton: <Skeleton className="h-4 w-24" />,
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
