import { createFileRoute } from "@tanstack/react-router"

import { ReviewsDataGrid } from "@/features/reviews/components/reviews-data-grid"
import { ReviewsHeader } from "@/features/reviews/components/reviews-header"

export const Route = createFileRoute("/_app/reviews")({
  staticData: { crumb: "Reviews" },
  component: ReviewsPage,
})

// Page header + moderation queue. The shared content frame (max width + padding)
// lives in _app.tsx, so this renders content directly.
function ReviewsPage() {
  return (
    <div className="flex flex-col gap-4">
      <ReviewsHeader />
      <ReviewsDataGrid />
    </div>
  )
}
