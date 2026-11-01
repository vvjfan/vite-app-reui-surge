import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"
import { ArrowRightIcon } from "@phosphor-icons/react"

/**
 * A stock location named anywhere in the app, linked to where locations are
 * managed. Mirrors ProductRef / CustomerRef, but a location has no page of its
 * own: it is one row in the Locations settings, so that is where the link goes.
 */
export function LocationRef({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <Link
      to="/settings/locations"
      // A row's own onClick navigates to that row's record, so a location
      // reference that landed there must not also fire it.
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "group/ref inline-flex min-w-0 items-center gap-1 transition-colors hover:text-primary",
        className
      )}
    >
      <span className="truncate border-b border-transparent py-0.25 transition-colors group-hover/ref:border-primary">
        {name}
      </span>
      <ArrowRightIcon
        className="size-3 shrink-0 -translate-x-1 opacity-0 transition-all group-hover/ref:translate-x-0 group-hover/ref:opacity-100"
        aria-hidden="true"
      />
    </Link>
  )
}
