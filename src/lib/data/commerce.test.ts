import { describe, expect, it } from "vitest"

import { deriveSteps } from "./commerce"
import type { FulfillmentStatus, OrderStatus } from "./types"

// deriveSteps: the Picking -> Packed -> Shipping -> Delivered stepper.
//
// It is a total pure function of (status, fulfillment), which is the whole
// reason `steps` is no longer a stored field on OrderShipping. The stepper used
// to be computed once - by the seed and by the create form - and then never
// again, so any transition left it behind: a cancelled order still showed a
// green Delivered checkmark under a Cancelled badge, and a freshly fulfilled one
// still sat at Picking. Deriving it at render makes those unrepresentable, and
// makes this the one place the rule is written down.

const labels = ["Picking", "Packed", "Shipping", "Delivered"]

/** The stepper as a compact shape, so a case reads as one line. */
function shape(status: OrderStatus, fulfillment: FulfillmentStatus) {
  return deriveSteps(status, fulfillment).map((step) => step.state)
}

describe("deriveSteps", () => {
  it("always names the four stages in order", () => {
    expect(deriveSteps("processing", "partial").map((s) => s.label)).toEqual(
      labels
    )
  })

  it("starts a pending order at Picking with nothing done", () => {
    expect(shape("pending", "unfulfilled")).toEqual([
      "active",
      "pending",
      "pending",
      "pending",
    ])
  })

  it("marks every stage done once the order is fulfilled", () => {
    expect(shape("fulfilled", "fulfilled")).toEqual([
      "done",
      "done",
      "done",
      "done",
    ])
  })

  it("shows a cancelled order reaching no stage at all", () => {
    // Not "done", and not partially done: the parcel is not coming. This is the
    // branch that used to contradict the badge above it.
    expect(shape("cancelled", "unfulfilled")).toEqual([
      "pending",
      "pending",
      "pending",
      "pending",
    ])
  })

  it("advances a processing order further once part of it has shipped", () => {
    expect(shape("processing", "unfulfilled")).toEqual([
      "done",
      "active",
      "pending",
      "pending",
    ])
    expect(shape("processing", "partial")).toEqual([
      "done",
      "done",
      "active",
      "pending",
    ])
  })

  it("lets the status win when the two axes disagree", () => {
    // A cancelled order reports no progress even if its fulfillment axis still
    // says otherwise, and a fulfilled one reports complete regardless. The
    // lifecycle guards keep these combinations off the store; this pins what the
    // stepper does if one ever reaches it.
    expect(shape("cancelled", "fulfilled")).toEqual([
      "pending",
      "pending",
      "pending",
      "pending",
    ])
    expect(shape("fulfilled", "unfulfilled")).toEqual([
      "done",
      "done",
      "done",
      "done",
    ])
  })

  it("answers every status x fulfillment with four real steps", () => {
    const statuses: OrderStatus[] = [
      "pending",
      "processing",
      "fulfilled",
      "cancelled",
    ]
    const fulfillments: FulfillmentStatus[] = [
      "unfulfilled",
      "partial",
      "fulfilled",
    ]

    for (const status of statuses) {
      for (const fulfillment of fulfillments) {
        const steps = deriveSteps(status, fulfillment)
        expect(steps.map((s) => s.label)).toEqual(labels)
        expect(
          steps.every((s) => ["done", "active", "pending"].includes(s.state))
        ).toBe(true)
      }
    }
  })

  it("never leaves a gap: done stages come first, then at most one active", () => {
    const statuses: OrderStatus[] = [
      "pending",
      "processing",
      "fulfilled",
      "cancelled",
    ]
    const fulfillments: FulfillmentStatus[] = [
      "unfulfilled",
      "partial",
      "fulfilled",
    ]

    for (const status of statuses) {
      for (const fulfillment of fulfillments) {
        const states = shape(status, fulfillment)
        const firstNotDone = states.findIndex((s) => s !== "done")
        // Everything before the first non-done stage is done, by construction.
        // After it, nothing may be done again - a stepper that read
        // done/pending/done would be describing time travel.
        if (firstNotDone !== -1) {
          expect(states.slice(firstNotDone).includes("done")).toBe(false)
        }
        expect(states.filter((s) => s === "active").length).toBeLessThanOrEqual(
          1
        )
      }
    }
  })
})
