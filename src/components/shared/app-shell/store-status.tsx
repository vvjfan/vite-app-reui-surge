"use client"

import { useState, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/reui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ordersListQuery } from "@/features/orders/queries"
import { reviewsListQuery } from "@/features/reviews/queries"
import { needsReorder, useInventoryItems } from "@/features/inventory/queries"
import {
  StackIcon as BoxesIcon,
  CaretRightIcon as ChevronRightIcon,
  CreditCardIcon,
  GaugeIcon,
  StarIcon,
  TruckIcon,
} from "@phosphor-icons/react"

// One queue an operator works from the header: what it is, where it lives, and
// how many items wait there right now. Counts come from the same store reads the
// pages use (orders, the ledger, reviews), so the header never disagrees with
// the page it links to. This replaces a server monitor (CPU/GPU/RAM) that meant
// nothing to a store and re-rolled fake numbers every second.
type StoreSignal = {
  id: string
  label: string
  href: string
  icon: ReactNode
  count: number
}

export function StoreStatus() {
  const [open, setOpen] = useState(false)

  const ordersQuery = useQuery(ordersListQuery())
  const reviewsQuery = useQuery(reviewsListQuery())
  const inventoryQuery = useInventoryItems()

  const orders = ordersQuery.data ?? []
  const reviews = reviewsQuery.data ?? []
  const stock = inventoryQuery.data ?? []

  const loading =
    ordersQuery.isPending || reviewsQuery.isPending || inventoryQuery.isPending

  const signals: StoreSignal[] = [
    {
      id: "fulfill",
      label: "Orders to fulfill",
      href: "/orders",
      icon: <TruckIcon aria-hidden="true" />,
      count: orders.filter(
        (order) => order.status === "pending" || order.status === "processing"
      ).length,
    },
    {
      id: "payment",
      label: "Awaiting payment",
      href: "/orders",
      icon: <CreditCardIcon aria-hidden="true" />,
      count: orders.filter(
        (order) => order.payment === "pending" && order.status !== "cancelled"
      ).length,
    },
    {
      id: "stock",
      label: "Low stock",
      href: "/inventory/reorder",
      icon: <BoxesIcon aria-hidden="true" />,
      count: stock.filter(needsReorder).length,
    },
    {
      id: "reviews",
      label: "Reviews to moderate",
      href: "/reviews",
      icon: <StarIcon aria-hidden="true" />,
      count: reviews.filter((review) => review.status === "pending").length,
    },
  ]

  const openItems = signals.reduce((sum, signal) => sum + signal.count, 0)
  const needsAttention = openItems > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Store status"
            className="relative inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <GaugeIcon
          className={cn(
            "size-3.5",
            needsAttention ? "text-warning" : "text-muted-foreground"
          )}
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-foreground">Store</span>
        {loading ? null : needsAttention ? (
          <Badge variant="warning-light">Attention</Badge>
        ) : (
          <Badge variant="success-light">All clear</Badge>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-72 p-0">
        {/* Header: the one-line read before the breakdown. */}
        <div className="flex flex-col gap-0.5 border-b border-border px-3 py-2.5">
          <span className="text-xs font-medium text-foreground">
            Store status
          </span>
          <span className="text-xs text-muted-foreground">
            {loading
              ? "Checking your queues"
              : needsAttention
                ? "What needs your attention"
                : "Everything looks clear"}
          </span>
        </div>

        {/* Each queue is also a shortcut to the page that clears it. */}
        <div className="flex flex-col py-1">
          {signals.map((signal) => (
            <Link
              key={signal.id}
              to={signal.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
                {signal.icon}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {signal.label}
              </span>
              <span
                className={cn(
                  "shrink-0 text-sm tabular-nums",
                  !loading && signal.count > 0
                    ? "font-semibold text-warning-foreground"
                    : "text-muted-foreground"
                )}
              >
                {loading ? "—" : signal.count}
              </span>
              <ChevronRightIcon
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
