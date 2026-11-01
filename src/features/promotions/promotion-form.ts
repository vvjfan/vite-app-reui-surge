import type {
  Promotion,
  PromotionMethod,
  PromotionStatus,
  PromotionTarget,
  PromotionValueType,
} from "@/lib/data/promotions"

// Pure form logic for the promotion editor: the draft shape, the code rules, the
// validator, and the draft -> payload mapping. Deliberately free of React so the
// rules can be read (and tested) on their own, without rendering the editor.
//
// Validation matches the product editor's stack: plain React state plus a
// validate() pass on submit. The repo has no react-hook-form / zod dependency,
// so `validatePromotionDraft` below is the equivalent of a schema - one place
// that owns every rule and returns a field -> message map for inline errors.

// `summarizePromotion` reads "shipping" as free shipping regardless of the value
// fields, and the seed's FREESHIP row stores percentage/100 alongside it. The
// editor writes that same representation so a shipping promotion is never
// persisted with a stale percentage or amount from a previous target.
export const FREE_SHIPPING_VALUE_TYPE: PromotionValueType = "percentage"
export const FREE_SHIPPING_VALUE = 100

export interface PromotionDraft {
  name: string
  code: string
  method: PromotionMethod
  valueType: PromotionValueType
  target: PromotionTarget
  value: string
  startsAt: string
  endsAt: string
  usageLimit: string
  minSubtotal: string
  status: PromotionStatus
}

export type PromotionErrors = Partial<Record<keyof PromotionDraft, string>>

export function toDraft(promotion?: Promotion): PromotionDraft {
  return {
    name: promotion?.name ?? "",
    code: promotion?.code ?? "",
    method: promotion?.method ?? "code",
    valueType: promotion?.valueType ?? "percentage",
    target: promotion?.target ?? "order",
    value: promotion ? String(promotion.value) : "",
    startsAt: promotion?.startsAt ?? "",
    endsAt: promotion?.endsAt ?? "",
    usageLimit:
      promotion?.usageLimit === null ? "" : String(promotion?.usageLimit ?? ""),
    minSubtotal:
      promotion?.minSubtotal === null
        ? ""
        : String(promotion?.minSubtotal ?? ""),
    status: promotion?.status ?? "draft",
  }
}

/** Codes are shopper-facing: uppercase, no spaces, no punctuation beyond - and _. */
export function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/\s+/g, "")
}

export const CODE_PATTERN = /^[A-Z0-9_-]+$/

/** Every rule in one place; returns a field -> message map (empty = valid). */
export function validatePromotionDraft(draft: PromotionDraft): PromotionErrors {
  const errors: PromotionErrors = {}
  const isFreeShipping = draft.target === "shipping"

  if (!draft.name.trim()) {
    errors.name = "Name is required."
  }

  const code = normalizeCode(draft.code)
  if (!code) {
    errors.code = "Code is required."
  } else if (!CODE_PATTERN.test(code)) {
    errors.code = "Use letters, numbers, hyphens, and underscores only."
  }

  // The value fields are forced for free shipping, so they are not user input
  // and must not be validated against what the (hidden) input happens to hold.
  if (!isFreeShipping) {
    const value = Number(draft.value)
    if (!draft.value.trim() || Number.isNaN(value)) {
      errors.value = "Enter a discount value."
    } else if (value <= 0) {
      errors.value = "Value must be greater than 0."
    } else if (draft.valueType === "percentage" && value > 100) {
      errors.value = "Percentage cannot be over 100."
    }
  }

  if (!draft.startsAt) {
    errors.startsAt = "Pick a start date."
  }
  if (draft.endsAt && draft.startsAt && draft.endsAt < draft.startsAt) {
    errors.endsAt = "End date must be after the start date."
  }

  if (draft.usageLimit.trim()) {
    const usageLimit = Number(draft.usageLimit)
    if (
      Number.isNaN(usageLimit) ||
      !Number.isInteger(usageLimit) ||
      usageLimit < 1
    ) {
      errors.usageLimit = "Enter a whole number of 1 or more."
    }
  }

  if (draft.minSubtotal.trim()) {
    const minSubtotal = Number(draft.minSubtotal)
    if (Number.isNaN(minSubtotal) || minSubtotal < 0) {
      errors.minSubtotal = "Enter 0 or more."
    }
  }

  return errors
}

/** Draft -> the shape the repository stores (minus id / usedCount). */
export function toPayload(draft: PromotionDraft, currency: string) {
  const isFreeShipping = draft.target === "shipping"
  return {
    name: draft.name.trim(),
    code: normalizeCode(draft.code),
    method: draft.method,
    valueType: isFreeShipping ? FREE_SHIPPING_VALUE_TYPE : draft.valueType,
    target: draft.target,
    value: isFreeShipping ? FREE_SHIPPING_VALUE : Number(draft.value),
    currency,
    status: draft.status,
    startsAt: draft.startsAt || null,
    endsAt: draft.endsAt || null,
    usageLimit: draft.usageLimit.trim() ? Number(draft.usageLimit) : null,
    minSubtotal: draft.minSubtotal.trim() ? Number(draft.minSubtotal) : null,
  }
}
