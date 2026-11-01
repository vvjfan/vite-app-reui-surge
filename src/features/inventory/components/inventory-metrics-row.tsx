import { Card } from "@/components/ui/card"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { StockRow } from "../queries"
import { needsReorder, useInventoryItems } from "../queries"

type MetricTone = "default" | "warning"

interface DerivedMetric {
  id: string
  title: string
  label: string
  value: string
  detail: string
  tone: MetricTone
}

// Every card derives from the queried rows, so the strip tracks the store: a
// stock adjustment moves these immediately.
//
// The donor block shipped authored values (a "$847K" string) plus sparklines,
// which both contradicted the derived stock-health bar below and could never
// reflect a real backend. There is no stock history in the data to draw a trend
// from, so the sparkline and the "vs plan" delta are gone rather than faked.
// Total stock value and the SKU mix belong to StatsHeader; these four answer
// questions nothing else on the page answers.
//
// Rows arrive already summed across their stock locations, so every count here
// is catalog-wide regardless of how many warehouses a SKU sits in.
function deriveMetrics(items: StockRow[]): DerivedMetric[] {
  const skus = items.length
  const unitsOnHand = items.reduce((sum, i) => sum + i.onHand, 0)
  const allocated = items.reduce((sum, i) => sum + i.allocated, 0)
  const available = items.reduce((sum, i) => sum + i.available, 0)
  // The queue's own predicate, so this count cannot disagree with the number of
  // rows /inventory/reorder lists.
  const reorderRisk = items.filter(needsReorder).length

  // How long the available stock lasts at the catalog's current run rate, the
  // standard "days of inventory remaining". Rows with no demand signal
  // are excluded from both sides so dead stock cannot inflate the ratio (and so
  // an all-dead catalog reports "no run rate" instead of dividing by zero).
  const moving = items.filter((item) => item.dailyVelocity > 0)
  const movingAvailable = moving.reduce((sum, i) => sum + i.available, 0)
  const movingVelocity = moving.reduce((sum, i) => sum + i.dailyVelocity, 0)
  const daysOfCover =
    movingVelocity > 0 ? movingAvailable / movingVelocity : null
  const avgLeadTime =
    moving.length > 0
      ? moving.reduce((sum, i) => sum + i.leadTimeDays, 0) / moving.length
      : 0
  // Stock runs dry before a replenishment order can realistically land.
  const coverBelowLeadTime = daysOfCover !== null && daysOfCover < avgLeadTime

  return [
    {
      id: "days-of-cover",
      title: "Days of Cover",
      label: "At current run rate",
      value: daysOfCover === null ? "None" : `${daysOfCover.toFixed(1)}d`,
      detail:
        daysOfCover === null
          ? "no run rate"
          : `${avgLeadTime.toFixed(1)}d avg lead time`,
      tone: coverBelowLeadTime ? "warning" : "default",
    },
    {
      id: "reorder-risk",
      title: "Reorder Risk",
      label: "At or below point",
      value: reorderRisk.toLocaleString(),
      detail: `of ${skus.toLocaleString()} SKUs`,
      tone: reorderRisk > 0 ? "warning" : "default",
    },
    {
      id: "units-on-hand",
      title: "Units On Hand",
      label: "Across all SKUs",
      value: unitsOnHand.toLocaleString(),
      detail: `${available.toLocaleString()} available`,
      tone: "default",
    },
    {
      id: "allocated",
      title: "Allocated",
      label: "Committed to orders",
      value: allocated.toLocaleString(),
      detail: `${skus.toLocaleString()} SKUs tracked`,
      tone: "default",
    },
  ]
}

const toneStyles: Record<MetricTone, string> = {
  default: "text-foreground",
  warning: "text-warning-foreground",
}

function InventoryMetricTile({ metric }: { metric: DerivedMetric }) {
  return (
    // A card, not a headerless dense frame (whose border doubles the panel's).
    // The visible title is the tile's own accessible name now.
    <Card className="h-full min-h-[7.25rem] justify-between gap-5 px-(--card-spacing)">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm leading-4 font-semibold text-foreground">
          {metric.title}
        </span>
        <span className="truncate text-xs leading-4 text-muted-foreground">
          {metric.label}
        </span>
      </div>

      <div className="min-w-0 space-y-2.5">
        <div
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            toneStyles[metric.tone]
          )}
        >
          {metric.value}
        </div>
        <span className="block truncate text-xs text-muted-foreground">
          {metric.detail}
        </span>
      </div>
    </Card>
  )
}

// Placeholder tile shown while the client reads the rows from the store, so no
// seed renders before the DB read settles. Mirrors InventoryMetricTile's layout.
function InventoryMetricTileSkeleton() {
  return (
    <Card
      aria-label="Inventory metric loading"
      className="h-full min-h-[7.25rem] justify-between gap-5 px-(--card-spacing)"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="min-w-0 space-y-2.5">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-3.5 w-28" />
      </div>
    </Card>
  )
}

export function InventoryMetricsRow() {
  const { data: items, isPending } = useInventoryItems()

  return (
    <section
      aria-label="Inventory Metrics"
      className="grid grid-cols-2 gap-6 lg:grid-cols-4"
    >
      {isPending || !items
        ? Array.from({ length: 4 }).map((_, index) => (
            <InventoryMetricTileSkeleton key={index} />
          ))
        : deriveMetrics(items).map((metric) => (
            <InventoryMetricTile key={metric.id} metric={metric} />
          ))}
    </section>
  )
}
