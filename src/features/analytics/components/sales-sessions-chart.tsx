import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ordersListQuery } from "@/features/orders/queries"
import { sessionsOverTimeQuery } from "../queries"
import { deltas, salesVsSessions } from "../lib/derive"
import { formatCount, formatCurrency, formatPercent } from "../lib/format"

// Relocated from the ReUI chart-24 block ("revenue vs traffic"). Adapted to
// carry our data: sales come from the real orders entity, sessions from the
// seeded analytics aggregates, and the two header badges show real
// period-over-period deltas instead of the block's hardcoded +8% / +5%. The
// block's currency was hardcoded to GBP; it now uses the shared formatter.
//
// The ranges are anchored to the data, not the wall clock: the orders seed ends
// at a fixed date, so "last 30 days" from today would be empty.

type RangeKey = "30d" | "60d"

const RANGES = {
  "30d": { key: "30d", label: "Last 30 days", weeks: 4 },
  "60d": { key: "60d", label: "Last 60 days", weeks: 9 },
} as const

const chartConfig = {
  sales: { label: "Sales", color: "var(--color-success)" },
  views: { label: "Sessions", color: "var(--color-warning)" },
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean
  payload?: { dataKey: string; color: string; value: number }[]
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="min-w-[120px] space-y-1.5 rounded-lg border bg-popover p-3 shadow-lg">
        {payload.map((item) => (
          <div key={item.dataKey}>
            <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {item.dataKey === "sales" ? "Sales" : "Sessions"}
            </div>
            <div className="text-sm font-semibold text-popover-foreground">
              {item.dataKey === "sales"
                ? formatCurrency(item.value)
                : formatCount(item.value)}
            </div>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function SalesSessionsChart() {
  const [range, setRange] = useState<RangeKey>("60d")
  const ordersQuery = useQuery(ordersListQuery())
  const sessionsQuery = useQuery(sessionsOverTimeQuery())
  const isPending = ordersQuery.isPending || sessionsQuery.isPending

  const orders = ordersQuery.data ?? []
  const sessions = sessionsQuery.data ?? []
  const data = salesVsSessions(orders, sessions, RANGES[range].weeks)
  const trend = deltas(orders, sessions)

  const totalSales = data.reduce((sum, item) => sum + item.sales, 0)
  const totalViews = data.reduce((sum, item) => sum + item.views, 0)

  const rangeOptions = Object.values(RANGES).map((r) => ({
    label: r.label,
    value: r.key,
  }))

  return (
    <Frame dense className="w-full">
      <FrameHeader className="flex-row items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <FrameTitle>Sales and sessions</FrameTitle>
          <FrameDescription>Revenue and traffic</FrameDescription>
        </div>
        <Select
          value={range}
          onValueChange={(value) => setRange(value as RangeKey)}
          items={rangeOptions}
        >
          <SelectTrigger className="w-fit min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            alignItemWithTrigger={false}
            className="w-40"
            align="start"
          >
            {rangeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FrameHeader>
      <FramePanel className="space-y-8">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-10 px-2.5">
            <div className="flex items-center gap-3">
              <div className="size-2 rounded-full bg-success" />
              <div>
                <div className="text-xs tracking-wide text-muted-foreground uppercase">
                  Sales
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold tracking-tight tabular-nums">
                    {isPending ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      formatCurrency(totalSales)
                    )}
                  </span>
                  {!isPending && (
                    <Badge
                      variant={
                        trend.sales >= 0 ? "success-light" : "destructive-light"
                      }
                    >
                      {trend.sales >= 0 ? "+" : ""}
                      {formatPercent(trend.sales)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-2 rounded-full bg-warning" />
              <div>
                <div className="text-xs tracking-wide text-muted-foreground uppercase">
                  Sessions
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold tracking-tight tabular-nums">
                    {isPending ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      formatCount(totalViews)
                    )}
                  </span>
                  {!isPending && (
                    <Badge
                      variant={
                        trend.sessions >= 0
                          ? "success-light"
                          : "destructive-light"
                      }
                    >
                      {trend.sessions >= 0 ? "+" : ""}
                      {formatPercent(trend.sessions)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="h-[300px] w-full">
            {isPending ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : (
              <ChartContainer config={chartConfig} className="h-full w-full">
                <LineChart
                  data={data}
                  margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="4 12"
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="period"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    tickMargin={10}
                    interval={0}
                    padding={{ left: 20, right: 20 }}
                  />
                  <YAxis yAxisId="sales" orientation="left" hide />
                  <YAxis yAxisId="views" orientation="right" hide />
                  <ChartTooltip content={<CustomTooltip />} />
                  <Line
                    yAxisId="sales"
                    dataKey="sales"
                    stroke="var(--color-success)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="views"
                    dataKey="views"
                    stroke="var(--color-warning)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </div>
        </div>
      </FramePanel>
    </Frame>
  )
}
