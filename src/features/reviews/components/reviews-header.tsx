import { useQuery } from "@tanstack/react-query"

import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/reui/badge"
import { reviewsListQuery } from "../queries"

export function ReviewsHeader() {
  // Undefined until the store read settles, so the badge appears only once real.
  const { data: reviews } = useQuery(reviewsListQuery())
  const count = reviews?.length
  const pending = reviews?.filter(
    (review) => review.status === "pending"
  ).length

  return (
    <PageHeader
      title="Reviews"
      count={count === undefined ? undefined : `${count} reviews`}
      actions={
        pending ? (
          <Badge variant="warning-light">{pending} pending</Badge>
        ) : undefined
      }
    />
  )
}
