import { Link } from "@tanstack/react-router"

import { TruncatedText } from "@/components/shared/truncated-text"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ArrowRightIcon } from "@phosphor-icons/react"

/**
 * A product named anywhere in the app, linked to its record. Mirrors
 * CustomerRef: anywhere a shopper sees a product they can open it.
 */
export type ProductRefTarget = {
  title: string
  /** Product.id, which is also the /products/$productId param. Null when the
   *  reference has no product to open (a deleted or off-catalog line). */
  id: string | null
}

export function ProductRef({
  product,
  className,
}: {
  product: ProductRefTarget
  className?: string
}) {
  if (!product.id) {
    return (
      <TruncatedText
        text={product.title}
        className={cn("text-sm font-medium text-foreground", className)}
      />
    )
  }

  return (
    <Link
      to="/products/$productId"
      params={{ productId: product.id }}
      // A row's own onClick navigates to that row's record, so a product
      // reference that landed there must not also fire it.
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "group/ref inline-flex min-w-0 items-center gap-1 text-sm font-medium text-foreground transition-colors hover:text-primary",
        className
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="truncate border-b border-transparent py-0.25 transition-colors group-hover/ref:border-primary" />
          }
        >
          {product.title}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-72">
          {product.title}
        </TooltipContent>
      </Tooltip>
      <ArrowRightIcon
        className="size-3 shrink-0 -translate-x-1 opacity-0 transition-all group-hover/ref:translate-x-0 group-hover/ref:opacity-100"
        aria-hidden="true"
      />
    </Link>
  )
}
