// Shared formatters for the Orders feature (grid + detail).

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatOrderDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    // Seed dates are UTC instants; pin the calendar day to UTC so the server
    // (UTC) and a non-UTC client format identically (no SSR hydration mismatch).
    timeZone: "UTC",
  }).format(new Date(iso))
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}
