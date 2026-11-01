// Shared product option types + the status option list (relocated from the ReUI
// form-12 block's data module). Category options are no longer hardcoded here:
// they come from the Categories entity via useProductCategoryOptions.

export type ProductSelectOption<TValue extends string = string> = {
  value: TValue
  label: string
  description: string
  color?: string
}

export type ProductStatusValue = "draft" | "active" | "scheduled"

export function getOptionLabel<TValue extends string>(
  options: ProductSelectOption<TValue>[],
  value: TValue
) {
  return options.find((option) => option.value === value)?.label ?? value
}

export const PRODUCT_STATUS_OPTIONS: ProductSelectOption<ProductStatusValue>[] =
  [
    {
      value: "draft",
      label: "Draft",
      description: "Hidden until product details are approved.",
      color: "bg-warning",
    },
    {
      value: "active",
      label: "Active",
      description: "Available in selected sales channels.",
      color: "bg-success",
    },
    {
      value: "scheduled",
      label: "Scheduled",
      description: "Publishes when the launch window opens.",
      color: "bg-info",
    },
  ]
