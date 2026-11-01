import { useQuery } from "@tanstack/react-query"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { FunnelPoint } from "@/lib/data/analytics"
import { analyticsFunnelQuery } from "../queries"
import { formatCount, formatPercent } from "../lib/format"
import {
  TrendDownIcon as TrendingDownIcon,
  TrendUpIcon as TrendingUpIcon,
} from "@phosphor-icons/react"

// Relocated from the ReUI solution-analytics-3 block (its activation funnel
// chart; the SaaS cohort grid and segment pie are dropped). The block's four
// stages map onto the commerce funnel exactly, so the design is untouched: only
// what it carries changed. Stage deltas are computed from the real series
// instead of the block's hardcoded periodChanges table.

type StageKey = "sessions" | "addedToCart" | "reachedCheckout" | "converted"

const STAGES: { key: StageKey; label: string; color: string }[] = [
  { key: "sessions", label: "Sessions", color: "var(--color-indigo-400)" },
  {
    key: "addedToCart",
    label: "Added to cart",
    color: "var(--color-indigo-500)",
  },
  {
    key: "reachedCheckout",
    label: "Reached checkout",
    color: "var(--color-indigo-600)",
  },
  { key: "converted", label: "Converted", color: "var(--color-indigo-700)" },
]

const chartConfig = {
  sessions: { label: "Sessions", color: "var(--color-indigo-400)" },
  addedToCart: { label: "Added to cart", color: "var(--color-indigo-500)" },
  reachedCheckout: {
    label: "Reached checkout",
    color: "var(--color-indigo-600)",
  },
  converted: { label: "Converted", color: "var(--color-indigo-700)" },
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { dataKey: string; value: number }[]
  label?: string
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="min-w-[200px] rounded-lg border bg-popover p-4 shadow-lg backdrop-blur-sm">
        <div className="mb-3.5 border-b border-border/50 pb-2 text-sm font-semibold text-popover-foreground">
          {label}
        </div>
        <div className="space-y-1.5">
          {STAGES.map((stage) => {
            const point = payload.find((p) => p.dataKey === stage.key)
            return (
              <div
                key={stage.key}
                className="flex items-center justify-between gap-1.5"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    {stage.label}
                  </span>
                </div>
                <span className="text-sm font-semibold text-popover-foreground">
                  {formatCount(point?.value ?? 0)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  return null
}

/**
 * Totals across the window, plus each stage's period-over-period move. The
 * comparison splits the window in half (the recent 4 weeks against the prior 4)
 * rather than last week against the one before: weekly stage counts are small
 * enough that week-over-week is mostly noise, and this matches the 30d-vs-30d
 * basis the KPI tiles use.
 */
function summarise(data: FunnelPoint[]) {
  const total = (rows: FunnelPoint[], key: StageKey) =>
    rows.reduce((sum, point) => sum + point[key], 0)

  const half = Math.floor(data.length / 2)
  const previousRows = data.slice(0, half)
  const currentRows = data.slice(half)

  return STAGES.map((stage) => {
    const before = total(previousRows, stage.key)
    const now = total(currentRows, stage.key)
    return {
      ...stage,
      value: total(data, stage.key),
      change: before > 0 ? ((now - before) / before) * 100 : 0,
    }
  })
}

export function ConversionFunnel() {
  const funnelQuery = useQuery(analyticsFunnelQuery())
  const data = funnelQuery.data ?? []
  const stages = summarise(data)

  return (
    <Frame dense className="flex h-full w-full flex-col">
      <FrameHeader className="flex-row items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <FrameTitle>Conversion funnel</FrameTitle>
          <FrameDescription>Sessions to purchase</FrameDescription>
        </div>
      </FrameHeader>
      <FramePanel className="flex flex-1 flex-col gap-6">
        <div className="grid grid-cols-2 gap-6 p-2 md:grid-cols-4">
          {funnelQuery.isPending
            ? Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="flex items-center gap-2.5">
                  <div className="h-12 w-0.5 rounded-full bg-border" />
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))
            : stages.map((stage) => (
                <div key={stage.key} className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className="h-12 w-0.5 rounded-full bg-border" />
                    <div className="flex flex-col gap-2">
                      <div className="text-sm font-medium text-muted-foreground">
                        {stage.label}
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-base leading-none font-semibold">
                          {formatCount(stage.value)}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs font-medium [&_svg]:size-4",
                            stage.change >= 0
                              ? "text-success"
                              : "text-destructive"
                          )}
                        >
                          {stage.change >= 0 ? (
                            <TrendingUpIcon aria-hidden="true" />
                          ) : (
                            <TrendingDownIcon aria-hidden="true" />
                          )}
                          {formatPercent(Math.abs(stage.change))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
        </div>

        {funnelQuery.isPending ? (
          <Skeleton className="mt-auto h-[250px] w-full rounded-lg" />
        ) : data.length === 0 ? (
          // Settled with nothing in it, which the `isPending` branch above does
          // not cover. Traffic is not something this admin creates, so the empty
          // case points at where sessions come from rather than at a button.
          <div className="mt-auto flex h-[250px] w-full items-center justify-center">
            <p className="px-4 text-center text-sm text-muted-foreground">
              No traffic yet. The funnel fills once visitors reach your store.
            </p>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mt-auto h-[250px] w-full"
          >
            <AreaChart
              accessibilityLayer
              data={data}
              margin={{ top: 10, bottom: 10, left: 5, right: 5 }}
            >
              <defs>
                {STAGES.map((stage) => (
                  <linearGradient
                    key={stage.key}
                    id={`fill-${stage.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={stage.color}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={stage.color}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="4 12" />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 12 }}
              />
              <YAxis hide />
              <ChartTooltip content={<CustomTooltip />} />
              {STAGES.map((stage) => (
                <Area
                  key={stage.key}
                  dataKey={stage.key}
                  type="monotone"
                  fill={`url(#fill-${stage.key})`}
                  stroke={stage.color}
                  strokeWidth={2}
                  stackId={undefined}
                />
              ))}
            </AreaChart>
          </ChartContainer>
        )}
      </FramePanel>
    </Frame>
  )
}
