import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import { categoriesListQuery } from "@/features/categories/queries"
import { topLevelCategories } from "@/lib/data/categories"
import type { StockLocation } from "@/lib/data/locations"
import type { Supplier } from "@/lib/data/suppliers"

export interface FilterOption {
  value: string
  label: string
}

// Filter options for the ledger + reorder toolbars.
//
// None of these are hardcoded: a client who points the repository at their own
// backend gets their own locations and suppliers in the dropdowns, not ours. The
// donor block shipped fixed lists ("Main Warehouse", "Aster Goods", ...), so a
// real store's rows were simply unfilterable.
//
// Every one of them now comes from its entity rather than from the rows, so
// renaming a supplier, location or category in settings updates these filters
// with it, and one that exists but is not stocked yet is still filterable.

/**
 * Supplier options come from the Suppliers entity. This used to derive from the
 * rows, because supplier was free text on each row; it is an entity now, so a
 * typo can no longer invent an option, and the value is the id the rows
 * reference rather than a name.
 */
export function useSupplierOptions(
  suppliers: readonly Supplier[]
): FilterOption[] {
  return useMemo(
    () => [
      { value: "all", label: "Supplier" },
      ...[...suppliers]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((supplier) => ({ value: supplier.id, label: supplier.name })),
    ],
    [suppliers]
  )
}

/**
 * Location options come from the Locations entity, not the rows: a location the
 * client has created but not stocked yet should still be filterable, and the
 * value is the id the rows actually reference.
 */
export function useLocationOptions(
  locations: readonly StockLocation[]
): FilterOption[] {
  return useMemo(
    () => [
      { value: "all", label: "Location" },
      ...[...locations]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((location) => ({ value: location.id, label: location.name })),
    ],
    [locations]
  )
}

/**
 * Category options from the Categories entity (store-backed). Inventory rows
 * carry a single top-level category name, like products, so only top-level
 * categories are offered.
 */
export function useInventoryCategoryOptions(): FilterOption[] {
  const { data: categories = [] } = useQuery(categoriesListQuery())
  return useMemo(
    () => [
      { value: "all", label: "Category" },
      ...topLevelCategories(categories).map((category) => ({
        value: category.name,
        label: category.name,
      })),
    ],
    [categories]
  )
}
