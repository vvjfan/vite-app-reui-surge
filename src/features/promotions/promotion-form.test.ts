import { describe, it, expect } from "vitest"

import {
  normalizeCode,
  validatePromotionDraft,
  type PromotionDraft,
} from "./promotion-form"

// `validatePromotionDraft` stands in for a schema (the repo has no zod /
// react-hook-form), so it is covered rule by rule: every branch that can write a
// message, plus the cases that must stay silent.

/** A valid baseline; each test overrides only the field it is about. */
const makeDraft = (
  overrides: Partial<PromotionDraft> = {}
): PromotionDraft => ({
  name: "Summer sale",
  code: "SUMMER20",
  method: "code",
  valueType: "percentage",
  target: "order",
  value: "20",
  startsAt: "2026-06-01",
  endsAt: "2026-08-31",
  usageLimit: "",
  minSubtotal: "",
  status: "draft",
  ...overrides,
})

describe("normalizeCode", () => {
  it("uppercases and strips spaces", () => {
    expect(normalizeCode("autumn 35")).toBe("AUTUMN35")
    expect(normalizeCode("  free ship  ")).toBe("FREESHIP")
  })

  it("leaves an already-normalized code untouched", () => {
    expect(normalizeCode("SUMMER20")).toBe("SUMMER20")
    expect(normalizeCode("BLACK-FRIDAY_26")).toBe("BLACK-FRIDAY_26")
  })

  it("keeps punctuation so the validator can reject it", () => {
    // normalize only fixes case/spacing; it is not a sanitizer.
    expect(normalizeCode("summer@20")).toBe("SUMMER@20")
  })
})

describe("validatePromotionDraft: a valid draft", () => {
  it("returns an empty error map", () => {
    expect(validatePromotionDraft(makeDraft())).toEqual({})
  })
})

describe("validatePromotionDraft: name", () => {
  it("requires a name", () => {
    expect(validatePromotionDraft(makeDraft({ name: "" })).name).toBe(
      "Name is required."
    )
  })

  it("rejects a whitespace-only name", () => {
    expect(validatePromotionDraft(makeDraft({ name: "   " })).name).toBe(
      "Name is required."
    )
  })
})

describe("validatePromotionDraft: code", () => {
  it("requires a code", () => {
    expect(validatePromotionDraft(makeDraft({ code: "" })).code).toBe(
      "Code is required."
    )
  })

  it("treats a spaces-only code as missing", () => {
    // normalizeCode strips the spaces away to nothing.
    expect(validatePromotionDraft(makeDraft({ code: "   " })).code).toBe(
      "Code is required."
    )
  })

  it("accepts letters, digits, hyphens, and underscores", () => {
    for (const code of ["SUMMER20", "black-friday", "NEW_YEAR_30", "2026"]) {
      expect(validatePromotionDraft(makeDraft({ code })).code).toBeUndefined()
    }
  })

  it("accepts a lowercase code because it is normalized first", () => {
    expect(
      validatePromotionDraft(makeDraft({ code: "summer 20" })).code
    ).toBeUndefined()
  })

  it("rejects punctuation beyond hyphen and underscore", () => {
    for (const code of ["SUMMER@20", "20%OFF", "A+B", "SALE!", "a.b", "x/y"]) {
      expect(validatePromotionDraft(makeDraft({ code })).code).toBe(
        "Use letters, numbers, hyphens, and underscores only."
      )
    }
  })
})

describe("validatePromotionDraft: value", () => {
  it("requires a value", () => {
    expect(validatePromotionDraft(makeDraft({ value: "" })).value).toBe(
      "Enter a discount value."
    )
  })

  it("rejects a non-numeric value", () => {
    expect(validatePromotionDraft(makeDraft({ value: "abc" })).value).toBe(
      "Enter a discount value."
    )
  })

  it("requires a value greater than 0", () => {
    expect(validatePromotionDraft(makeDraft({ value: "0" })).value).toBe(
      "Value must be greater than 0."
    )
    expect(validatePromotionDraft(makeDraft({ value: "-5" })).value).toBe(
      "Value must be greater than 0."
    )
  })

  it("caps a percentage at 100", () => {
    expect(
      validatePromotionDraft(
        makeDraft({ valueType: "percentage", value: "100" })
      ).value
    ).toBeUndefined()
    expect(
      validatePromotionDraft(
        makeDraft({ valueType: "percentage", value: "101" })
      ).value
    ).toBe("Percentage cannot be over 100.")
  })

  it("lets a fixed amount exceed 100", () => {
    // a $250 discount is a real promotion; only percentages are capped.
    expect(
      validatePromotionDraft(makeDraft({ valueType: "fixed", value: "250" }))
        .value
    ).toBeUndefined()
  })

  it("accepts a decimal value", () => {
    expect(
      validatePromotionDraft(makeDraft({ valueType: "fixed", value: "7.5" }))
        .value
    ).toBeUndefined()
  })
})

describe("validatePromotionDraft: free shipping", () => {
  // regression guard: the value inputs are forced and hidden when the target is
  // "shipping", so whatever they hold is not user input and must not be
  // validated. A blank / garbage / over-100 value must stay silent.
  it("skips the value rules entirely when the target is shipping", () => {
    for (const value of ["", "   ", "abc", "0", "-5", "9999"]) {
      const errors = validatePromotionDraft(
        makeDraft({ target: "shipping", value })
      )
      expect(errors.value).toBeUndefined()
    }
  })

  it("still applies the value rules for the order and items targets", () => {
    expect(
      validatePromotionDraft(makeDraft({ target: "order", value: "" })).value
    ).toBe("Enter a discount value.")
    expect(
      validatePromotionDraft(makeDraft({ target: "items", value: "" })).value
    ).toBe("Enter a discount value.")
  })

  it("still validates the other fields for a shipping promotion", () => {
    const errors = validatePromotionDraft(
      makeDraft({ target: "shipping", value: "", name: "", startsAt: "" })
    )
    expect(errors.value).toBeUndefined()
    expect(errors.name).toBe("Name is required.")
    expect(errors.startsAt).toBe("Pick a start date.")
  })

  it("returns an empty error map for a valid shipping draft with no value", () => {
    expect(
      validatePromotionDraft(makeDraft({ target: "shipping", value: "" }))
    ).toEqual({})
  })
})

describe("validatePromotionDraft: schedule", () => {
  it("requires a start date", () => {
    expect(validatePromotionDraft(makeDraft({ startsAt: "" })).startsAt).toBe(
      "Pick a start date."
    )
  })

  it("treats an empty end date as no end", () => {
    expect(
      validatePromotionDraft(makeDraft({ endsAt: "" })).endsAt
    ).toBeUndefined()
  })

  it("rejects an end date before the start date", () => {
    expect(
      validatePromotionDraft(
        makeDraft({ startsAt: "2026-06-01", endsAt: "2026-05-31" })
      ).endsAt
    ).toBe("End date must be after the start date.")
  })

  it("accepts an end date on or after the start date", () => {
    expect(
      validatePromotionDraft(
        makeDraft({ startsAt: "2026-06-01", endsAt: "2026-06-01" })
      ).endsAt
    ).toBeUndefined()
    expect(
      validatePromotionDraft(
        makeDraft({ startsAt: "2026-06-01", endsAt: "2026-06-02" })
      ).endsAt
    ).toBeUndefined()
  })

  it("does not report an end-date error when there is no start date to compare", () => {
    const errors = validatePromotionDraft(
      makeDraft({ startsAt: "", endsAt: "2026-05-31" })
    )
    expect(errors.startsAt).toBe("Pick a start date.")
    expect(errors.endsAt).toBeUndefined()
  })
})

describe("validatePromotionDraft: usage limit", () => {
  it("treats an empty limit as unlimited", () => {
    expect(
      validatePromotionDraft(makeDraft({ usageLimit: "" })).usageLimit
    ).toBeUndefined()
    expect(
      validatePromotionDraft(makeDraft({ usageLimit: "   " })).usageLimit
    ).toBeUndefined()
  })

  it("accepts a whole number of 1 or more", () => {
    for (const usageLimit of ["1", "200", "5000"]) {
      expect(
        validatePromotionDraft(makeDraft({ usageLimit })).usageLimit
      ).toBeUndefined()
    }
  })

  it("rejects zero, negatives, decimals, and non-numerics", () => {
    for (const usageLimit of ["0", "-1", "1.5", "abc", "10 20"]) {
      expect(validatePromotionDraft(makeDraft({ usageLimit })).usageLimit).toBe(
        "Enter a whole number of 1 or more."
      )
    }
  })
})

describe("validatePromotionDraft: minimum subtotal", () => {
  it("treats an empty minimum as no minimum", () => {
    expect(
      validatePromotionDraft(makeDraft({ minSubtotal: "" })).minSubtotal
    ).toBeUndefined()
    expect(
      validatePromotionDraft(makeDraft({ minSubtotal: "   " })).minSubtotal
    ).toBeUndefined()
  })

  it("accepts 0 or more, including decimals", () => {
    for (const minSubtotal of ["0", "75", "99.99"]) {
      expect(
        validatePromotionDraft(makeDraft({ minSubtotal })).minSubtotal
      ).toBeUndefined()
    }
  })

  it("rejects a negative or non-numeric minimum", () => {
    for (const minSubtotal of ["-1", "abc"]) {
      expect(
        validatePromotionDraft(makeDraft({ minSubtotal })).minSubtotal
      ).toBe("Enter 0 or more.")
    }
  })
})

describe("validatePromotionDraft: multiple failures", () => {
  it("reports every broken field at once, not just the first", () => {
    const errors = validatePromotionDraft(
      makeDraft({
        name: "",
        code: "BAD CODE!",
        value: "0",
        startsAt: "",
        usageLimit: "0",
        minSubtotal: "-1",
      })
    )
    expect(Object.keys(errors).sort()).toEqual([
      "code",
      "minSubtotal",
      "name",
      "startsAt",
      "usageLimit",
      "value",
    ])
  })
})
