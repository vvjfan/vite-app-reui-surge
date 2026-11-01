import { cn } from "@/lib/utils"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { ProductRef } from "@/components/shared/product-ref"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatCurrency } from "@/features/products/lib/format"
import { formatOrderDate } from "@/features/orders/lib/format"
import { locationName } from "@/lib/data/locations"
import type { StockLocation } from "@/lib/data/locations"
import {
  purchaseOrderTotal,
  purchaseOrderUnits,
  type PurchaseOrder,
  type PurchaseOrderLine,
} from "@/lib/data/purchase-orders"
import { PoStatusBadge } from "./purchase-orders-columns"
import {
  PackageIcon as PackageCheckIcon,
  PackageIcon,
  XIcon,
} from "@phosphor-icons/react"

const FRAME_PANEL_RESET = "shadow-none!"

// ── Left column: order data ──

function OrderDataSection({
  order,
  locations,
}: {
  order: PurchaseOrder
  locations: StockLocation[]
}) {
  const stats: { label: string; value: React.ReactNode }[] = [
    {
      label: "Items",
      value: (
        <span className="text-sm font-medium text-foreground tabular-nums">
          {order.lines.length} SKU{order.lines.length === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      label: "Total Value",
      value: (
        <span className="text-sm font-medium text-foreground tabular-nums">
          {formatCurrency(purchaseOrderTotal(order))}
        </span>
      ),
    },
    {
      label: "Supplier",
      value: (
        <span className="text-sm font-medium text-foreground">
          {order.supplierName}
        </span>
      ),
    },
    {
      label: "Receive Into",
      value: (
        <span className="text-sm font-medium text-foreground">
          {locationName(locations, order.locationId)}
        </span>
      ),
    },
  ]
  return (
    <Frame dense spacing="sm" className="w-full">
      <FrameHeader>
        <FrameTitle>Order Data</FrameTitle>
      </FrameHeader>
      <FramePanel className={FRAME_PANEL_RESET}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex min-w-0 flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {stat.label}
              </span>
              <div className="min-w-0">{stat.value}</div>
            </div>
          ))}
        </div>
      </FramePanel>
    </Frame>
  )
}

// ── Left column: line items ──

function LineItemRow({ line }: { line: PurchaseOrderLine }) {
  return (
    <Item role="listitem" className="items-center gap-3 px-0 py-0">
      <ItemMedia
        variant="image"
        className="relative size-10 shrink-0 border bg-muted text-muted-foreground"
      >
        {line.thumbnail ? (
          <img src={line.thumbnail} alt={line.name} />
        ) : (
          <PackageIcon className="size-4" aria-hidden="true" />
        )}
      </ItemMedia>
      <ItemContent className="min-w-0 flex-1 gap-0.5">
        <ItemTitle className="text-sm font-medium text-foreground">
          <ProductRef product={{ id: line.productId, title: line.name }} />
        </ItemTitle>
        <ItemDescription className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          <span>SKU:</span>
          <span className="font-mono font-medium text-foreground">
            {line.sku}
          </span>
        </ItemDescription>
      </ItemContent>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-sm font-medium text-foreground tabular-nums">
          {formatCurrency(line.quantity * line.unitCost)}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {line.quantity.toLocaleString()} × {formatCurrency(line.unitCost)}
        </span>
      </div>
    </Item>
  )
}

function LineItemsSection({ order }: { order: PurchaseOrder }) {
  return (
    <Frame dense spacing="sm" className="w-full">
      <FrameHeader>
        <FrameTitle>Line items</FrameTitle>
      </FrameHeader>
      <FramePanel className={cn("flex flex-col gap-4", FRAME_PANEL_RESET)}>
        <div role="list" className="flex flex-col gap-4">
          {order.lines.map((line) => (
            <LineItemRow key={line.sku} line={line} />
          ))}
        </div>
      </FramePanel>
    </Frame>
  )
}

// ── Right rail: summary ──

function SummarySection({
  order,
  locations,
}: {
  order: PurchaseOrder
  locations: StockLocation[]
}) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Status", value: <PoStatusBadge status={order.status} /> },
    { label: "Raised", value: formatOrderDate(order.createdAt) },
    ...(order.status === "received" && order.receivedAt
      ? [{ label: "Received", value: formatOrderDate(order.receivedAt) }]
      : order.expectedDate
        ? [{ label: "Expected", value: formatOrderDate(order.expectedDate) }]
        : []),
  ]
  return (
    <Frame dense spacing="sm" className="w-full">
      <FrameHeader>
        <FrameTitle>Summary</FrameTitle>
      </FrameHeader>
      <FramePanel className={cn("flex flex-col gap-4", FRAME_PANEL_RESET)}>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">
            {order.supplierName}
          </span>
          <span className="text-sm leading-5 text-muted-foreground">
            Receive into {locationName(locations, order.locationId)}
          </span>
        </div>

        <Separator />

        <dl className="flex flex-col gap-2 text-sm">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3"
            >
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-foreground tabular-nums">{row.value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Units</dt>
            <dd className="text-foreground tabular-nums">
              {purchaseOrderUnits(order).toLocaleString()}
            </dd>
          </div>
        </dl>

        {order.note ? (
          <>
            <Separator />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-foreground">
                Note
              </span>
              <span className="text-sm leading-5 text-muted-foreground">
                {order.note}
              </span>
            </div>
          </>
        ) : null}

        <Separator />

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Total</span>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {formatCurrency(purchaseOrderTotal(order))}
          </span>
        </div>
      </FramePanel>
    </Frame>
  )
}

// ── Body: the same content in a single mobile scroll and a two-column desktop
// split. leftContent / rightContent are written once and placed in both. ──

function DetailBody({
  order,
  locations,
}: {
  order: PurchaseOrder
  locations: StockLocation[]
}) {
  const leftContent = (
    <div className="flex flex-col gap-4 px-5 py-4 sm:px-6">
      <OrderDataSection order={order} locations={locations} />
      <LineItemsSection order={order} />
    </div>
  )
  const rightContent = (
    <div className="flex flex-col gap-4 px-5 py-4 sm:px-6">
      <SummarySection order={order} locations={locations} />
    </div>
  )
  return (
    <>
      {/* Mobile: single scroll area (stacked) */}
      <div className="min-h-0 flex-1 lg:hidden">
        <ScrollArea className="h-full">
          {leftContent}
          <Separator />
          {rightContent}
        </ScrollArea>
      </div>

      {/* Desktop: two independent scroll areas split by a separator */}
      <div className="hidden min-h-0 flex-1 flex-row lg:flex">
        <div className="min-h-0 min-w-0 flex-1">
          <ScrollArea className="h-full">{leftContent}</ScrollArea>
        </div>
        <Separator orientation="vertical" className="self-stretch" />
        <div className="min-h-0 w-[320px] shrink-0">
          <ScrollArea className="h-full">{rightContent}</ScrollArea>
        </div>
      </div>
    </>
  )
}

// ── Sheet shell (controlled: the grid owns open state + the receive/cancel
// confirmation, so the footer buttons defer to it) ──

export function PurchaseOrderDetailSheet({
  order,
  locations,
  open,
  onOpenChange,
  onReceive,
  onCancel,
}: {
  order: PurchaseOrder | null
  locations: StockLocation[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onReceive: (order: PurchaseOrder) => void
  onCancel: (order: PurchaseOrder) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        initialFocus={false}
        className="flex flex-col gap-0 overflow-hidden rounded-xl p-0 outline-none data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:left-auto data-[side=right]:h-[calc(100svh-2rem)] data-[side=right]:w-[min(64rem,calc(100vw-2rem))] data-[side=right]:max-w-none data-[side=right]:sm:max-w-none"
      >
        {order ? (
          <>
            <SheetHeader className="shrink-0 border-b px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SheetTitle className="truncate font-mono">
                      {order.id}
                    </SheetTitle>
                    <PoStatusBadge status={order.status} />
                  </div>
                  <p className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {order.supplierName}
                    </span>
                    <span
                      className="size-1 shrink-0 rounded-full bg-muted-foreground/40"
                      aria-hidden="true"
                    />
                    <span>Raised</span>
                    <span className="font-medium text-foreground">
                      {formatOrderDate(order.createdAt)}
                    </span>
                  </p>
                </div>
                <SheetClose
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Close sheet"
                      className="shrink-0"
                    >
                      <XIcon aria-hidden="true" />
                    </Button>
                  }
                />
              </div>
              <SheetDescription className="sr-only">
                Purchase order {order.id} details, line items and totals.
              </SheetDescription>
            </SheetHeader>

            <DetailBody order={order} locations={locations} />

            <SheetFooter className="shrink-0 flex-col items-stretch justify-between gap-3 border-t bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              <p className="text-sm text-muted-foreground">
                {order.status === "draft"
                  ? "Receiving adds these units to the shelf."
                  : order.status === "received" && order.receivedAt
                    ? `Received ${formatOrderDate(order.receivedAt)}.`
                    : "This purchase order was cancelled."}
              </p>
              {order.status === "draft" ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onCancel(order)}
                  >
                    Cancel PO
                  </Button>
                  <Button type="button" onClick={() => onReceive(order)}>
                    <PackageCheckIcon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />
                    Receive stock
                  </Button>
                </div>
              ) : null}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
