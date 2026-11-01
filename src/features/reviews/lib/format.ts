// Shared formatters for the Reviews feature (grid + sheet + rollup).

export function formatReviewDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    // Seed dates are UTC instants; pin the calendar day to UTC so the server
    // (UTC) and a non-UTC client format identically (no SSR hydration mismatch).
    timeZone: "UTC",
  }).format(new Date(iso))
}
