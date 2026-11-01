import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import type { DateSelectorValue } from "@/components/reui/date-selector"
import { lastThirtyDays, ordersExtent, toDateRange } from "../derive"
import { dashboardOrdersExtentQuery } from "../queries"
import { ActivityTabs } from "./activity-tabs"
import { DashboardHeader } from "./dashboard-header"
import { Stats } from "./stats"
import { TopCategories } from "./top-categories"
import { VelocityChart } from "./velocity-chart"

export function Dashboard() {
  // The date filter's window, owned here and passed down: the header drives it,
  // the period-based panels read it. Local state, like the orders and products
  // grids keep their filters - no search param, no context.
  const [period, setPeriod] = useState<DateSelectorValue>(lastThirtyDays)

  // The clamp for the open-ended operators ("before X" starts at the first order
  // ever placed). Until that read settles there is no extent to clamp with, and
  // ordersExtent([]) - today - stands in. Nothing flickers: the default window
  // is a `between`, which ignores the extent entirely, so the range it resolves
  // to is the same before and after the read.
  const [mountedAt] = useState(() => new Date())
  const { data: extent } = useQuery(dashboardOrdersExtentQuery())

  const range = useMemo(
    () => toDateRange(period, extent ?? ordersExtent([], mountedAt)),
    [period, extent, mountedAt]
  )

  return (
    <div className="@container flex w-full flex-col gap-6">
      {/* Page header */}
      <DashboardHeader period={period} onPeriodChange={setPeriod} />

      {/* Stats strip: 4 KPI tiles */}
      <Stats range={range} />

      {/* Charts row: velocity chart (2/3) + top categories (1/3), full-height matched */}
      <div className="grid grid-cols-1 items-stretch gap-6 @4xl:grid-cols-3">
        <div className="@4xl:col-span-2">
          <VelocityChart range={range} />
        </div>
        <div>
          <TopCategories range={range} />
        </div>
      </div>

      {/* Tabbed shop activity table, full ReuiDataGrid + Frame chrome.
          Not time-based: it is the inventory ledger joined to the catalog, so
          the date filter does not apply to it. */}
      <ActivityTabs />
    </div>
  )
}
