import { Rating } from "@/components/reui/rating"

import { CustomerAvatar, CustomerRef } from "@/components/shared/customer-ref"
import type { CustomerRefTarget } from "@/components/shared/customer-ref"
import type { Review } from "@/lib/data/reviews"
import { formatReviewDate } from "../lib/format"
import { StatusBadge } from "./reviews-columns"

// One review, the review-3 block's grammar: an author header carrying the name,
// the moderation status and a rating/date meta line, then the title as a pull
// quote over the body. Shared by the moderation sheet and the product list so a
// review reads the same wherever it appears.
export function ReviewCard({
  review,
  reviewer,
}: {
  review: Review
  reviewer: CustomerRefTarget
}) {
  return (
    <article className="flex flex-col gap-3">
      <header className="flex items-start gap-3">
        <CustomerAvatar customer={reviewer} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <CustomerRef customer={reviewer} />
            <StatusBadge status={review.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <Rating rating={review.rating} size="sm" />
            <span className="font-medium text-foreground tabular-nums">
              {review.rating.toFixed(1)}
            </span>
            <span
              aria-hidden="true"
              className="size-1 shrink-0 rounded-full bg-muted-foreground/40"
            />
            <span>{formatReviewDate(review.createdAt)}</span>
          </div>
        </div>
      </header>

      <blockquote className="text-base leading-snug font-semibold tracking-tight text-balance text-foreground">
        &ldquo;{review.title}&rdquo;
      </blockquote>

      <p className="text-sm leading-relaxed text-pretty text-foreground/85">
        {review.content}
      </p>
    </article>
  )
}
