import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { reviewsForProduct } from "@/lib/data/reviews"
import { customersListQuery } from "@/features/customers/queries"
import { reviewsListQuery } from "../queries"
import { ProductRef } from "@/components/shared/product-ref"
import { ReviewCard } from "./review-card"
import { reviewerOf } from "./reviews-columns"
import { XIcon } from "@phosphor-icons/react"

// The whole review list for one product, newest first, every status shown so the
// merchant sees the published ones and the ones still waiting in one place. The
// panel keeps the score; this keeps the reviews behind it.
export function ProductReviewsSheet({
  productId,
  productTitle,
  open,
  onOpenChange,
}: {
  productId: string
  productTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const reviewsQuery = useQuery(reviewsListQuery())
  const customersQuery = useQuery(customersListQuery())
  const customerById = new Map(
    (customersQuery.data ?? []).map((customer) => [customer.id, customer])
  )
  const reviews = [
    ...reviewsForProduct(reviewsQuery.data ?? [], productId),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="z-50 flex flex-col gap-0 overflow-hidden rounded-xl bg-popover p-0 outline-none data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:left-auto data-[side=right]:h-[calc(100svh-2rem)] data-[side=right]:w-[min(30rem,calc(100vw-2rem))] data-[side=right]:max-w-none data-[side=right]:sm:max-w-none"
      >
        <SheetHeader className="shrink-0 gap-0 border-b p-0">
          <div className="flex min-h-11 items-center justify-between gap-2 px-5">
            <SheetTitle className="min-w-0 truncate text-sm font-semibold">
              Reviews
            </SheetTitle>
            <SheetClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close reviews"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <XIcon aria-hidden="true" />
                </Button>
              }
            />
          </div>
          <div className="px-5 pt-1 pb-4">
            <SheetDescription className="text-xs text-muted-foreground">
              {reviews.length} review{reviews.length === 1 ? "" : "s"} for{" "}
              <ProductRef
                product={{ id: productId, title: productTitle }}
                className="text-xs font-normal"
              />
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full min-h-0">
            {reviewsQuery.isPending ? null : reviews.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                No reviews for this product yet.
              </p>
            ) : (
              <div className="flex flex-col divide-y">
                {reviews.map((review) => (
                  <div key={review.id} className="px-5 py-4">
                    <ReviewCard
                      review={review}
                      reviewer={reviewerOf(
                        review,
                        review.customerId
                          ? customerById.get(review.customerId)
                          : undefined
                      )}
                    />
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
