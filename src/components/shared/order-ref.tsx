import { Link } from "@tanstack/react-router"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ArrowRightIcon } from "@phosphor-icons/react"

/**
 * An order named anywhere in the app, linked to its record. Mirrors ProductRef
 * and CustomerRef; the number reads in mono, the way order numbers do.
 */
export type OrderRefTarget = {
  number: string
  /** Order.id, which is also the /orders/$orderId param. Null when the
   *  reference has no order to open. */
  id: string | null
}

export function OrderRef({
  order,
  className,
}: {
  order: OrderRefTarget
  className?: string
}) {
  if (!order.id) {
    return (
      <span
        className={cn(
          "truncate font-mono text-sm font-medium text-foreground",
          className
        )}
      >
        {order.number}
      </span>
    )
  }

  return (
    <Link
      to="/orders/$orderId"
      params={{ orderId: order.id }}
      // A row's own onClick navigates to that row's record, so an order
      // reference that landed there must not also fire it.
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "group/ref inline-flex min-w-0 items-center gap-1 font-mono text-sm font-medium text-foreground transition-colors hover:text-primary",
        className
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="truncate border-b border-transparent py-0.25 transition-colors group-hover/ref:border-primary" />
          }
        >
          {order.number}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-72">
          {order.number}
        </TooltipContent>
      </Tooltip>
      <ArrowRightIcon
        className="size-3 shrink-0 -translate-x-1 opacity-0 transition-all group-hover/ref:translate-x-0 group-hover/ref:opacity-100"
        aria-hidden="true"
      />
    </Link>
  )
}
