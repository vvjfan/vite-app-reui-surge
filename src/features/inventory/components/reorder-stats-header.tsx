"use client"

import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"

import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { useInventoryItems } from "../queries"
import { deriveReorderStats } from "./reorder-data"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

// Placeholder shown while the client reads items + metrics from the store, so
// no seed renders before the DB reads settle. Mirrors the header's layout.
function StatsHeaderSkeleton() {
  return (
    <Frame dense className="w-full">
      <FrameHeader>
        <FrameTitle>Reorder urgency</FrameTitle>
        <FrameDescription>What to restock first</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <div className="flex flex-col items-stretch sm:flex-row">
          <div className="flex shrink-0 flex-col justify-center gap-1.5 sm:basis-1/3 sm:pe-6">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-8 w-36" />
          </div>

          <Separator
            orientation="vertical"
            className="hidden self-stretch sm:block"
          />

          <div className="flex flex-1 flex-col justify-center gap-2 sm:ps-6">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          </div>
        </div>
      </FramePanel>
    </Frame>
  )
}

export function ReorderStatsHeader() {
  // Everything derives from the queried items, so the header tracks the store.
  //
  // `belowReorder` IS the queue (still short after open POs are netted) and
  // already contains the out-of-stock rows, so the headline is that count, split
  // into low stock vs out of stock. It therefore always equals the number of
  // rows in the grid below, which nets the same open POs.
  const { data: items, isPending } = useInventoryItems()

  if (isPending || !items) {
    return <StatsHeaderSkeleton />
  }

  const { belowReorder, outOfStock, atRiskValue } = deriveReorderStats(items)

  const segmentTotal = belowReorder
  const lowStock = Math.max(0, belowReorder - outOfStock)
  const lowPct = segmentTotal > 0 ? (lowStock / segmentTotal) * 100 : 0
  const outPct = segmentTotal > 0 ? (outOfStock / segmentTotal) * 100 : 0

  return (
    <Frame dense className="w-full">
      <FrameHeader>
        <FrameTitle>Reorder urgency</FrameTitle>
        <FrameDescription>What to restock first</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <div className="flex flex-col items-stretch sm:flex-row">
          {/* Left: at-risk inventory value */}
          <div className="flex shrink-0 flex-col justify-center sm:basis-1/3 sm:pe-6">
            <span className="text-xs text-muted-foreground">
              At-risk inventory value
            </span>
            <span className="mt-1 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {formatCurrency(atRiskValue)}
            </span>
          </div>

          <Separator
            orientation="vertical"
            className="hidden self-stretch sm:block"
          />

          {/* Right: queue size + segmented urgency bar + legend */}
          <div className="flex flex-1 flex-col justify-center gap-2 sm:ps-6">
            <div>
              <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                {segmentTotal.toLocaleString()}
              </span>{" "}
              <span className="text-xs text-muted-foreground">
                SKUs needing action
              </span>
            </div>

            <div
              className="flex h-1.5 w-full items-center gap-0.5 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Reorder queue: ${lowStock} low stock, ${outOfStock} out of stock`}
            >
              <span
                className="h-full bg-warning"
                style={{ width: `${lowPct}%` }}
              />
              <span
                className="h-full bg-destructive"
                style={{ width: `${outPct}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
              <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="inline-block size-2 rounded-full bg-warning"
                  aria-hidden="true"
                />
                <span>
                  Low stock:{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {lowStock.toLocaleString()}
                  </span>
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="inline-block size-2 rounded-full bg-destructive"
                  aria-hidden="true"
                />
                <span>
                  Out of stock:{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {outOfStock.toLocaleString()}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </FramePanel>
    </Frame>
  )
}
