import type {
  OrderTransition,
  TransitionPlan,
  TransitionReason,
} from "@/lib/data/order-lifecycle"

// How a refused transition reads to an operator.
//
// The data layer owns the RULE and names its reasons as codes; this owns the
// words. Keeping the strings out of lib/data means the rule module has no
// opinion about the UI, and keeping them out of the components means the row
// menu and the bulk bar cannot describe the same refusal two different ways.
//
// Both maps switch exhaustively over TransitionReason, so adding a reason is a
// type error here rather than a blank string on screen.

/** Fragment form, for counting: "2 skipped: 1 already fulfilled, 1 cancelled". */
const REASON_PHRASE: Record<TransitionReason, string> = {
  "already-cancelled": "already cancelled",
  "shipped-cannot-cancel": "already shipped",
  "cancelled-cannot-fulfill": "cancelled",
  "already-fulfilled": "already fulfilled",
  "already-refunded": "already refunded",
  "not-paid": "not paid",
  "carries-revenue": "still a live sale",
}

/** Sentence form, for a single refusal - says what to do instead. */
const REASON_SENTENCE: Record<TransitionReason, string> = {
  "already-cancelled": "This order is already cancelled.",
  "shipped-cannot-cancel":
    "This order has already shipped. Refund it instead of cancelling.",
  "cancelled-cannot-fulfill": "A cancelled order cannot be fulfilled.",
  "already-fulfilled": "This order is already fulfilled.",
  "already-refunded": "This order is already refunded.",
  "not-paid": "There is no captured payment to refund.",
  "carries-revenue":
    "This order still counts towards revenue. Cancel or refund it first.",
}

export function transitionReasonPhrase(reason: TransitionReason): string {
  return REASON_PHRASE[reason]
}

export function transitionReasonSentence(reason: TransitionReason): string {
  return REASON_SENTENCE[reason]
}

const PAST_TENSE: Record<OrderTransition, string> = {
  cancel: "cancelled",
  fulfill: "fulfilled",
  refund: "refunded",
}

export interface BulkToast {
  tone: "success" | "message" | "error"
  title: string
  description?: string
}

const plural = (n: number) => (n === 1 ? "order" : "orders")

/**
 * What a bulk transition actually did.
 *
 * Reports the PLAN, which is known synchronously and before any write, so the
 * toast cannot claim a count it never checked - the bulk bar used to announce
 * "${selectedCount} orders marked fulfilled" whatever happened to them.
 */
export function bulkTransitionToast(
  action: OrderTransition,
  plan: TransitionPlan
): BulkToast {
  const done = plan.applied.length
  const skipped = plan.skipped.length
  const verb = PAST_TENSE[action]

  if (skipped === 0) {
    return { tone: "success", title: `${done} ${plural(done)} ${verb}` }
  }

  if (done === 0) {
    // Nothing happened, so this is not a success however it is worded.
    return {
      tone: "error",
      title: `No orders ${verb}`,
      description:
        skipped === 1
          ? transitionReasonSentence(plan.skipped[0].reason)
          : `All ${skipped} selected orders were skipped: ${summarize(plan)}.`,
    }
  }

  return {
    tone: "message",
    title: `${done} ${plural(done)} ${verb}`,
    description:
      skipped === 1
        ? `1 skipped. ${transitionReasonSentence(plan.skipped[0].reason)}`
        : `${skipped} skipped: ${summarize(plan)}.`,
  }
}

/** "1 cancelled, 2 already fulfilled" - counted by reason, in first-seen order. */
function summarize(plan: TransitionPlan): string {
  const counts = new Map<TransitionReason, number>()
  for (const { reason } of plan.skipped) {
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  return [...counts]
    .map(([reason, count]) => `${count} ${transitionReasonPhrase(reason)}`)
    .join(", ")
}
