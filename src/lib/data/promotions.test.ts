import { describe, it, expect } from "vitest"

import {
  PROMOTIONS,
  PROMOTION_STATUS_OPTIONS,
  summarizePromotion,
  type Promotion,
  type PromotionStatus,
} from "./promotions"

/** A valid baseline row; each test overrides only what it is about. */
const makePromotion = (overrides: Partial<Promotion> = {}): Promotion => ({
  id: "promo_test",
  code: "TEST20",
  name: "Test promotion",
  method: "code",
  valueType: "percentage",
  target: "order",
  value: 20,
  currency: "USD",
  status: "active",
  startsAt: "2026-06-01",
  endsAt: "2026-08-31",
  usageLimit: null,
  usedCount: 0,
  minSubtotal: null,
  rank: 0,
  ...overrides,
})

describe("summarizePromotion: free shipping", () => {
  // regression guard: "shipping" is the whole signal. The model stores free
  // shipping as percentage/100 alongside the target (see the FREESHIP seed row),
  // so the value fields must never leak into the summary.
  it("reads a shipping target as free shipping regardless of the value fields", () => {
    expect(summarizePromotion(makePromotion({ target: "shipping" }))).toBe(
      "Free shipping"
    )
    expect(
      summarizePromotion(
        makePromotion({
          target: "shipping",
          valueType: "percentage",
          value: 100,
        })
      )
    ).toBe("Free shipping")
    expect(
      summarizePromotion(
        makePromotion({ target: "shipping", valueType: "fixed", value: 25 })
      )
    ).toBe("Free shipping")
    expect(
      summarizePromotion(makePromotion({ target: "shipping", value: 0 }))
    ).toBe("Free shipping")
  })
})

describe("summarizePromotion: percentage", () => {
  it("summarizes a percentage off the order", () => {
    expect(
      summarizePromotion(
        makePromotion({ valueType: "percentage", target: "order", value: 20 })
      )
    ).toBe("20% off order")
  })

  it("summarizes a percentage off the items", () => {
    expect(
      summarizePromotion(
        makePromotion({ valueType: "percentage", target: "items", value: 20 })
      )
    ).toBe("20% off items")
  })
})

describe("summarizePromotion: fixed amount", () => {
  it("summarizes a fixed amount off the items, currency formatted", () => {
    expect(
      summarizePromotion(
        makePromotion({ valueType: "fixed", target: "items", value: 15 })
      )
    ).toBe("$15 off items")
  })

  it("summarizes a fixed amount off the order, currency formatted", () => {
    expect(
      summarizePromotion(
        makePromotion({ valueType: "fixed", target: "order", value: 25 })
      )
    ).toBe("$25 off order")
  })

  it("formats without decimals", () => {
    // maximumFractionDigits: 0 keeps the Type column narrow, so a .50 rounds.
    expect(
      summarizePromotion(
        makePromotion({ valueType: "fixed", target: "order", value: 25.4 })
      )
    ).toBe("$25 off order")
  })
})

describe("PROMOTIONS seed", () => {
  const statuses = new Set<string>(PROMOTION_STATUS_OPTIONS.map((o) => o.value))

  it("has unique ids and unique codes", () => {
    const ids = PROMOTIONS.map((p) => p.id)
    const codes = PROMOTIONS.map((p) => p.code)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it("never records more redemptions than the usage limit allows", () => {
    // a row with usedCount > usageLimit would render an over-100% progress cell.
    for (const promotion of PROMOTIONS) {
      if (promotion.usageLimit === null) continue
      expect(
        promotion.usedCount,
        `${promotion.code} used ${promotion.usedCount} of ${promotion.usageLimit}`
      ).toBeLessThanOrEqual(promotion.usageLimit)
    }
  })

  it("uses only declared statuses", () => {
    for (const promotion of PROMOTIONS) {
      expect(
        statuses,
        `${promotion.code} has status "${promotion.status}"`
      ).toContain(promotion.status satisfies PromotionStatus)
    }
  })

  it("summarizes every seeded row without producing NaN or undefined", () => {
    for (const promotion of PROMOTIONS) {
      const summary = summarizePromotion(promotion)
      expect(summary).toBeTruthy()
      expect(summary).not.toContain("NaN")
      expect(summary).not.toContain("undefined")
    }
  })
})
