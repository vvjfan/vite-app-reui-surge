"use client"

import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import type { StockRow } from "../queries"
import { useInventoryItems } from "../queries"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function LegendItem({
  dot,
  label,
  count,
}: {
  dot: string
  label: string
  count: number
}) {
  return (
    <div className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span
        className={cn("inline-block size-2 rounded-full", dot)}
        aria-hidden="true"
      />
      <span>
        {label}:{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {count.toLocaleString()}
        </span>
      </span>
    </div>
  )
}

// Derive the stock-health summary from the queried rows (the donor block read a
// hardcoded singleton; this reflects the live store instead).
//
// Every status is counted, so the segments always add up to the SKU total shown
// beside the bar. The donor block charted only in/low/out, which silently
// dropped the backordered and discontinued rows: the bar claimed to describe
// "14 SKUs" while its segments were scaled against 12.
//
// Stock value uses the row's on-hand summed across locations, so a SKU split
// between warehouses is valued once, not once per shelf.
function deriveSummary(items: StockRow[]) {
  return {
    totalStockValue: items.reduce(
      (sum, item) => sum + item.onHand * item.unitCost,
      0
    ),
    totalSkus: items.length,
    inStock: items.filter((item) => item.status === "In stock").length,
    lowStock: items.filter((item) => item.status === "Low stock").length,
    outOfStock: items.filter((item) => item.status === "Out of stock").length,
    backordered: items.filter((item) => item.status === "Backordered").length,
    discontinued: items.filter((item) => item.status === "Discontinued").length,
  }
}

// Placeholder shown while the client reads items from the store, so no seed
// renders before the DB read settles. Mirrors the header's layout.
function StatsHeaderSkeleton() {
  return (
    <Frame dense className="w-full">
      <FrameHeader>
        <FrameTitle>Stock health</FrameTitle>
        <FrameDescription>Stock value and status</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <div className="flex flex-col items-stretch sm:flex-row">
          <div className="flex shrink-0 flex-col justify-center gap-1.5 sm:basis-1/3 sm:pe-6">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-36" />
          </div>

          <Separator
            orientation="vertical"
            className="hidden self-stretch sm:block"
          />

          <div className="flex flex-1 flex-col justify-center gap-2 sm:ps-6">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          </div>
        </div>
      </FramePanel>
    </Frame>
  )
}

export function StatsHeader() {
  const { data: items, isPending } = useInventoryItems()

  if (isPending || !items) {
    return <StatsHeaderSkeleton />
  }

  const {
    totalStockValue,
    totalSkus,
    inStock,
    lowStock,
    outOfStock,
    backordered,
    discontinued,
  } = deriveSummary(items)

  // Scale every segment against the SKU total rendered beside the bar, so the
  // two always agree.
  const pct = (count: number) => (totalSkus > 0 ? (count / totalSkus) * 100 : 0)

  return (
    <Frame dense className="w-full">
      <FrameHeader>
        <FrameTitle>Stock health</FrameTitle>
        <FrameDescription>Stock value and status</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <div className="flex flex-col items-stretch sm:flex-row">
          {/* Left: total stock value */}
          <div className="flex shrink-0 flex-col justify-center sm:basis-1/3 sm:pe-6">
            <span className="text-xs text-muted-foreground">
              Total Stock Value
            </span>
            <span className="mt-1 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {formatCurrency(totalStockValue)}
            </span>
          </div>

          <Separator
            orientation="vertical"
            className="hidden self-stretch sm:block"
          />

          {/* Right: SKU count + segmented bar + legend */}
          <div className="flex flex-1 flex-col justify-center gap-2 sm:ps-6">
            <div>
              <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                {totalSkus.toLocaleString()}
              </span>{" "}
              <span className="text-xs text-muted-foreground">SKUs</span>
            </div>

            <div
              className="flex h-1.5 w-full items-center gap-0.5 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Stock health across ${totalSkus} SKUs: ${inStock} in stock, ${lowStock} low stock, ${outOfStock} out of stock, ${backordered} backordered, ${discontinued} discontinued`}
            >
              <span
                className="h-full bg-success"
                style={{ width: `${pct(inStock)}%` }}
              />
              <span
                className="h-full bg-warning"
                style={{ width: `${pct(lowStock)}%` }}
              />
              <span
                className="h-full bg-destructive"
                style={{ width: `${pct(outOfStock)}%` }}
              />
              <span
                className="h-full bg-destructive/60"
                style={{ width: `${pct(backordered)}%` }}
              />
              <span
                className="h-full bg-muted-foreground/40"
                style={{ width: `${pct(discontinued)}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
              <LegendItem dot="bg-success" label="In stock" count={inStock} />
              <LegendItem dot="bg-warning" label="Low stock" count={lowStock} />
              <LegendItem
                dot="bg-destructive"
                label="Out of stock"
                count={outOfStock}
              />
              {/* Only surfaced when present, so a catalog without them keeps a
                  three-part legend. */}
              {backordered > 0 ? (
                <LegendItem
                  dot="bg-destructive/60"
                  label="Backordered"
                  count={backordered}
                />
              ) : null}
              {discontinued > 0 ? (
                <LegendItem
                  dot="bg-muted-foreground/40"
                  label="Discontinued"
                  count={discontinued}
                />
              ) : null}
            </div>
          </div>
        </div>
      </FramePanel>
    </Frame>
  )
}
