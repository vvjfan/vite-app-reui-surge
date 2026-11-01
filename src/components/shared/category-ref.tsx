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
 * A category named anywhere in the app, linked to its record. Mirrors
 * ProductRef and CustomerRef: anywhere a category is named it opens.
 */
export type CategoryRefTarget = {
  name: string
  /** Category.id, which is also the /categories/$categoryId param. Null when
   *  the reference has no category to open (an unset or removed category). */
  id: string | null
}

export function CategoryRef({
  category,
  className,
}: {
  category: CategoryRefTarget
  className?: string
}) {
  if (!category.id) {
    return (
      <TruncatedText
        text={category.name}
        className={cn("text-sm font-medium text-foreground", className)}
      />
    )
  }

  return (
    <Link
      to="/categories/$categoryId"
      params={{ categoryId: category.id }}
      // A row's own onClick navigates to that row's record, so a category
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
          {category.name}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-72">
          {category.name}
        </TooltipContent>
      </Tooltip>
      <ArrowRightIcon
        className="size-3 shrink-0 -translate-x-1 opacity-0 transition-all group-hover/ref:translate-x-0 group-hover/ref:opacity-100"
        aria-hidden="true"
      />
    </Link>
  )
}
