import { useCallback, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import {
  Timeline,
  TimelineContent,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
} from "@/components/reui/timeline"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { CustomerRef } from "@/components/shared/customer-ref"
import { ProductRef } from "@/components/shared/product-ref"
import { useRouteSheet } from "@/components/shared/use-route-sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Label } from "@/components/ui/label"
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
import { deriveSteps } from "@/lib/data/commerce"
import { canDelete } from "@/lib/data/order-lifecycle"
import {
  orderItemCount,
  type Order,
  type OrderCustomer,
  type ShippingStep,
} from "@/lib/data/types"
import { formatCurrency, formatOrderDate } from "../lib/format"
import { transitionReasonSentence } from "../lib/lifecycle-copy"
import { useDeleteOrder } from "../queries"
import { customerRefOf, StatusBadge } from "./orders-columns"
import { CheckIcon, XIcon } from "@phosphor-icons/react"

const FRAME_PANEL_RESET = "shadow-none!"

// ── Carrier chip (inline UPS Global mark, per block design) ──

function UpsLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 22"
      role="img"
      aria-label="UPS"
      shapeRendering="geometricPrecision"
      {...props}
    >
      <path
        d="M10 1 1 4v9.2c0 3.4 2 5.6 4.5 6.7L10 22l4.5-2.1c2.5-1.1 4.5-3.3 4.5-6.7V4l-9-3Z"
        fill="#644117"
      />
      <path
        d="M10 2.4 2.4 5v8.2c0 2.8 1.6 4.6 3.6 5.5L10 20.4l4-1.7c2-.9 3.6-2.7 3.6-5.5V5L10 2.4Z"
        fill="#FFB500"
      />
      <text
        x="10"
        y="14"
        textAnchor="middle"
        fontFamily="Arial Black, Arial, Helvetica, sans-serif"
        fontSize="6"
        fontWeight="900"
        fill="#644117"
      >
        UPS
      </text>
    </svg>
  )
}

function CarrierChip({ name }: { name: string }) {
  return (
    <Badge variant="secondary" className="gap-2">
      <UpsLogo className="h-4 w-auto" />
      {name}
    </Badge>
  )
}

// ── Customer reference ──

/**
 * `handle` IS the customer id (see types.ts), so it addresses /customers/$handle
 * directly. The name in a header is a reference, not a label: an admin reading
 * an order wants the person behind it one click away.
 */
function CustomerLink({ customer }: { customer: OrderCustomer }) {
  return <CustomerRef customer={customerRefOf(customer)} />
}

// ── Footer action cluster ──

function OrderActions({
  order,
  onDelete,
}: {
  order: Order
  onDelete: () => void
}) {
  const deletable = canDelete(order)
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        // Same predicate the row menu and the store use: an order that still
        // counts as a sale is cancelled or refunded first, never deleted.
        disabled={!deletable}
        title={
          deletable ? undefined : transitionReasonSentence("carries-revenue")
        }
        onClick={onDelete}
      >
        Delete
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          toast.info("Order tracking", { description: "Demo tracking link." })
        }
      >
        Order Tracking
      </Button>
      <Button
        type="button"
        onClick={() =>
          toast.success("Shipping label", { description: "Demo label." })
        }
      >
        View Shipping Label
      </Button>
    </div>
  )
}

// ── Left column: Order data ──

function OrderDataSection({ order }: { order: Order }) {
  const stats: { label: string; value: React.ReactNode }[] = [
    {
      label: "Items",
      value: (
        <span className="text-sm font-medium text-foreground">
          {orderItemCount(order)} Items
        </span>
      ),
    },
    {
      label: "Total Price",
      value: (
        <span className="text-sm font-medium text-foreground tabular-nums">
          {formatCurrency(order.totals.total)}
        </span>
      ),
    },
    {
      label: "Shipping Priority",
      value: (
        <span className="text-sm font-medium text-foreground">
          {order.shipping.priority}
        </span>
      ),
    },
    {
      label: "Delivery Method",
      value: (
        <span className="text-sm font-medium text-foreground">
          {order.shipping.method}
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

// ── Left column: Products ──

function ProductItemRow({ item }: { item: Order["lines"][number] }) {
  const inputId = `weight-${item.id}`
  return (
    <Item role="listitem" className="items-center gap-3 px-0 py-0">
      <ItemMedia
        variant="image"
        className="relative size-10 shrink-0 border bg-muted"
      >
        <img src={item.image} alt={item.name} />
      </ItemMedia>
      <ItemContent className="min-w-0 flex-1 gap-0.5">
        <ItemTitle className="text-sm font-medium text-foreground">
          <ProductRef product={{ id: item.productId, title: item.name }} />
        </ItemTitle>
        <ItemDescription className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          <span>SKU:</span>
          <span className="font-mono font-medium text-foreground">
            {item.sku}
          </span>
          <span
            className="size-1 shrink-0 rounded-full bg-muted-foreground/40"
            aria-hidden="true"
          />
          <span>Color {item.color}</span>
          <span
            className="size-1 shrink-0 rounded-full bg-muted-foreground/40"
            aria-hidden="true"
          />
          <span>Qty {item.qty}</span>
        </ItemDescription>
      </ItemContent>
      <InputGroup className="w-32 shrink-0">
        <InputGroupAddon align="inline-start">
          <Label
            htmlFor={inputId}
            className="text-xs font-normal text-muted-foreground"
          >
            Weight
          </Label>
        </InputGroupAddon>
        <InputGroupInput
          id={inputId}
          type="text"
          inputMode="decimal"
          defaultValue={item.weight.toFixed(1)}
          className="h-7! px-2! py-0! text-right text-xs tabular-nums"
          aria-label={`Weight of ${item.name} in kilograms`}
        />
        <InputGroupAddon align="inline-end">
          <span className="text-xs text-muted-foreground">kg</span>
        </InputGroupAddon>
      </InputGroup>
    </Item>
  )
}

function ProductsSection({ order }: { order: Order }) {
  return (
    <Frame dense spacing="sm" className="w-full">
      <FrameHeader>
        <FrameTitle>Products</FrameTitle>
      </FrameHeader>
      <FramePanel className={cn("flex flex-col gap-4", FRAME_PANEL_RESET)}>
        <div role="list" className="flex flex-col gap-4">
          {order.lines.map((item) => (
            <ProductItemRow key={item.id} item={item} />
          ))}
        </div>
      </FramePanel>
    </Frame>
  )
}

// ── Left column: Shipping (route + carrier + stepper) ──

const TL_ITEM_BASE = "group-data-[orientation=vertical]/timeline:ms-3"
const TL_SEP_CLASS =
  "bg-primary group-data-[orientation=vertical]/timeline:-left-3 group-data-[orientation=vertical]/timeline:-translate-x-1/2 group-data-[orientation=vertical]/timeline:h-[calc(100%-1rem)] group-data-[orientation=vertical]/timeline:translate-y-4.5"
const TL_IND_CLASS =
  "bg-primary size-2 border-0 group-data-[orientation=vertical]/timeline:-left-3 group-data-[orientation=vertical]/timeline:-translate-x-1/2 group-data-[orientation=vertical]/timeline:top-1.5"

function ShippingSection({ order }: { order: Order }) {
  const stops = [order.shipping.from, order.shipping.to]
  return (
    <Frame dense spacing="sm" className="w-full">
      <FrameHeader>
        <FrameTitle>Shipping</FrameTitle>
      </FrameHeader>
      <FramePanel className={cn("flex flex-col gap-0 p-0!", FRAME_PANEL_RESET)}>
        <div className="flex flex-col items-start justify-between gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
          <Timeline defaultValue={0} className="min-w-0 flex-1 gap-0">
            {stops.map((address, index) => {
              const isLast = index === stops.length - 1
              return (
                <TimelineItem
                  key={address}
                  step={index + 1}
                  className={cn(
                    TL_ITEM_BASE,
                    isLast
                      ? "group-data-[orientation=vertical]/timeline:pb-0"
                      : "group-data-[orientation=vertical]/timeline:not-last:pb-2"
                  )}
                >
                  {!isLast ? (
                    <TimelineSeparator className={TL_SEP_CLASS} />
                  ) : null}
                  <TimelineIndicator className={TL_IND_CLASS} />
                  <TimelineContent className="text-sm leading-snug text-foreground">
                    {address}
                  </TimelineContent>
                </TimelineItem>
              )
            })}
          </Timeline>
          <CarrierChip name={order.shipping.carrier} />
        </div>

        <Separator />

        <div className="px-4 py-3.5">
          {/* Derived at render from the order's own axes, never read off the
              record: the stepper and the status badge above it are then two
              views of one fact and cannot contradict each other. */}
          <Stepper steps={deriveSteps(order.status, order.fulfillment)} />
        </div>
      </FramePanel>
    </Frame>
  )
}

function Stepper({ steps }: { steps: ShippingStep[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-4 gap-2">
        {steps.map((step, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full",
              step.state === "pending"
                ? "bg-muted"
                : step.state === "active"
                  ? "bg-gradient-to-r from-success to-success/30"
                  : "bg-success"
            )}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-1.5 text-xs">
            <StepIcon state={step.state} />
            <span
              className={cn(
                step.state === "pending"
                  ? "text-muted-foreground"
                  : "font-medium text-foreground"
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepIcon({ state }: { state: ShippingStep["state"] }) {
  if (state === "done") {
    return (
      <span
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-success text-white"
        aria-hidden="true"
      >
        <CheckIcon className="size-2.5" />
      </span>
    )
  }
  if (state === "active") {
    return (
      <span
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-success text-success"
        aria-hidden="true"
      >
        <CheckIcon className="size-2.5" />
      </span>
    )
  }
  return (
    <span
      className="inline-flex size-4 shrink-0 rounded-full border-2 border-muted-foreground/40"
      aria-hidden="true"
    />
  )
}

// ── Right rail: Summary ──

function SummarySection({ order }: { order: Order }) {
  const rows: { label: string; value: string }[] = [
    { label: "Subtotal", value: formatCurrency(order.totals.subtotal) },
    { label: "Shipping", value: formatCurrency(order.totals.shipping) },
    { label: "Tax", value: formatCurrency(order.totals.tax) },
    { label: "Total", value: formatCurrency(order.totals.total) },
  ]
  return (
    <Frame dense spacing="sm" className="w-full">
      <FrameHeader>
        <FrameTitle>Summary</FrameTitle>
      </FrameHeader>
      <FramePanel className={cn("flex flex-col gap-4", FRAME_PANEL_RESET)}>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">
            {order.shipping.destinationLabel}
          </span>
          <span className="text-sm leading-5 text-muted-foreground">
            {order.shipping.destinationLines.map((line, i) => (
              <span key={line}>
                {line}
                {i < order.shipping.destinationLines.length - 1 ? <br /> : null}
              </span>
            ))}
          </span>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-foreground">
            Price Details
          </span>
          <dl className="flex flex-col gap-1.5 text-sm">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between"
              >
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-foreground tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Total</span>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {formatCurrency(order.totals.total)}
          </span>
        </div>
      </FramePanel>
    </Frame>
  )
}

// ── Sheet shell (route-controlled: closing navigates back to /orders) ──

export function OrderDetailSheet({ order }: { order: Order }) {
  const navigate = useNavigate()
  const deleteOrder = useDeleteOrder()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleClosed = useCallback(() => {
    navigate({ to: "/orders" })
  }, [navigate])
  const sheet = useRouteSheet(handleClosed)

  const confirmDelete = () => {
    setDeleteOpen(false)
    const check = deleteOrder.run(order)
    if (!check.ok) {
      // Stay put on a refusal. Navigating away regardless would leave the
      // operator back on the list with no sign the order is still there.
      toast.error("Could not delete this order", {
        description: transitionReasonSentence(check.reason),
      })
      return
    }
    toast.success("Order deleted", { description: order.number })
    // Close rather than navigate: the sheet then animates out and returns to
    // the list itself, the same way the close button does.
    sheet.onOpenChange(false)
  }

  const leftContent = (
    <div className="flex flex-col gap-4 px-5 py-4 sm:px-6">
      <OrderDataSection order={order} />
      <ProductsSection order={order} />
      <ShippingSection order={order} />
    </div>
  )

  const rightContent = (
    <div className="flex flex-col gap-4 px-5 py-4 sm:px-6">
      <SummarySection order={order} />
    </div>
  )

  return (
    <>
      <Sheet {...sheet}>
        <SheetContent
          side="right"
          showCloseButton={false}
          initialFocus={false}
          className="flex flex-col gap-0 overflow-hidden rounded-xl p-0 outline-none data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:left-auto data-[side=right]:h-[calc(100svh-2rem)] data-[side=right]:w-[min(64rem,calc(100vw-2rem))] data-[side=right]:max-w-none data-[side=right]:sm:max-w-none"
        >
          <SheetHeader className="shrink-0 border-b px-5 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="truncate">
                    Order {order.number}
                  </SheetTitle>
                  <StatusBadge status={order.status} />
                </div>
                <p className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
                  <span>Created</span>
                  <span className="font-medium text-foreground">
                    {formatOrderDate(order.date)}
                  </span>
                  <span
                    className="size-1 shrink-0 rounded-full bg-muted-foreground/40"
                    aria-hidden="true"
                  />
                  <span>Customer:</span>
                  <CustomerLink customer={order.customer} />
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
              Order {order.number} details, items, route and totals.
            </SheetDescription>
          </SheetHeader>

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

          <SheetFooter className="shrink-0 flex-col items-stretch justify-between gap-3 border-t bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <p className="text-sm text-muted-foreground">
              Read Shipping{" "}
              <span className="text-primary">Terms &amp; Conditions</span>
            </p>
            <OrderActions order={order} onDelete={() => setDeleteOpen(true)} />
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-mono text-sm text-foreground">
                {order.number}
              </span>{" "}
              from your store. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
