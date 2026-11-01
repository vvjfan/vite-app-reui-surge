import { Link } from "@tanstack/react-router"

import { TruncatedText } from "@/components/shared/truncated-text"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { initials } from "@/features/orders/lib/format"
import { cn } from "@/lib/utils"
import { ArrowRightIcon } from "@phosphor-icons/react"

/**
 * A person named anywhere in the app: their face, their name, and the link
 * through to their record.
 *
 * Guests checked out without an account, so they have no customer to link to:
 * their name renders as plain text, not a broken link. A face may still be
 * supplied for them (a caller can resolve a stable one); when none is, the
 * initials fallback stands in.
 */
export type CustomerRefTarget = {
  name: string
  /** Customer.id, which is also the /customers/$handle param. Null for a guest. */
  id: string | null
  /** The person's photo. When absent, the initials fallback stands in. */
  avatar?: string
  email?: string
}

export function CustomerAvatar({
  customer,
  className,
}: {
  customer: CustomerRefTarget
  className?: string
}) {
  return (
    <Avatar className={cn("size-8 shrink-0", className)}>
      {customer.avatar ? <AvatarImage src={customer.avatar} alt="" /> : null}
      <AvatarFallback className="text-xs">
        {initials(customer.name)}
      </AvatarFallback>
    </Avatar>
  )
}

/**
 * The customer's name, linked to their record.
 *
 * The click is stopped from bubbling: a row's own onClick navigates to that
 * row's record, and a customer reference that landed there would be a link that
 * lies about where it goes.
 */
export function CustomerRef({
  customer,
  className,
}: {
  customer: CustomerRefTarget
  className?: string
}) {
  if (!customer.id) {
    return (
      <TruncatedText
        text={customer.name}
        className={cn("text-sm font-medium text-foreground", className)}
      />
    )
  }

  return (
    <Link
      to="/customers/$handle"
      params={{ handle: customer.id }}
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
          {customer.name}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-72">
          {customer.name}
        </TooltipContent>
      </Tooltip>
      <ArrowRightIcon
        className="size-3 shrink-0 -translate-x-1 opacity-0 transition-all group-hover/ref:translate-x-0 group-hover/ref:opacity-100"
        aria-hidden="true"
      />
    </Link>
  )
}

/** The grid presentation: face, linked name, and the email underneath. */
export function CustomerRefCell({ customer }: { customer: CustomerRefTarget }) {
  return (
    <div className="flex items-center gap-2.5">
      <CustomerAvatar customer={customer} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <CustomerRef customer={customer} />
        {customer.email ? (
          <TruncatedText
            text={customer.email}
            className="text-sm text-muted-foreground"
          />
        ) : null}
      </div>
    </div>
  )
}
