import { useCallback, useRef, useState } from "react"
import type { SVGProps } from "react"
import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts"

import { useQuery } from "@tanstack/react-query"

import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { categoryColor } from "@/lib/data/chart-colors"
import { velocityConfig } from "@/lib/data/dashboard"
import { dashboardVelocityQuery, dashboardVelocityTrendQuery } from "../queries"
import type { DateRange } from "../queries"
import {
  TrendDownIcon as TrendingDown,
  TrendUpIcon as TrendingUp,
} from "@phosphor-icons/react"

// Recharts' ResponsiveContainer measures its box on mount and does not reliably
// re-measure when a flex parent grows afterwards. This chart's panel stretches
// to match Top categories beside it, but only once that list has loaded - so the
// chart would mount at the pre-stretch height and float above a gap. A callback
// ref wires a ResizeObserver the instant the fill box mounts (it appears only
// after data loads, which a mount-time effect would miss) and hands the chart an
// explicit pixel height, recomputed on every resize like a fixed wrapper would.
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

// Custom tooltip, adapted from chart-29
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
          {payload.map((item) => {
            // dataKey arrives from Recharts as a plain string, so it need not
            // be a velocityConfig key - check before trusting it.
            const label =
              item.dataKey in velocityConfig
                ? velocityConfig[item.dataKey as keyof typeof velocityConfig]
                    .label
                : item.dataKey
            return (
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
                    {label}
                  </span>
                </div>
                <span className="text-sm font-semibold text-popover-foreground">
                  {item.value.toLocaleString()}
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

/** An svg id fragment: pattern ids are referenced by name, so a category with a
 *  space or an ampersand in it must not break the reference. */
const patternId = (category: string) =>
  `velocity-hatch-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

// Hatched bar shape, adapted from chart-29. Keyed per CATEGORY, not per series:
// every bar used to share one pattern id, so the last def rendered won and all
// the bars took its color, whatever fill each was handed.
const CustomHatchedBar = (
  props: SVGProps<SVGRectElement> & { payload?: { category: string } }
) => {
  const { fill, x, y, width, height, payload } = props
  const id = patternId(payload?.category ?? "")
  return (
    <>
      <rect
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
    id="velocity-pattern-dots"
    x="0"
    y="0"
    width="10"
    height="10"
    patternUnits="userSpaceOnUse"
  >
    <circle className="text-muted" cx="2" cy="2" r="1" fill="currentColor" />
  </pattern>
)

export function VelocityChart({ range }: { range: DateRange }) {
  const { data: velocityData } = useQuery(dashboardVelocityQuery(range))
  // The derive ranks categories by units, and Top categories beside this chart
  // already owns that ranked view. Plot them in a stable A–Z order here so the
  // bars read as a balanced spread across the catalog, not one downhill slope.
  const chartData = velocityData
    ? [...velocityData].sort((a, b) => a.category.localeCompare(b.category))
    : undefined
  // Total units over the selected period against the equal-length one before
  // it. The badge used to be a hardcoded 14.2%, which no order could ever move.
  const { data: trend } = useQuery(dashboardVelocityTrendQuery(range))
  const { ref: fillRef, height: chartHeight } = useFillHeight()
  // The chart's rendered height, and where the bars' baseline sits within it:
  // the axis strip (30px) is below the plot, and the dotted backdrop has to
  // stop exactly there or the bars overhang the pattern.
  const containerHeight = Math.min(chartHeight || 320, 340)
  const backdropHeight = Math.max(0, containerHeight - 30)
  const trendUp = (trend ?? 0) >= 0
  return (
    <Frame dense className="h-full w-full">
      <FrameHeader className="flex-row items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <FrameTitle>Inventory velocity</FrameTitle>
          <FrameDescription>Units sold per category</FrameDescription>
        </div>
        {trend === undefined ? (
          <Skeleton className="h-5 w-14 rounded-md" />
        ) : (
          <Badge
            variant={trendUp ? "success-light" : "destructive-light"}
            className="shrink-0 gap-1"
          >
            {trendUp ? (
              <TrendingUp className="size-3.5" aria-hidden="true" />
            ) : (
              <TrendingDown className="size-3.5" aria-hidden="true" />
            )}
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </Badge>
        )}
      </FrameHeader>

      <FramePanel className="flex flex-1 flex-col">
        {!chartData ? (
          <Skeleton className="min-h-[320px] w-full flex-1 rounded-lg" />
        ) : chartData.length === 0 ? (
          // A resolved empty list is not the loading `undefined` above. This is
          // reachable with a populated store too - a selected period that holds
          // no orders sells no units - so it does not say "yet". Held at the
          // chart's own height so the panel keeps its shape.
          <div className="flex min-h-[320px] w-full flex-1 items-center justify-center">
            <p className="px-4 text-center text-sm text-muted-foreground">
              No units sold in this period. Create an order to see velocity
              here.
            </p>
          </div>
        ) : (
          // The panel stretches to match Top categories beside it. The chart
          // measures that box (useFillHeight) but CAPS its own height and
          // width and centers in the remainder: uncapped, seven bars stretch
          // into towers with a field of air between them. The caps keep the
          // group reading as a tight block at any panel size.
          <div
            ref={fillRef}
            className="flex min-h-[320px] w-full flex-1 flex-col justify-center"
          >
            <ChartContainer
              config={velocityConfig}
              className="mx-auto aspect-auto w-full max-w-3xl"
              style={{ height: containerHeight }}
            >
              <BarChart
                accessibilityLayer
                data={chartData}
                // Keep the seven bars reading as a group: a tighter category
                // gap pulls them together, and the cap stops a wide panel from
                // inflating them into slabs.
                barCategoryGap="10%"
                maxBarSize={84}
                margin={{ top: 16, right: 8, left: 8, bottom: 0 }}
              >
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height={backdropHeight}
                  fill="url(#velocity-pattern-dots)"
                />
                <defs>
                  <DottedBackgroundPattern />
                </defs>
                {/* Full category names: the ticks used to be cut to four
                  characters, which made Accessories and Activewear the same
                  label. Recharts drops ticks that would collide instead. */}
                <XAxis
                  dataKey="category"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis hide domain={[0, "dataMax"]} />
                <ChartTooltip cursor={false} content={<CustomTooltip />} />
                {/* A per-Cell fill with a custom shape leaves the grow animation
                  stuck at zero height, so the bars only render without it. */}
                <Bar
                  dataKey="velocity"
                  isAnimationActive={false}
                  shape={<CustomHatchedBar />}
                  radius={4}
                >
                  {chartData.map((datum) => (
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
