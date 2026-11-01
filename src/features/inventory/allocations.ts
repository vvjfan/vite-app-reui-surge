import type { Order } from "@/lib/data/types"

// What is committed to orders, worked out from the orders.
//
// `allocated` used to be a number stored on each StockLevel. Nothing wrote it
// but the seed: placing an order reserved nothing, fulfilling released nothing,
// and cancelling released nothing either. So the seed could create a reservation
// that no code path could ever undo - ship the units and record it, and the
// allocation stayed, permanently double-counting them out of `available`. A
// reservation that can only be created and never released is not a reservation,
// it is a number that looks like one.
//
// It is derived now, for the same reason a Customer's order count is: it is a
// fact ABOUT the orders, so asking the orders is the only way it cannot drift.
// Fulfilling an order releases its allocation by no longer being open, rather
// than by remembering to. Every bug of this shape in this codebase has been a
// fact that got stored instead of asked.

/**
 * Is this order holding stock off the shelf?
 *
 * An order commits stock from the moment it is placed until it ships or is
 * called off. Cancelled releases it - the order is not happening. Fulfilled
 * releases it too, but for the opposite reason: the units are gone, and
 * `onHand` is what recorded that, so counting them again here would take them
 * off the shelf twice.
 */
export function isOpenOrder(order: Order): boolean {
  return order.status !== "cancelled" && order.status !== "fulfilled"
}

/** Allocations are keyed by the sku AND the location it ships from. */
export function allocationKey(sku: string, locationId: string): string {
  return `${sku}|${locationId}`
}

/**
 * Units committed to open orders, per sku per location.
 *
 * One pass over the order book, in a queryFn rather than per row - the same
 * shape as buildCustomerRows joining orders for a customer's totals.
 */
export function allocationsFromOrders(
  orders: readonly Order[]
): Map<string, number> {
  const allocations = new Map<string, number>()
  for (const order of orders) {
    if (!isOpenOrder(order)) continue
    for (const line of order.lines) {
      // The line ships from the order's origin, so that is where the units are
      // held. An order has one origin, so every line commits at the same place.
      const key = allocationKey(line.sku, order.shipping.locationId)
      allocations.set(key, (allocations.get(key) ?? 0) + line.qty)
    }
  }
  return allocations
}

export function allocatedFor(
  allocations: ReadonlyMap<string, number>,
  sku: string,
  locationId: string
): number {
  return allocations.get(allocationKey(sku, locationId)) ?? 0
}
