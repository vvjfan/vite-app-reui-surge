import { Link } from "@tanstack/react-router"
import { toast } from "sonner"

import type { DateSelectorValue } from "@/components/reui/date-selector"
import { PageHeader } from "@/components/shared/page-header"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DownloadSimpleIcon as DownloadIcon,
  PlusIcon,
} from "@phosphor-icons/react"

import { DashboardDateFilter } from "./date-filter"

// No count chip: the chip says how many rows the page lists, and the dashboard
// lists nothing - the SKU total it used to carry is the stocks grid's own "All
// products" tab count, one screen down.
export function DashboardHeader({
  period,
  onPeriodChange,
}: {
  period: DateSelectorValue
  onPeriodChange: (value: DateSelectorValue) => void
}) {
  return (
    <PageHeader
      title="Welcome to Manifest Store"
      actions={
        <>
          <DashboardDateFilter value={period} onChange={onPeriodChange} />
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
          <Link to="/products/new" className={cn(buttonVariants())}>
            <PlusIcon
              data-icon="inline-start"
              className="size-4"
              aria-hidden="true"
            />
            New product
          </Link>
        </>
      }
    />
  )
}
