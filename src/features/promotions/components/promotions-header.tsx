import { Link } from "@tanstack/react-router"

import { PageHeader } from "@/components/shared/page-header"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { usePromotions } from "../queries"
import { PlusIcon } from "@phosphor-icons/react"

export function PromotionsHeader() {
  // Same query as the grid: the count reflects the live store. Undefined until
  // the read settles, so the badge appears only once real (never a seed count).
  const { data: promotions } = usePromotions()
  const count = promotions?.length

  return (
    <PageHeader
      title="Promotions"
      count={count === undefined ? undefined : `${count} promotions`}
      actions={
        <Link to="/promotions/new" className={cn(buttonVariants())}>
          <PlusIcon aria-hidden="true" />
          New promotion
        </Link>
      }
    />
  )
}
