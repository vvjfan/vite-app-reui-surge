import { useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { cn } from "@/lib/utils"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { Button, buttonVariants } from "@/components/ui/button"
import { FieldError, FieldGroup, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  PROMOTION_METHOD_OPTIONS,
  PROMOTION_STATUS_OPTIONS,
  PROMOTION_TARGET_OPTIONS,
  PROMOTION_VALUE_TYPE_OPTIONS,
  summarizePromotion,
  type Promotion,
} from "@/lib/data/promotions"
import {
  InsetSeparator,
  OptionSelect,
  PromotionRow,
  withDescriptions,
} from "./promotion-form-fields"
import {
  FREE_SHIPPING_VALUE,
  FREE_SHIPPING_VALUE_TYPE,
  normalizeCode,
  toDraft,
  toPayload,
  validatePromotionDraft,
  type PromotionDraft,
  type PromotionErrors,
} from "../promotion-form"
import { useCreatePromotion, useUpdatePromotion } from "../queries"

// Full-page promotion editor, mirroring the product editor's page structure
// (PageHeader with the primary/secondary actions, sectioned Frame body, 2-column
// grid with a Status sidebar). The form rows are the relocated form-12 label +
// control rows, re-fielded for the Promotion model.
//
// The draft shape, the code rules, the validator, and the draft -> payload
// mapping live in ../promotion-form, so this file is only the React surface.

const METHOD_OPTIONS = withDescriptions(PROMOTION_METHOD_OPTIONS, {
  code: "Shoppers enter a promo code at checkout.",
  automatic: "Applies on its own when the cart qualifies.",
})

const VALUE_TYPE_OPTIONS = withDescriptions(PROMOTION_VALUE_TYPE_OPTIONS, {
  percentage: "Takes a percentage off the total.",
  fixed: "Takes a flat amount off the total.",
})

const TARGET_OPTIONS = withDescriptions(PROMOTION_TARGET_OPTIONS, {
  order: "Discounts the entire order subtotal.",
  items: "Discounts the qualifying line items.",
  shipping: "Free shipping on qualifying orders.",
})

const STATUS_OPTIONS = withDescriptions(PROMOTION_STATUS_OPTIONS, {
  active: "Live and redeemable right now.",
  scheduled: "Starts automatically on its start date.",
  expired: "Past its end date, no longer redeemable.",
  draft: "Saved but not redeemable.",
})

const DEFAULT_CURRENCY = "USD"

// Error-key -> input id, in visual order, so a blocked submit focuses the first
// field that failed rather than whichever validatePromotionDraft happened to set
// first. Selects (method / target / value type / status) carry no rule, so they
// are not listed.
const FIELD_ORDER: Array<[keyof PromotionErrors, string]> = [
  ["name", "promotion-name"],
  ["code", "promotion-code"],
  ["value", "promotion-value"],
  ["startsAt", "promotion-starts-at"],
  ["endsAt", "promotion-ends-at"],
  ["usageLimit", "promotion-usage-limit"],
  ["minSubtotal", "promotion-min-subtotal"],
]

export function PromotionEditor({
  mode,
  promotion,
}: {
  mode: "create" | "edit"
  promotion?: Promotion
}) {
  const navigate = useNavigate()
  const createPromotion = useCreatePromotion()
  const updatePromotion = useUpdatePromotion()
  const isSubmitting = createPromotion.isPending || updatePromotion.isPending

  const [draft, setDraft] = useState<PromotionDraft>(() => toDraft(promotion))
  const [errors, setErrors] = useState<PromotionErrors>({})

  const currency = promotion?.currency ?? DEFAULT_CURRENCY
  const isFreeShipping = draft.target === "shipping"

  // Re-validate a field as soon as it changes, but only once the form has
  // already failed: errors surface on submit, then clear live as the user fixes
  // them. Both updates are computed from `draft` (not inside a state updater),
  // so nothing here runs twice under StrictMode's double-invoked reducers.
  function setField<TKey extends keyof PromotionDraft>(
    key: TKey,
    value: PromotionDraft[TKey]
  ) {
    const next = { ...draft, [key]: value }
    setDraft(next)
    if (Object.keys(errors).length > 0) {
      setErrors(validatePromotionDraft(next))
    }
  }

  // The live preview reads the same summarizePromotion the grid's Type column
  // uses, so what the editor previews is exactly what the list will show. The
  // value is re-coerced because a half-typed or empty input parses to NaN, which
  // would preview as "NaN% off order" rather than falling back to 0.
  const previewPromotion: Promotion = {
    id: promotion?.id ?? "preview",
    usedCount: promotion?.usedCount ?? 0,
    rank: promotion?.rank ?? 0,
    ...toPayload(draft, currency),
    value: isFreeShipping ? FREE_SHIPPING_VALUE : Number(draft.value) || 0,
  }
  const preview = summarizePromotion(previewPromotion)

  function handleSave() {
    if (isSubmitting) return

    // One pass validates every field; the messages surface inline under each
    // control (FieldError + aria-invalid) instead of a single toast, and the
    // first failing field in visual order takes focus.
    const nextErrors = validatePromotionDraft(draft)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      const firstInvalid = FIELD_ORDER.find(([key]) => nextErrors[key])
      if (firstInvalid) document.getElementById(firstInvalid[1])?.focus()
      return
    }
    setErrors({})

    const payload = toPayload(draft, currency)

    if (mode === "edit" && promotion) {
      updatePromotion.mutate(
        { id: promotion.id, patch: payload },
        {
          onSuccess: () =>
            toast.success("Promotion saved", { description: payload.code }),
        }
      )
      return
    }

    createPromotion.mutate(payload, {
      onSuccess: (created) => {
        toast.success("Promotion created", { description: created.code })
        navigate({ to: "/promotions" })
      },
    })
  }

  return (
    <TooltipProvider delay={200}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={
            draft.name.trim() ||
            (mode === "edit" ? "Untitled promotion" : "New promotion")
          }
          description={preview}
          actions={
            <>
              <Link
                to="/promotions"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Cancel
              </Link>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Spinner data-icon="inline-start" aria-hidden="true" />
                ) : null}
                {mode === "edit" ? "Save changes" : "Create promotion"}
              </Button>
            </>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Main column */}
          <div className="flex min-w-0 flex-col gap-4">
            {/* Details */}
            <Frame dense className="w-full">
              <FrameHeader>
                <FrameTitle>Details</FrameTitle>
              </FrameHeader>
              <FramePanel className="p-0! shadow-none!">
                <FieldSet className="gap-0">
                  <FieldGroup className="gap-0">
                    <PromotionRow
                      title="Name"
                      description="Internal label for this promotion."
                      htmlFor="promotion-name"
                    >
                      <Input
                        id="promotion-name"
                        value={draft.name}
                        onChange={(event) =>
                          setField("name", event.target.value)
                        }
                        placeholder="e.g. Summer sale"
                        autoComplete="off"
                        aria-invalid={Boolean(errors.name)}
                        required
                      />
                      {errors.name ? (
                        <FieldError>{errors.name}</FieldError>
                      ) : null}
                    </PromotionRow>
                    <InsetSeparator />
                    <PromotionRow
                      title={
                        draft.method === "automatic"
                          ? "Reference code"
                          : "Promo code"
                      }
                      description={
                        draft.method === "automatic"
                          ? "Not shown to shoppers; identifies this promotion in reports."
                          : "What shoppers type at checkout."
                      }
                      htmlFor="promotion-code"
                    >
                      <Input
                        id="promotion-code"
                        value={draft.code}
                        onChange={(event) =>
                          setField("code", normalizeCode(event.target.value))
                        }
                        placeholder="e.g. SUMMER20"
                        autoComplete="off"
                        className="font-mono"
                        aria-invalid={Boolean(errors.code)}
                        required
                      />
                      {errors.code ? (
                        <FieldError>{errors.code}</FieldError>
                      ) : null}
                    </PromotionRow>
                    <InsetSeparator />
                    <PromotionRow
                      title="Method"
                      description="How shoppers get this discount."
                      htmlFor="promotion-method"
                    >
                      <OptionSelect
                        id="promotion-method"
                        value={draft.method}
                        options={METHOD_OPTIONS}
                        onValueChange={(value) => setField("method", value)}
                      />
                    </PromotionRow>
                  </FieldGroup>
                </FieldSet>
              </FramePanel>
            </Frame>

            {/* Discount */}
            <Frame dense className="w-full">
              <FrameHeader>
                <FrameTitle>Discount</FrameTitle>
              </FrameHeader>
              <FramePanel className="p-0! shadow-none!">
                <FieldSet className="gap-0">
                  <FieldGroup className="gap-0">
                    <PromotionRow
                      title="Applies to"
                      description="What the discount comes off."
                      hint="Shipping is always a full free-shipping discount, so it has no value of its own."
                      htmlFor="promotion-target"
                    >
                      <OptionSelect
                        id="promotion-target"
                        value={draft.target}
                        options={TARGET_OPTIONS}
                        onValueChange={(value) => setField("target", value)}
                      />
                    </PromotionRow>
                    <InsetSeparator />
                    <PromotionRow
                      title="Value type"
                      description="Percentage off, or a flat amount off."
                      htmlFor="promotion-value-type"
                    >
                      <OptionSelect
                        id="promotion-value-type"
                        value={
                          isFreeShipping
                            ? FREE_SHIPPING_VALUE_TYPE
                            : draft.valueType
                        }
                        options={VALUE_TYPE_OPTIONS}
                        onValueChange={(value) => setField("valueType", value)}
                        disabled={isFreeShipping}
                      />
                    </PromotionRow>
                    {/* Free shipping has no value to set: the row is replaced by
                        the rule it stands in for, rather than left as a disabled
                        input the user could read as something to fill in. */}
                    {isFreeShipping ? null : (
                      <>
                        <InsetSeparator />
                        <PromotionRow
                          title="Value"
                          description={
                            draft.valueType === "percentage"
                              ? "Percentage taken off."
                              : "Amount taken off."
                          }
                          htmlFor="promotion-value"
                        >
                          <InputGroup>
                            {draft.valueType === "fixed" ? (
                              <InputGroupAddon align="inline-start">
                                <InputGroupText>$</InputGroupText>
                              </InputGroupAddon>
                            ) : null}
                            <InputGroupInput
                              id="promotion-value"
                              value={draft.value}
                              onChange={(event) =>
                                setField("value", event.target.value)
                              }
                              placeholder={
                                draft.valueType === "percentage" ? "20" : "25"
                              }
                              inputMode="decimal"
                              aria-invalid={Boolean(errors.value)}
                            />
                            {draft.valueType === "percentage" ? (
                              <InputGroupAddon align="inline-end">
                                <InputGroupText>%</InputGroupText>
                              </InputGroupAddon>
                            ) : null}
                          </InputGroup>
                          {errors.value ? (
                            <FieldError>{errors.value}</FieldError>
                          ) : null}
                        </PromotionRow>
                      </>
                    )}
                    <InsetSeparator />
                    <PromotionRow
                      title="Preview"
                      description="How this reads on the promotions list."
                    >
                      <p className="text-sm font-medium text-foreground">
                        {preview}
                      </p>
                    </PromotionRow>
                  </FieldGroup>
                </FieldSet>
              </FramePanel>
            </Frame>

            {/* Schedule */}
            <Frame dense className="w-full">
              <FrameHeader>
                <FrameTitle>Schedule</FrameTitle>
              </FrameHeader>
              <FramePanel className="p-0! shadow-none!">
                <FieldSet className="gap-0">
                  <FieldGroup className="gap-0">
                    <PromotionRow
                      title="Starts"
                      description="The day this promotion becomes redeemable."
                      htmlFor="promotion-starts-at"
                    >
                      <Input
                        id="promotion-starts-at"
                        type="date"
                        value={draft.startsAt}
                        onChange={(event) =>
                          setField("startsAt", event.target.value)
                        }
                        aria-invalid={Boolean(errors.startsAt)}
                        required
                      />
                      {errors.startsAt ? (
                        <FieldError>{errors.startsAt}</FieldError>
                      ) : null}
                    </PromotionRow>
                    <InsetSeparator />
                    <PromotionRow
                      title="Ends"
                      description="Leave empty to run with no end date."
                      htmlFor="promotion-ends-at"
                    >
                      <Input
                        id="promotion-ends-at"
                        type="date"
                        value={draft.endsAt}
                        min={draft.startsAt || undefined}
                        onChange={(event) =>
                          setField("endsAt", event.target.value)
                        }
                        aria-invalid={Boolean(errors.endsAt)}
                      />
                      {errors.endsAt ? (
                        <FieldError>{errors.endsAt}</FieldError>
                      ) : null}
                    </PromotionRow>
                  </FieldGroup>
                </FieldSet>
              </FramePanel>
            </Frame>

            {/* Limits */}
            <Frame dense className="w-full">
              <FrameHeader>
                <FrameTitle>Limits</FrameTitle>
              </FrameHeader>
              <FramePanel className="p-0! shadow-none!">
                <FieldSet className="gap-0">
                  <FieldGroup className="gap-0">
                    <PromotionRow
                      title="Usage limit"
                      description="Leave empty for unlimited redemptions."
                      htmlFor="promotion-usage-limit"
                    >
                      <Input
                        id="promotion-usage-limit"
                        value={draft.usageLimit}
                        onChange={(event) =>
                          setField("usageLimit", event.target.value)
                        }
                        placeholder="Unlimited"
                        inputMode="numeric"
                        autoComplete="off"
                        aria-invalid={Boolean(errors.usageLimit)}
                      />
                      {errors.usageLimit ? (
                        <FieldError>{errors.usageLimit}</FieldError>
                      ) : null}
                    </PromotionRow>
                    <InsetSeparator />
                    <PromotionRow
                      title="Minimum subtotal"
                      description="Leave empty to qualify on any order."
                      htmlFor="promotion-min-subtotal"
                    >
                      <InputGroup>
                        <InputGroupAddon align="inline-start">
                          <InputGroupText>$</InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                          id="promotion-min-subtotal"
                          value={draft.minSubtotal}
                          onChange={(event) =>
                            setField("minSubtotal", event.target.value)
                          }
                          placeholder="No minimum"
                          inputMode="decimal"
                          aria-invalid={Boolean(errors.minSubtotal)}
                        />
                      </InputGroup>
                      {errors.minSubtotal ? (
                        <FieldError>{errors.minSubtotal}</FieldError>
                      ) : null}
                    </PromotionRow>
                  </FieldGroup>
                </FieldSet>
              </FramePanel>
            </Frame>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            <Frame dense className="w-full">
              <FrameHeader>
                <FrameTitle>Status</FrameTitle>
              </FrameHeader>
              <FramePanel className="shadow-none!">
                <OptionSelect
                  id="promotion-status"
                  value={draft.status}
                  options={STATUS_OPTIONS}
                  onValueChange={(value) => setField("status", value)}
                />
              </FramePanel>
            </Frame>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
