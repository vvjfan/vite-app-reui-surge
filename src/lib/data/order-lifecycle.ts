import { isSale, type Order } from "./types"

// What an order may become, and what that costs it.
//
// types.ts owns the READ rules - what a record means once you have it (isSale,
// orderNetTotal, orderItemCount). This module owns the WRITE rules: given an
// order, which transitions are legal, and what exactly does each one change.
//
// It exists because those rules used to be typed by hand at each call site as a
// `Partial<Order>` literal. Three call sites, three different answers, none of
// them reading the order first: cancel wrote `payment` nowhere, so a paid order
// stayed paid while dropping out of revenue; cancel force-wrote `fulfillment:
// "unfulfilled"` over a shipped order, erasing the parcel; and bulk fulfil
// patched `status: "fulfilled"` onto anything selected, quietly un-cancelling
// cancelled orders back into the books. A patch typed at a call site cannot
// consult the order, and nothing made it.
//
// A lifecycle is a set of VERBS on the order, not a status field a caller may
// set: the transition names the intent, and the store decides what it costs.
// That is also the shape a real commerce API takes, which is what makes the
// live adapter's job a mapping rather than a translation.

/** The lifecycle verbs. Delete is a lifecycle rule, but not a transition. */
export type OrderTransition = "cancel" | "fulfill" | "refund"

/** Why a transition was refused. The UI maps these to copy; nothing else does. */
export type TransitionReason =
  | "already-cancelled"
  | "shipped-cannot-cancel"
  | "cancelled-cannot-fulfill"
  | "already-fulfilled"
  | "already-refunded"
  | "not-paid"
  | "carries-revenue"

export type TransitionResult =
  { ok: true; patch: Partial<Order> } | { ok: false; reason: TransitionReason }

export type TransitionCheck =
  { ok: true } | { ok: false; reason: TransitionReason }

/**
 * Cancelling an order that has not shipped.
 *
 * Refuses once anything has left the warehouse: `fulfillment` is only rewritten
 * to "unfulfilled" by refusing to be in that position, never by overwriting a
 * shipment. A fulfilled order's answer is `refund`, which is why that verb
 * exists. Note the patch carries no `fulfillment` key at all - the guard has
 * already established it is "unfulfilled", so writing it would be a no-op that
 * only looks like a decision.
 *
 * A PAID order also moves to "refunded": cancelling is a decision about the
 * order, and leaving the capture outstanding is not one of the outcomes. An
 * unpaid one stays "pending" - marking it refunded would invent a refund of
 * money never taken. derivePayment (commerce.ts) has always agreed: a cancelled
 * order is refunded or pending, never paid.
 */
function cancelGuard(order: Order): TransitionReason | null {
  if (order.status === "cancelled") return "already-cancelled"
  if (order.status === "fulfilled" || order.fulfillment !== "unfulfilled") {
    return "shipped-cannot-cancel"
  }
  return null
}

function fulfillGuard(order: Order): TransitionReason | null {
  if (order.status === "cancelled") return "cancelled-cannot-fulfill"
  if (order.status === "fulfilled") return "already-fulfilled"
  return null
}

function refundGuard(order: Order): TransitionReason | null {
  if (order.payment === "refunded") return "already-refunded"
  if (order.payment !== "paid") return "not-paid"
  return null
}

/**
 * Deleting is allowed only once an order carries no money.
 *
 * Delete is a hard delete - the row goes. That is safe precisely because this
 * refuses while the order is still a sale: revenue, units, and a customer's
 * lifetime spend all derive from the order book at read time, so deleting a live
 * order silently rewrites last month's reported revenue with no record that it
 * ever happened. Cancel or refund it first, then the row carries no money and
 * removing it restates nothing.
 */
function deleteGuard(order: Order): TransitionReason | null {
  return isSale(order) ? "carries-revenue" : null
}

export function cancelOrder(order: Order): TransitionResult {
  const reason = cancelGuard(order)
  if (reason) return { ok: false, reason }
  return {
    ok: true,
    patch: {
      status: "cancelled",
      ...(order.payment === "paid" ? { payment: "refunded" as const } : {}),
    },
  }
}

export function fulfillOrder(order: Order): TransitionResult {
  const reason = fulfillGuard(order)
  if (reason) return { ok: false, reason }
  return { ok: true, patch: { status: "fulfilled", fulfillment: "fulfilled" } }
}

/**
 * Refunding leaves `status` alone: a refunded order is not a cancelled one. It
 * was placed, it shipped, and then the money went back. isSale reads both axes
 * for exactly this reason.
 */
export function refundOrder(order: Order): TransitionResult {
  const reason = refundGuard(order)
  if (reason) return { ok: false, reason }
  return { ok: true, patch: { payment: "refunded" } }
}

const TRANSITIONS: Record<OrderTransition, (order: Order) => TransitionResult> =
  {
    cancel: cancelOrder,
    fulfill: fulfillOrder,
    refund: refundOrder,
  }

export function applyTransition(
  order: Order,
  action: OrderTransition
): TransitionResult {
  return TRANSITIONS[action](order)
}

export function checkDelete(order: Order): TransitionCheck {
  const reason = deleteGuard(order)
  return reason ? { ok: false, reason } : { ok: true }
}

export const canCancel = (order: Order): boolean => cancelGuard(order) === null
export const canFulfill = (order: Order): boolean =>
  fulfillGuard(order) === null
export const canRefund = (order: Order): boolean => refundGuard(order) === null
export const canDelete = (order: Order): boolean => deleteGuard(order) === null

export interface TransitionPlan {
  applied: { order: Order; patch: Partial<Order> }[]
  skipped: { order: Order; reason: TransitionReason }[]
}

/**
 * Partition a selection into what the transition will do and what it will not.
 *
 * Pure, and computed BEFORE any mutation fires, so a bulk action can report what
 * it actually did rather than assert a count it never checked. The bulk bar used
 * to toast "${selectedCount} orders marked fulfilled" unconditionally.
 */
export function planTransition(
  orders: Order[],
  action: OrderTransition
): TransitionPlan {
  const plan: TransitionPlan = { applied: [], skipped: [] }
  for (const order of orders) {
    const result = applyTransition(order, action)
    if (result.ok) plan.applied.push({ order, patch: result.patch })
    else plan.skipped.push({ order, reason: result.reason })
  }
  return plan
}

/**
 * What the store throws when a caller reaches it with an illegal transition.
 *
 * The UI guards first and never gets here; this is the demo store refusing the
 * way a real API would, so a bug in a call site surfaces as an error rather than
 * a written-through illegal state. `reason` is the machine-readable half; the
 * message is for a developer reading a console.
 */
export class OrderTransitionError extends Error {
  readonly reason: TransitionReason

  constructor(
    orderId: string,
    action: OrderTransition | "delete",
    reason: TransitionReason
  ) {
    super(`Order ${orderId}: cannot ${action} (${reason})`)
    this.name = "OrderTransitionError"
    this.reason = reason
  }
}
