import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { Rating } from "@/components/reui/rating"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  averageRating,
  ratingBreakdown,
  reviewsForProduct,
  type RatingValue,
} from "@/lib/data/reviews"
import { reviewsListQuery } from "../queries"
import { ProductReviewsSheet } from "./product-reviews-sheet"
import { ArrowRightIcon, StarIcon } from "@phosphor-icons/react"

const STARS: RatingValue[] = [5, 4, 3, 2, 1]

/**
 * The read side of the reviews module. A product's score is the average of its
 * APPROVED reviews only: pending and rejected ones never move it, matching the
 * average rating the storefront reads. The reviews themselves open in a sheet.
 */
export function ProductReviewsPanel({
  productId,
  productTitle,
}: {
  productId: string
  productTitle: string
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const reviewsQuery = useQuery(reviewsListQuery())
  const forProduct = reviewsForProduct(reviewsQuery.data ?? [], productId)
  const approved = forProduct.filter((review) => review.status === "approved")
  const pending = forProduct.filter(
    (review) => review.status === "pending"
  ).length
  const average = averageRating(forProduct)
  const breakdown = ratingBreakdown(forProduct)

  return (
    <>
      <Frame dense className="w-full">
        <FrameHeader className="flex-row items-center justify-between gap-3">
          <FrameTitle>Reviews</FrameTitle>
          {forProduct.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-me-1.5 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setSheetOpen(true)}
            >
              View all {forProduct.length}
              <ArrowRightIcon
                data-icon="inline-end"
                className="size-4"
                aria-hidden="true"
              />
            </Button>
          ) : null}
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4 shadow-none!">
          {reviewsQuery.isPending ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          ) : approved.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {pending > 0
                ? `No approved reviews yet. ${pending} awaiting moderation.`
                : forProduct.length > 0
                  ? "No approved reviews for this product."
                  : "No reviews for this product yet."}
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                  {average.toFixed(1)}
                </span>
                <div className="flex flex-col gap-0.5">
                  <Rating rating={average} size="sm" className="gap-0.5" />
                  <span className="text-xs text-muted-foreground">
                    {approved.length} approved review
                    {approved.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                {STARS.map((star) => {
                  const count = breakdown[star]
                  const percent = approved.length
                    ? (count / approved.length) * 100
                    : 0
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="flex w-7 shrink-0 items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
                        {star}
                        <StarIcon
                          className="size-3 fill-current"
                          aria-hidden="true"
                        />
                      </span>
                      <Progress
                        value={percent}
                        className="flex-1"
                        aria-label={`${star} star reviews`}
                      />
                      <span className="w-4 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {count}
                      </span>
                    </div>
                  )
                })}
              </div>

              {pending > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {pending} review{pending === 1 ? "" : "s"} awaiting
                  moderation.
                </p>
              ) : null}
            </>
          )}
        </FramePanel>
      </Frame>

      <ProductReviewsSheet
        productId={productId}
        productTitle={productTitle}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  )
}
