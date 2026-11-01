import { type ReactNode, useMemo } from "react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"

import { cn } from "@/lib/utils"
import { ProductRef } from "@/components/shared/product-ref"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { type ReorderRow } from "./reorder-data"
import { StatusBadge } from "./reorder-columns"
import { ArchiveIcon, ShoppingCartIcon, XIcon } from "@phosphor-icons/react"

const FRAME_PANEL_RESET = "shadow-none!"

const coverageConfig = {
  onHand: { label: "On hand", color: "var(--primary)" },
} satisfies ChartConfig

// SectionCard / Stat: the dense Frame-card and tile grammar shared with the
// stock detail sheet, so the two inventory drawers read as one family.
function SectionCard({
  label,
  children,
}: {
  label?: string
  children: ReactNode
}) {
  return (
    <Frame dense spacing="sm" className="w-full">
      {label ? (
        <FrameHeader>
          <FrameTitle className="text-sm">{label}</FrameTitle>
        </FrameHeader>
      ) : null}
      <FramePanel className={FRAME_PANEL_RESET}>{children}</FramePanel>
    </Frame>
  )
}

function Stat({
  label,
  children,
  tone,
}: {
  label: string
  children: ReactNode
  tone?: "critical"
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div
        className={cn(
          "flex min-w-0 items-center text-lg font-semibold tabular-nums",
          tone === "critical" ? "text-destructive" : "text-foreground"
        )}
      >
        {children}
      </div>
    </div>
  )
}

// Project the shelf forward: it burns down at the SKU's own daily rate, floors
// at zero when it runs out, and jumps by the suggested quantity on the day a PO
// raised today would land (its lead time). The horizon runs past that arrival so
// the recovery, not just the shortfall, is on screen.
function buildProjection(row: ReorderRow) {
  const horizon = Math.max(21, row.leadTimeDays + 14)
  const series: { day: number; onHand: number }[] = []
  let stock = row.available
  for (let day = 0; day <= horizon; day += 1) {
    if (day === row.leadTimeDays) stock += row.suggestedPo
    series.push({ day, onHand: Math.max(0, Math.round(stock)) })
    stock = Math.max(0, stock - row.dailyVelocity)
  }
  return { series, horizon }
}

function CoverageChart({ row }: { row: ReorderRow }) {
  const { series, horizon } = useMemo(() => buildProjection(row), [row])
  return (
    <ChartContainer config={coverageConfig} className="h-[150px] w-full">
      <ComposedChart
        accessibilityLayer
        data={series}
        margin={{ top: 6, right: 8, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="coverageGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          strokeDasharray="4 4"
          stroke="var(--border)"
        />
        <XAxis
          dataKey="day"
          type="number"
          domain={[0, horizon]}
          ticks={[0, row.leadTimeDays, horizon]}
          tickFormatter={(value) => (value === 0 ? "today" : `${value}d`)}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11 }}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11 }}
          width={30}
          allowDecimals={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) =>
                Number(value) === 0 ? "Today" : `Day ${value}`
              }
            />
          }
        />
        {/* The line the reorder point defends, and the day a PO would land. */}
        <ReferenceLine
          y={row.reorderPoint}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          strokeOpacity={0.55}
        />
        <ReferenceLine
          x={row.leadTimeDays}
          stroke="var(--border)"
          label={{
            value: "PO arrives",
            position: "insideTopRight",
            fontSize: 10,
            fill: "var(--muted-foreground)",
          }}
        />
        <Area
          type="monotone"
          dataKey="onHand"
          fill="url(#coverageGradient)"
          stroke="transparent"
        />
        <Line
          type="monotone"
          dataKey="onHand"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}

export function ReorderDetailSheet({
  row,
  open,
  onOpenChange,
  onCreatePo,
}: {
  row: ReorderRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreatePo: (row: ReorderRow) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="z-50 flex flex-col gap-0 overflow-hidden rounded-xl bg-popover p-0 outline-none data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:left-auto data-[side=right]:h-[calc(100svh-2rem)] data-[side=right]:w-[min(30rem,calc(100vw-2rem))] data-[side=right]:max-w-none data-[side=right]:sm:max-w-none"
      >
        {/* Header: the context title, then the product identity with its status. */}
        <SheetHeader className="shrink-0 gap-0 border-b p-0">
          <div className="flex min-h-11 items-center justify-between gap-2 px-5">
            <SheetTitle className="min-w-0 truncate text-sm font-semibold">
              Reorder detail
            </SheetTitle>
            <SheetClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close sheet"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <XIcon aria-hidden="true" />
                </Button>
              }
            />
          </div>
          <SheetDescription className="sr-only">
            Review availability, deficit, and suggested purchase order for this
            SKU.
          </SheetDescription>
          {row ? (
            <div className="flex items-center gap-3 px-5 pt-1 pb-4">
              {row.thumbnail ? (
                <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border/60">
                  <img
                    src={row.thumbnail}
                    alt={row.name}
                    className="size-11 object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : (
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-border/60"
                  aria-hidden="true"
                >
                  <ArchiveIcon className="size-5" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <ProductRef
                  product={{ id: row.productId, title: row.name }}
                  className="text-sm font-semibold text-foreground"
                />
                <div className="truncate font-mono text-xs text-muted-foreground">
                  {row.sku}
                </div>
              </div>
              <StatusBadge status={row.status} />
            </div>
          ) : null}
        </SheetHeader>

        {/* Body: dense Frame cards. */}
        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full min-h-0">
            {row ? (
              <div className="flex flex-col gap-3 px-5 py-4">
                {/* Coverage: the shelf projected forward, and the risk in tiles. */}
                <SectionCard label="Coverage">
                  <div className="flex flex-col gap-3.5">
                    <CoverageChart row={row} />
                    <p className="text-xs text-muted-foreground">
                      Projected at {row.dailyVelocity.toLocaleString()}/day.
                      Reorder at {row.reorderPoint.toLocaleString()}.
                    </p>
                    <div className="grid grid-cols-3 gap-x-4 border-t pt-3.5">
                      <Stat label="Deficit" tone="critical">
                        {row.deficit.toLocaleString()}
                      </Stat>
                      <Stat
                        label="Days of cover"
                        tone={row.daysOfCover < 7 ? "critical" : undefined}
                      >
                        {row.daysOfCover}d
                      </Stat>
                      <Stat label="Lead time">{row.leadTimeDays}d</Stat>
                    </div>
                  </div>
                </SectionCard>

                {/* Suggested order: what to raise, and who from. */}
                <SectionCard label="Suggested order">
                  <div className="flex flex-col gap-3.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-semibold text-foreground tabular-nums">
                        {row.suggestedPo.toLocaleString()}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        units to order
                      </span>
                    </div>
                    <dl className="grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-2.5">
                      <dt className="text-sm text-muted-foreground">
                        Supplier
                      </dt>
                      <dd className="min-w-0 truncate text-sm text-foreground">
                        {row.supplier}
                      </dd>
                    </dl>
                  </div>
                </SectionCard>
              </div>
            ) : null}
          </ScrollArea>
        </div>

        {/* Footer */}
        <SheetFooter className="shrink-0 border-t bg-background px-5 py-4">
          <div className="flex w-full gap-2">
            <Button
              type="button"
              className="min-w-0 flex-1"
              onClick={() => {
                if (!row) return
                onCreatePo(row)
              }}
            >
              <ShoppingCartIcon aria-hidden="true" />
              Create PO
            </Button>
            <SheetClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-0 flex-1"
                >
                  Close
                </Button>
              }
            />
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
