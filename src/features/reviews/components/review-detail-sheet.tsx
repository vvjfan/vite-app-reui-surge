import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { toast } from "sonner"

import { Badge } from "@/components/reui/badge"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Product } from "@/lib/data/products"
import type { Review, ReviewStatus } from "@/lib/data/reviews"
import type { Customer } from "@/lib/data/types"
import { useDeleteReview, useUpdateReview } from "../queries"
import { ReviewCard } from "./review-card"
import { reviewerOf } from "./reviews-columns"
import { TruncatedText } from "@/components/shared/truncated-text"
import {
  ProhibitIcon as BanIcon,
  CheckCircleIcon as CircleCheckIcon,
  TrashIcon as Trash2Icon,
} from "@phosphor-icons/react"

// Read the full review and moderate it in place. The review is passed in from
// the list cache, so an approve/reject is reflected here immediately.
export function ReviewDetailSheet({
  review,
  product,
  customer,
  open,
  onOpenChange,
}: {
  review: Review | null
  product: Product | null
  customer: Customer | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateReview = useUpdateReview()
  const deleteReview = useDeleteReview()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const reviewer = review ? reviewerOf(review, customer ?? undefined) : null

  const moderate = (status: ReviewStatus) => {
    if (!review) return
    updateReview.mutate({ id: review.id, patch: { status } })
    toast.success(
      status === "approved" ? "Review approved" : "Review rejected",
      {
        description: review.title,
      }
    )
  }

  const handleDeleteConfirm = () => {
    if (!review) return
    const { id, title } = review
    setDeleteOpen(false)
    onOpenChange(false)
    deleteReview.mutate(id, {
      onSuccess: () => toast.success("Review deleted", { description: title }),
    })
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="z-50 flex flex-col gap-0 overflow-hidden rounded-xl bg-popover p-0 outline-none data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:left-auto data-[side=right]:h-[calc(100svh-2rem)] data-[side=right]:w-[min(30rem,calc(100vw-2rem))] data-[side=right]:max-w-none data-[side=right]:sm:max-w-none"
        >
          {review && reviewer ? (
            <>
              <SheetHeader className="border-b px-5 py-4 sm:px-6">
                <SheetTitle>Review</SheetTitle>
                <SheetDescription>
                  Approve to publish, or reject to hide.
                </SheetDescription>
              </SheetHeader>

              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
                {product ? (
                  <Link
                    to="/products/$productId"
                    params={{ productId: product.id }}
                    className="flex items-center gap-3 rounded-md border p-2.5 transition-colors hover:bg-muted/40"
                  >
                    <img
                      src={product.thumbnail}
                      alt=""
                      loading="lazy"
                      className="size-10 shrink-0 rounded-md border object-cover"
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-foreground">
                        {product.title}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {product.vendor}
                      </span>
                    </div>
                  </Link>
                ) : null}

                <ReviewCard review={review} reviewer={reviewer} />

                {/* The reviewer's contact, the last thing the approve/reject
                    call leans on: a plausible shopper reads differently from a
                    spam address. */}
                <div className="flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
                  <TruncatedText
                    text={review.authorEmail}
                    className="min-w-0"
                  />
                  {reviewer.id ? null : (
                    <Badge variant="secondary" className="ml-auto shrink-0">
                      Guest
                    </Badge>
                  )}
                </div>
              </div>

              <SheetFooter className="flex-row items-center justify-between gap-2 border-t px-5 py-4 sm:px-6">
                <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
                  <Trash2Icon
                    data-icon="inline-start"
                    className="size-4"
                    aria-hidden="true"
                  />
                  Delete
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    disabled={review.status === "rejected"}
                    onClick={() => moderate("rejected")}
                  >
                    <BanIcon
                      data-icon="inline-start"
                      className="size-4"
                      aria-hidden="true"
                    />
                    Reject
                  </Button>
                  <Button
                    disabled={review.status === "approved"}
                    onClick={() => moderate("approved")}
                  >
                    <CircleCheckIcon
                      data-icon="inline-start"
                      className="size-4"
                      aria-hidden="true"
                    />
                    Approve
                  </Button>
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this review?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the review. Rejecting it instead keeps
              the record and hides it from the storefront.
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
