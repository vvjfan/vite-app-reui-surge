import { useCallback, useRef, useState, type SVGProps } from "react"
import { useQuery } from "@tanstack/react-query"
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { categoryColor } from "@/lib/data/chart-colors"
import { velocityConfig } from "@/lib/data/dashboard"
import { ordersListQuery } from "@/features/orders/queries"
import { productsListQuery } from "@/features/products/queries"
import {
  lastThirtyDays,
  ordersExtent,
  toDateRange,
  unitsSoldTrend,
  velocityByCategory,
} from "@/features/dashboard/derive"
import { formatPercent } from "../lib/format"
import {
  TrendDownIcon as TrendingDownIcon,
  TrendUpIcon as TrendingUpIcon,
} from "@phosphor-icons/react"

// Relocated from the ReUI chart-29 block. The design (hatched bars, dotted
// backdrop, grow-up reveal) is the block's; the data is real: order lines joined
// to product categories at read time. The block shipped a hardcoded 14.2% trend
// badge, replaced here with a real period-over-period delta.
//
// Derived through the DASHBOARD's seam rather than a second copy of the same
// rollup: velocityByCategory groups order lines by product category exactly as
// this card's own helper used to, so plotting it here means the two pages cannot
// drift apart. The metric is units, matching the dashboard velocity chart -
// money per category is the Top categories list's job, not a bar chart's.

// Recharts' ResponsiveContainer measures its box on mount and does not reliably
// re-measure when a flex parent grows afterwards. This chart's card stretches to
// match the taller Sessions-by-channel card beside it, so a fixed-height chart
// would mount short and float above a gap - the bars sitting mid-card instead of
// on its floor. A callback ref wires a ResizeObserver to the fill box and hands
// the chart an explicit pixel height, recomputed on every resize. Mirrors the
// dashboard velocity chart, which solves the same layout the same way.
function useFillHeight() {
  const [height, setHeight] = useState(0)
  const observer = useRef<ResizeObserver | null>(null)
  const ref = useCallback((element: HTMLElement | null) => {
    observer.current?.disconnect()
    if (!element) return
    observer.current = new ResizeObserver(([entry]) => {
      setHeight(entry.contentRect.height)
    })
    observer.current.observe(element)
  }, [])
  return { ref, height }
}

const CHART_REVEAL_STYLE = `
@keyframes analytics-bar-grow-up {
  from { transform: scaleY(0); opacity: 0.65; }
  to { transform: scaleY(1); opacity: 1; }
}

.analytics-bar-grow-up {
  animation: analytics-bar-grow-up 720ms cubic-bezier(0.22, 1, 0.36, 1) both;
  transform-box: fill-box;
  transform-origin: bottom;
}

@media (prefers-reduced-motion: reduce) {
  .analytics-bar-grow-up { animation: none; opacity: 1; }
}
`

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean
  payload?: {
    dataKey: string
    value: number
    payload: { category: string }
  }[]
}) => {
  if (active && payload && payload.length) {
    const category = payload[0].payload.category
    return (
      <div className="min-w-[180px] rounded-lg border bg-popover p-4 shadow-lg backdrop-blur-sm">
        <div className="mb-3 border-b border-border/50 pb-2 text-sm font-semibold text-popover-foreground">
          {category}
        </div>
        <div className="space-y-1.5">
          {payload.map((item) => (
            <div
              key={item.dataKey}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2">
                {/* The swatch reads the category, like the bar does: Recharts
                    reports the series fill here, which no bar is painted in. */}
                <div
                  className="size-2 rounded-sm"
                  style={{ backgroundColor: categoryColor(category) }}
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {velocityConfig.velocity.label}
                </span>
              </div>
              <span className="text-sm font-semibold text-popover-foreground">
                {item.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

/** An svg id fragment: pattern ids are referenced by name, so a category with a
 *  space or an ampersand in it must not break the reference. */
const patternId = (category: string) =>
  `analytics-hatch-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

// Keyed per CATEGORY, not per series: every bar used to share one pattern id, so
// the last def rendered won and all the bars took its color, whatever fill each
// was handed.
const CustomHatchedBar = (
  props: SVGProps<SVGRectElement> & { payload?: { category: string } }
) => {
  const { fill, x, y, width, height, payload } = props
  const id = patternId(payload?.category ?? "")
  return (
    <>
      <rect
        className="analytics-bar-grow-up"
        rx={4}
        x={x}
        y={y}
        width={width}
        height={height}
        stroke="none"
        fill={`url(#${id})`}
      />
      <defs>
        <pattern
          id={id}
          x="0"
          y="0"
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <rect width="10" height="10" opacity={0.5} fill={fill} />
          <rect width="1" height="10" fill={fill} />
        </pattern>
      </defs>
    </>
  )
}

const DottedBackgroundPattern = () => (
  <pattern
    id="analytics-pattern-dots"
    x="0"
    y="0"
    width="10"
    height="10"
    patternUnits="userSpaceOnUse"
  >
    <circle
      className="text-muted dark:text-muted/40"
      cx="2"
      cy="2"
      r="1"
      fill="currentColor"
    />
  </pattern>
)

export function SalesByCategoryChart() {
  const ordersQuery = useQuery(ordersListQuery())
  const productsQuery = useQuery(productsListQuery())
  const isPending = ordersQuery.isPending || productsQuery.isPending
  const { ref: fillRef, height: chartHeight } = useFillHeight()
  // Mirrors the dashboard velocity chart: the axis strip (30px) sits below
  // the plot, and the dotted backdrop stops exactly at the bars' baseline.
  const containerHeight = Math.min(chartHeight || 300, 340)
  const backdropHeight = Math.max(0, containerHeight - 30)

  const orders = ordersQuery.data ?? []
  // This card reports on the whole ledger, not a window - the extent IS every
  // order, so the range argument the dashboard uses to scope its own copy of
  // this rollup spans everything here.
  const extent = ordersExtent(orders)
  // velocityByCategory ranks by units, which plots as one downhill slope. Order
  // the bars A-Z instead, so they read as a balanced spread across the catalog,
  // the way the dashboard velocity chart does beside its own ranked list.
  const data = [
    ...velocityByCategory(orders, productsQuery.data ?? [], extent),
  ].sort((a, b) => a.category.localeCompare(b.category))
  // The bars are all-time, so they have no period to compare against. The badge
  // keeps this page's existing convention instead - the last 30 days against the
  // 30 before them - now measuring the units the bars plot rather than revenue.
  const trend = unitsSoldTrend(
    orders,
    toDateRange(lastThirtyDays(extent.end), extent)
  )
  const up = trend >= 0

  return (
    <Frame dense className="h-full w-full">
      <style>{CHART_REVEAL_STYLE}</style>
      <FrameHeader className="flex-row items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <FrameTitle>Units by category</FrameTitle>
          <FrameDescription>Units sold per category</FrameDescription>
        </div>
        {isPending ? (
          <Skeleton className="h-5 w-14 rounded-md" />
        ) : (
          <Badge
            variant={up ? "success-light" : "destructive-light"}
            className="gap-1"
          >
            {up ? (
              <TrendingUpIcon className="size-3.5" aria-hidden="true" />
            ) : (
              <TrendingDownIcon className="size-3.5" aria-hidden="true" />
            )}
            <span>{formatPercent(Math.abs(trend))}</span>
          </Badge>
        )}
      </FrameHeader>
      <FramePanel className="flex flex-1 flex-col">
        {isPending ? (
          <Skeleton className="min-h-[300px] w-full flex-1 rounded-lg" />
        ) : data.length === 0 ? (
          // Settled with nothing in it, which the `isPending` branch above does
          // not cover. Units are derived from the orders, so an empty chart is
          // answered by taking one. Held at the chart's height so the card keeps
          // its shape.
          <div className="flex min-h-[300px] w-full flex-1 items-center justify-center">
            <p className="px-4 text-center text-sm text-muted-foreground">
              No units sold yet. Create an order to see categories compared
              here.
            </p>
          </div>
        ) : (
          // Fill the card height, which stretches to match the taller card
          // beside it, but cap the chart's own height and width and center in
          // the remainder: uncapped, seven bars stretch into towers with a
          // field of air between them. Mirrors the dashboard velocity chart.
          <div
            ref={fillRef}
            className="flex min-h-[300px] w-full flex-1 flex-col justify-center"
          >
            <ChartContainer
              config={velocityConfig}
              className="mx-auto aspect-auto w-full max-w-3xl"
              style={{ height: containerHeight }}
            >
              <BarChart
                accessibilityLayer
                data={data}
                // Same grouping as the dashboard velocity chart: tighter
                // category gap, and a cap so a full-width panel cannot inflate
                // the bars into slabs.
                barCategoryGap="10%"
                maxBarSize={84}
                margin={{ top: 16, right: 8, left: 8, bottom: 0 }}
              >
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height={backdropHeight}
                  fill="url(#analytics-pattern-dots)"
                />
                <defs>
                  <DottedBackgroundPattern />
                </defs>
                {/* Full category names: the ticks used to be cut to three
                    characters, which left the axis reading Acc / Act / Bag.
                    Recharts drops ticks that would collide instead. */}
                <XAxis
                  dataKey="category"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                {/* Anchor the bars to a zero baseline so they grow from the
                    floor, the way the dashboard velocity chart does. */}
                <YAxis hide domain={[0, "dataMax"]} />
                <ChartTooltip cursor={false} content={<CustomTooltip />} />
                <Bar
                  dataKey="velocity"
                  isAnimationActive={false}
                  shape={<CustomHatchedBar />}
                  radius={4}
                >
                  {data.map((datum) => (
                    <Cell
                      key={datum.category}
                      fill={categoryColor(datum.category)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </FramePanel>
    </Frame>
  )
}
