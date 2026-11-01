import { Badge } from "@/components/reui/badge"

import { TAX_RATE } from "@/lib/data/commerce"
import type { OrderTotals } from "@/lib/data/types"
import { formatCurrency } from "../lib/format"
import { TruckIcon } from "@phosphor-icons/react"

// The relocated form-3 summary panel, re-fielded for an order.
//
// form-3 previewed subtotal / discount / tax / total and owned an editable
// discount input. An OrderTotals is { subtotal, shipping, tax, total } - there
// is no discount on an order - so the discount row and its input are gone, and
// shipping takes the row they vacated.
//
// This component does no arithmetic at all: it renders the OrderTotals the
// editor computed with `orderTotals`, the same function `toOrderPayload` calls
// to write the saved order's totals. The preview therefore cannot drift from
// what gets stored.

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? "font-medium text-foreground" : undefined}>
        {label}
      </dt>
      <dd
        className={
          strong
            ? "text-base font-semibold text-foreground tabular-nums"
            : "text-foreground tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  )
}

// Decorative only (aria-hidden): the block's panel treatment, carried over so
// the summary keeps form-3's look. Every colour is a semantic token.
function SummaryPanelBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_84%_12%,color-mix(in_oklch,var(--color-warning)_26%,transparent),transparent_34%),radial-gradient(circle_at_8%_96%,color-mix(in_oklch,var(--color-primary)_12%,transparent),transparent_30%),linear-gradient(135deg,color-mix(in_oklch,var(--color-warning)_7%,transparent),transparent_58%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle,color-mix(in_oklch,var(--color-muted-foreground)_12%,transparent)_1px,transparent_1.6px)] [mask-image:linear-gradient(135deg,transparent_0%,black_22%,black_76%,transparent_100%)] bg-[length:20px_20px] opacity-35" />
      <svg
        viewBox="0 0 360 220"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full text-warning"
      >
        <path
          d="M236 8H331L360 37V126H236C225 126 216 117 216 106V28C216 17 225 8 236 8Z"
          fill="currentColor"
          opacity="0.12"
        />
        <path
          d="M331 8V37H360"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.24"
        />
        <circle
          cx="326"
          cy="41"
          r="6.5"
          fill="var(--color-background)"
          opacity="0.88"
        />
        <path
          d="M147 41L156 59L175 68L156 77L147 96L138 77L119 68L138 59Z"
          fill="currentColor"
          opacity="0.12"
        />
        <path
          d="M201 145L207 157L219 163L207 169L201 181L195 169L183 163L195 157Z"
          fill="currentColor"
          opacity="0.1"
        />
        <circle cx="333" cy="162" r="42" fill="currentColor" opacity="0.07" />
        <circle cx="333" cy="162" r="18" fill="currentColor" opacity="0.09" />
        <path
          d="M-14 204C39 175 91 164 152 171C213 178 259 164 371 116V220H-14Z"
          fill="currentColor"
          opacity="0.07"
        />
      </svg>
      <div className="absolute top-1/2 -right-2 size-4 rounded-full border bg-background/90 shadow-xs" />
      <div className="absolute right-16 -bottom-2 size-4 rounded-full border bg-background/90 shadow-xs" />
    </div>
  )
}

export function OrderSummary({
  totals,
  shippingMethod,
}: {
  totals: OrderTotals
  shippingMethod: string
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_21rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-3">
        {/* One badge, not form-3's two: the second would have to restate the
            status toOrderPayload mints, and a badge that repeats a rule it does
            not own is a second source of truth waiting to drift. */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            <TruckIcon aria-hidden="true" />
            {shippingMethod}
          </Badge>
        </div>
        <div className="flex min-w-0 flex-col gap-1 text-sm text-muted-foreground">
          <p>Totals update as products, variants, and quantities change.</p>
          <p>
            {/* The rate is read from the store's own constant, so this line
                cannot fall out of step with the tax the order is charged. */}
            Tax is charged at {TAX_RATE * 100}% of the subtotal.
          </p>
        </div>
      </div>

      <div className="relative isolate overflow-hidden rounded-md border bg-background p-4 shadow-xs">
        <SummaryPanelBackground />

        <div className="relative flex flex-col gap-4">
          <dl className="grid gap-2.5 rounded-md border bg-background/70 p-3 text-sm backdrop-blur-sm">
            <SummaryRow
              label="Subtotal"
              value={formatCurrency(totals.subtotal)}
            />
            <SummaryRow
              label="Shipping"
              value={formatCurrency(totals.shipping)}
            />
            <SummaryRow label="Tax" value={formatCurrency(totals.tax)} />
            <SummaryRow
              label="Total"
              value={formatCurrency(totals.total)}
              strong
            />
          </dl>
        </div>
      </div>
    </div>
  )
}
