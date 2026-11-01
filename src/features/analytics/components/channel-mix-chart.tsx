import { useQuery } from "@tanstack/react-query"
import { LabelList, Pie, PieChart } from "recharts"
import { toast } from "sonner"

import { IconTile } from "@/components/shared/icon-tile"
import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import type { TrafficChannel } from "@/lib/data/analytics"
import { ordersListQuery } from "@/features/orders/queries"
import {
  channelSessionsQuery,
  orderAttributionQuery,
  sessionsOverTimeQuery,
} from "../queries"
import {
  channelPerformance,
  deltas,
  type ChannelPerformance,
} from "../lib/derive"
import { formatCount, formatCurrency, formatPercent } from "../lib/format"
import {
  InfoIcon,
  ChartPieIcon as PieChartIcon,
  TrendDownIcon as TrendingDownIcon,
  TrendUpIcon as TrendingUpIcon,
} from "@phosphor-icons/react"

// Relocated from the ReUI chart-27 block (donut + total + trend badge). Adapted
// to carry channel sessions instead of browser share. Two changes beyond data:
// the block's hardcoded +5.2% badge now shows the real sessions delta, and its
// 5D/2W/1M tabs are dropped because our reporting window is a single fixed range
// (a tab bar that cannot switch anything is a dead control).

const chartConfig = {
  sessions: { label: "Sessions" },
  organic: { label: "Organic", color: "var(--color-blue-500)" },
  direct: { label: "Direct", color: "var(--color-sky-500)" },
  paid: { label: "Paid", color: "var(--color-orange-500)" },
  social: { label: "Social", color: "var(--color-indigo-500)" },
  email: { label: "Email", color: "var(--color-emerald-500)" },
  referral: { label: "Referral", color: "var(--color-slate-500)" },
}

const CHANNEL_LABEL: Record<TrafficChannel, string> = {
  organic: "Organic",
  direct: "Direct",
  paid: "Paid",
  social: "Social",
  email: "Email",
  referral: "Referral",
}

// The tooltip carries channel performance: sessions from the event stream,
// orders and revenue joined to the REAL orders through the per-order
// attribution map.
const ChannelTooltip = ({
  active,
  payload,
  performance,
}: {
  active?: boolean
  payload?: { name?: string; value?: number; payload?: { fill?: string } }[]
  performance: Map<TrafficChannel, ChannelPerformance>
}) => {
  if (!active || !payload || payload.length === 0) return null
  const entry = payload[0]
  const channel = entry.name as TrafficChannel
  const perf = performance.get(channel)
  // Recharts hands back `name` as a plain string, so the cast above is a best
  // guess - check the key before trusting it, and fall back to the raw name.
  const channelLabel =
    channel in CHANNEL_LABEL ? CHANNEL_LABEL[channel] : channel

  return (
    <div className="min-w-[190px] rounded-lg border bg-popover p-3 shadow-lg">
      <div className="mb-2 flex items-center gap-2 border-b border-border/50 pb-2 text-sm font-semibold text-popover-foreground">
        <div
          className="size-2 rounded-sm"
          style={{ backgroundColor: entry.payload?.fill }}
        />
        {channelLabel}
      </div>
      <div className="space-y-1">
        {[
          ["Sessions", formatCount(entry.value ?? 0)],
          ["Orders", formatCount(perf?.orders ?? 0)],
          ["Revenue", formatCurrency(perf?.revenue ?? 0)],
          ["Conversion", formatPercent(perf?.conversionRate ?? 0, 2)],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-muted-foreground">
              {label}
            </span>
            <span className="text-sm font-semibold text-popover-foreground">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChannelMixChart() {
  const channelsQuery = useQuery(channelSessionsQuery())
  const sessionsQuery = useQuery(sessionsOverTimeQuery())
  const attributionQuery = useQuery(orderAttributionQuery())
  const ordersQuery = useQuery(ordersListQuery())
  const isPending = channelsQuery.isPending || sessionsQuery.isPending

  const channels = channelsQuery.data ?? []
  const trend = deltas(ordersQuery.data ?? [], sessionsQuery.data ?? [])
  const up = trend.sessions >= 0
  const totalSessions = channels.reduce((sum, item) => sum + item.sessions, 0)

  // Orders and revenue per channel, joined to the real orders via attribution.
  const performance = new Map<TrafficChannel, ChannelPerformance>(
    channelPerformance(
      ordersQuery.data ?? [],
      attributionQuery.data ?? {},
      channels
    ).map((entry) => [entry.channel, entry])
  )

  // Recharts colours each slice from `fill`; map our channel keys onto the
  // chart config's CSS vars.
  const data = channels.map((item) => ({
    channel: item.channel,
    sessions: item.sessions,
    fill: `var(--color-${item.channel})`,
  }))

  return (
    <Frame dense className="h-full w-full">
      <FrameHeader className="flex-row items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <FrameTitle>Sessions by channel</FrameTitle>
          <FrameDescription>First-touch attribution</FrameDescription>
        </div>
        <div className="flex items-center gap-2">
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
              <span>{formatPercent(Math.abs(trend.sessions))}</span>
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.success("Exporting channel report", {
                description: "Demo. Download from your storage.",
              })
            }
          >
            Export
          </Button>
        </div>
      </FrameHeader>
      <FramePanel className="space-y-6">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <IconTile>
              <PieChartIcon aria-hidden="true" />
            </IconTile>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Total sessions
              </div>
              <div className="text-2xl font-semibold tracking-tight tabular-nums">
                {isPending ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  formatCount(totalSessions)
                )}
              </div>
            </div>
          </div>

          <div className="mx-auto aspect-square max-h-[200px] w-full">
            {isPending ? (
              <Skeleton className="mx-auto aspect-square h-full rounded-full" />
            ) : data.length === 0 ? (
              // Settled with no channels, which the `isPending` branch above
              // does not cover: a pie of nothing draws nothing. Sessions are not
              // something this admin creates, so point at where they come from.
              <div className="flex h-full w-full items-center justify-center">
                <p className="px-4 text-center text-sm text-muted-foreground">
                  No sessions yet. Channels appear once visitors reach your
                  store.
                </p>
              </div>
            ) : (
              <ChartContainer
                config={chartConfig}
                className="h-full w-full overflow-visible"
              >
                <PieChart className="overflow-visible">
                  <ChartTooltip
                    content={<ChannelTooltip performance={performance} />}
                  />
                  <Pie
                    data={data}
                    innerRadius={35}
                    outerRadius={100}
                    dataKey="sessions"
                    nameKey="channel"
                    strokeWidth={4}
                    stroke="var(--background)"
                    cornerRadius={8}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="sessions"
                      stroke="none"
                      fontSize={12}
                      fontWeight={600}
                      fill="white"
                      formatter={(value: unknown) => {
                        const n = Number(value)
                        return n >= 1000
                          ? `${(n / 1000).toFixed(1)}k`
                          : String(n)
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </div>

          <div className="flex items-center gap-2 px-2 text-sm text-muted-foreground">
            <InfoIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Sessions attributed on first touch, from the storefront event
              stream.
            </span>
          </div>
        </div>
      </FramePanel>
    </Frame>
  )
}
