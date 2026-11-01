// Data-ink for the charts whose axis is a CATEGORY. Declared once so a category
// is the same color on the dashboard as it is in analytics: two copies would
// drift the moment either chart gained a category.
//
// Palette tokens rather than the theme's --chart-1..5, which are greyscale here
// and would paint every bar the same tone. Scoped to chart data-ink only: never
// UI chrome, never a badge, never a container.

export const CATEGORY_COLORS: Record<string, string> = {
  Apparel: "var(--color-indigo-500)",
  Footwear: "var(--color-sky-500)",
  Outerwear: "var(--color-emerald-500)",
  Bags: "var(--color-amber-500)",
  Accessories: "var(--color-rose-500)",
  Activewear: "var(--color-violet-500)",
  Denim: "var(--color-teal-500)",
}

/**
 * The color a category is painted in. Order lines whose product no longer
 * resolves roll up as "Unknown" (see the dashboard's categoryTotals), and a
 * category can be added to the catalog without being added here, so an unmapped
 * name is a real case rather than a defect: it reads as neutral instead of
 * borrowing another category's identity.
 */
export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "var(--color-muted-foreground)"
}
