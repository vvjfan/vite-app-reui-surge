// Formatters for the Analytics feature.
//
// There are three `formatCurrency` implementations in this repo with two
// incompatible behaviours: the Intl one in features/orders ("$1,113.08") and the
// compact one in lib/data/dashboard ("$1.1K"). Importing both into one component
// is a footgun, so this module re-exports them under explicit names and adds the
// percent formatter the codebase was missing.

export { formatCurrency } from "@/features/orders/lib/format"
export { formatCurrency as formatCompactCurrency } from "@/lib/data/dashboard"

/** "2.8%" - conversion, funnel and share figures. */
export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`
}

/** Compact session/visitor counts: 1700 -> "1,700", 1_200_000 -> "1.2M". */
export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  // Intl rather than toLocaleString(): pin the locale so the server and a
  // non-en client format identically (no SSR hydration mismatch).
  return new Intl.NumberFormat("en-US").format(value)
}

/** A UTC calendar day (YYYY-MM-DD) as "May 11". */
export function formatDayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    // Seed dates are UTC instants; pin the calendar day to UTC so the server and
    // a non-UTC client agree (no SSR hydration mismatch).
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00.000Z`))
}
