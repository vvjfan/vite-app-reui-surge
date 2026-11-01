import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/reui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ordersListQuery } from "@/features/orders/queries"
import { sessionsOverTimeQuery } from "../queries"
import { deltas, overview } from "../lib/derive"
import {
  formatCompactCurrency,
  formatCount,
  formatPercent,
} from "../lib/format"
import {
  MoneyIcon as BanknoteIcon,
  CursorClickIcon as MousePointerClickIcon,
  BagIcon as ShoppingBagIcon,
  UsersIcon,
} from "@phosphor-icons/react"

// Relocated from the ReUI card-29 block. The design is the block's; what it
// carries is ours: real KPIs (money joined from the orders entity at read time,
// traffic from the seeded analytics aggregates) and real period-over-period
// deltas rather than the block's hardcoded percentages.

const METRIC_AREA_LEVELS = [
  { back: [34, 2], fill: [48, 16] },
  { back: [2, 36], fill: [16, 50] },
  { back: [36, 0], fill: [50, 10] },
  { back: [0, 22], fill: [10, 32] },
] as const

const METRIC_AREA_GRADIENTS = [
  "from-indigo-400 via-indigo-500 to-indigo-600",
  "from-indigo-500 via-indigo-600 to-indigo-700",
  "from-indigo-600 via-indigo-700 to-indigo-800",
  "from-indigo-700 via-indigo-800 to-indigo-950",
] as const

function MetricAreaShape({ index }: { index: number }) {
  const levels = METRIC_AREA_LEVELS[index % METRIC_AREA_LEVELS.length]
  const fillGradient =
    METRIC_AREA_GRADIENTS[index % METRIC_AREA_GRADIENTS.length]
  const backClipPath = `polygon(0 ${levels.back[0]}%, 100% ${levels.back[1]}%, 100% 100%, 0 100%)`
  const fillClipPath = `polygon(0 ${levels.fill[0]}%, 100% ${levels.fill[1]}%, 100% 100%, 0 100%)`

  return (
    <div
      aria-hidden="true"
      className="relative -mx-4 mt-4 -mb-4 h-36 overflow-hidden"
    >
      <div
        className="absolute inset-x-0 bottom-0 h-full bg-indigo-100/80 dark:bg-indigo-950/50"
        style={{ clipPath: backClipPath }}
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 h-full bg-gradient-to-br",
          fillGradient
        )}
        style={{ clipPath: fillClipPath }}
      />
      <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-indigo-950/20 to-transparent" />
    </div>
  )
}

type Kpi = {
  icon: ReactNode
  title: string
  value: string
  delta: number
  description: string
}

function KpiCard({
  kpi,
  index,
  total,
}: {
  kpi: Kpi
  index: number
  total: number
}) {
  const isLast = index === total - 1
  const isEvenColumn = index % 2 === 1
  const isInTopTabletRow = index < total - 2
  const up = kpi.delta >= 0

  return (
    <div
      className={cn(
        // Divider ladder on the same container breakpoints as the grid
        // (@2xl two columns, @4xl four): a viewport-based md: here would
        // draw dividers for a column count the container has not reached.
        "flex min-h-[316px] flex-col overflow-hidden border-border/60 p-4",
        !isLast && "border-b",
        !isEvenColumn && "@2xl:border-r",
        isInTopTabletRow ? "@2xl:border-b" : "@2xl:border-b-0",
        index < total - 1 ? "@4xl:border-r" : "@4xl:border-r-0",
        "@4xl:border-b-0"
      )}
    >
      <div className="flex flex-1 flex-col justify-between gap-4">
        <div className="[&_svg]:size-5 [&_svg]:text-muted-foreground">
          {kpi.icon}
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm leading-relaxed text-muted-foreground">
            {kpi.title}
          </h3>
          <div className="flex items-center gap-1.5">
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {kpi.value}
            </div>
            <Badge variant={up ? "success-light" : "destructive-light"}>
              <span>
                {up ? "+" : ""}
                {formatPercent(kpi.delta)}
              </span>
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{kpi.description}</p>
      </div>
      <MetricAreaShape index={index} />
    </div>
  )
}

function KpiSkeleton({ index, total }: { index: number; total: number }) {
  // Mirrors KpiCard's divider ladder exactly, so the strip's lines do not
  // move when the data lands.
  const isLast = index === total - 1
  const isEvenColumn = index % 2 === 1
  const isInTopTabletRow = index < total - 2
  return (
    <div
      className={cn(
        "flex min-h-[316px] flex-col justify-between gap-4 overflow-hidden border-border/60 p-4",
        !isLast && "border-b",
        !isEvenColumn && "@2xl:border-r",
        isInTopTabletRow ? "@2xl:border-b" : "@2xl:border-b-0",
        index < total - 1 ? "@4xl:border-r" : "@4xl:border-r-0",
        "@4xl:border-b-0"
      )}
    >
      <Skeleton className="size-5 rounded" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="-mx-4 -mb-4 h-36 rounded-none" />
    </div>
  )
}

export function AnalyticsKpis() {
  const ordersQuery = useQuery(ordersListQuery())
  const sessionsQuery = useQuery(sessionsOverTimeQuery())
  const isPending = ordersQuery.isPending || sessionsQuery.isPending

  const orders = ordersQuery.data ?? []
  const sessions = sessionsQuery.data ?? []
  const totals = overview(orders, sessions)
  const trend = deltas(orders, sessions)

  const kpis: Kpi[] = [
    {
      icon: <BanknoteIcon aria-hidden="true" />,
      title: "Total sales",
      value: formatCompactCurrency(Math.round(totals.sales)),
      delta: trend.sales,
      description: `${formatCompactCurrency(Math.round(totals.aov))} average order value`,
    },
    {
      icon: <ShoppingBagIcon aria-hidden="true" />,
      title: "Orders",
      value: formatCount(totals.orders),
      delta: trend.orders,
      description: "Orders placed in this window",
    },
    {
      icon: <UsersIcon aria-hidden="true" />,
      title: "Sessions",
      value: formatCount(totals.sessions),
      delta: trend.sessions,
      description: `Across ${sessions.length} days of storefront traffic`,
    },
    {
      icon: <MousePointerClickIcon aria-hidden="true" />,
      title: "Conversion rate",
      value: formatPercent(totals.conversionRate, 2),
      delta: trend.conversionRate,
      description: `${formatCount(totals.orders)} of ${formatCount(totals.sessions)} sessions converted`,
    },
  ]

  return (
    <div className="@container w-full">
      {/* A card, not a frame: a headerless dense frame stacks its border on
          the panel's into a doubled top line. Each tile names itself, so the
          strip only needs the region name to be announced. */}
      <section aria-label="Key metrics">
        <Card className="w-full py-0">
          <div className="grid @2xl:grid-cols-2 @4xl:grid-cols-4">
            {isPending
              ? Array.from({ length: 4 }, (_, index) => (
                  <KpiSkeleton key={index} index={index} total={4} />
                ))
              : kpis.map((kpi, index) => (
                  <KpiCard
                    key={kpi.title}
                    kpi={kpi}
                    index={index}
                    total={kpis.length}
                  />
                ))}
          </div>
        </Card>
      </section>
    </div>
  )
}
