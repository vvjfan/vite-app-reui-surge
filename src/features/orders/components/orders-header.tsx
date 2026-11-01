import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { ordersListQuery } from "../queries"
import {
  DownloadSimpleIcon as DownloadIcon,
  PlusIcon,
} from "@phosphor-icons/react"

export function OrdersHeader() {
  // Same query as the grid: the count reflects live create / delete. Undefined
  // until the store read settles, so the badge appears only once real (no seed).
  const { data: orders } = useQuery(ordersListQuery())
  const count = orders?.length

  return (
    <PageHeader
      title="Orders"
      count={count === undefined ? undefined : `${count} orders`}
      actions={
        <>
          <Button
            variant="outline"
            onClick={() =>
              toast.success("Export", {
                description: "Demo. Download from your storage.",
              })
            }
          >
            <DownloadIcon
              data-icon="inline-start"
              className="size-4"
              aria-hidden="true"
            />
            Export
          </Button>
          <Link to="/orders/new" className={cn(buttonVariants())}>
            <PlusIcon
              data-icon="inline-start"
              className="size-4"
              aria-hidden="true"
            />
            New order
          </Link>
        </>
      }
    />
  )
}
