import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { PromotionEditor } from "@/features/promotions/components/promotion-editor"
import { promotionDetailQuery } from "@/features/promotions/queries"
import {
  SpinnerGapIcon as Loader2Icon,
  TicketIcon as TicketXIcon,
  WarningIcon as TriangleAlertIcon,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_app/promotions/$promotionId")({
  component: PromotionDetailPage,
  errorComponent: () => (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 p-10 text-center">
      <TriangleAlertIcon
        className="size-10 text-muted-foreground"
        aria-hidden="true"
      />
      <p className="text-sm font-medium text-foreground">
        Couldn&apos;t load this promotion
      </p>
      <p className="text-sm text-muted-foreground">
        Something went wrong. Please try again.
      </p>
      <Link
        to="/promotions"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Back to promotions
      </Link>
    </div>
  ),
})

function PromotionDetailPage() {
  const { promotionId } = Route.useParams()
  // Reads from the shared query cache: reflects live edits, and shows the
  // not-found state if the promotion was deleted. The full-page editor edits in
  // place (admin-style), so this route is both the detail and the editor.
  const promotionQuery = useQuery(promotionDetailQuery(promotionId))

  // Pending: the client is reading the store. Show a loading state so no seed is
  // rendered, and no false "not found" flashes before the read settles.
  if (promotionQuery.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 p-10 text-center">
        <Loader2Icon
          className="size-10 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">Loading promotion</p>
      </div>
    )
  }

  const promotion = promotionQuery.data

  if (!promotion) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 p-10 text-center">
        <TicketXIcon
          className="size-10 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-foreground">
          Promotion not found
        </p>
        <p className="text-sm text-muted-foreground">
          This promotion doesn&apos;t exist or may have been removed.
        </p>
        <Link
          to="/promotions"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to promotions
        </Link>
      </div>
    )
  }

  // key by id so navigating between promotions re-initializes the editor form.
  return (
    <PromotionEditor key={promotion.id} mode="edit" promotion={promotion} />
  )
}
