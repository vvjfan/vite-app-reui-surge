import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { OrderDetailSheet } from "@/features/orders/components/order-detail-sheet"
import { OrderStateSheet } from "@/features/orders/components/order-state-sheet"
import { orderDetailQuery } from "@/features/orders/queries"
import {
  SpinnerGapIcon as Loader2Icon,
  PackageIcon as PackageXIcon,
  WarningIcon as TriangleAlertIcon,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_app/orders/_list/$orderId")({
  component: OrderDetailRoute,
  errorComponent: () => (
    <OrderStateSheet>
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <TriangleAlertIcon
          className="size-10 text-muted-foreground"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            Couldn&apos;t load this order
          </p>
          <p className="text-sm text-muted-foreground">
            Something went wrong. Please try again.
          </p>
        </div>
        <Link
          to="/orders"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to orders
        </Link>
      </div>
    </OrderStateSheet>
  ),
})

function OrderDetailRoute() {
  const { orderId } = Route.useParams()
  // Reads from the shared query cache: reflects live status changes, and shows
  // the not-found state if the order was deleted.
  const orderQuery = useQuery(orderDetailQuery(orderId))

  // Pending: the client is reading the store. Show a loading state in the same
  // sheet chrome so no seed is rendered, and no false "not found" flashes before
  // the read settles.
  if (orderQuery.isPending) {
    return (
      <OrderStateSheet>
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2Icon
            className="size-10 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">Loading order</p>
        </div>
      </OrderStateSheet>
    )
  }

  const order = orderQuery.data

  if (!order) {
    return (
      <OrderStateSheet>
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <PackageXIcon
            className="size-10 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              Order not found
            </p>
            <p className="text-sm text-muted-foreground">
              This order doesn&apos;t exist or may have been removed.
            </p>
          </div>
          <Link
            to="/orders"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Back to orders
          </Link>
        </div>
      </OrderStateSheet>
    )
  }

  return <OrderDetailSheet order={order} />
}
