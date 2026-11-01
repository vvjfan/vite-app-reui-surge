import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import { topLevelCategories } from "@/lib/data/categories"
import { categoriesListQuery } from "@/features/categories/queries"
import type { ProductSelectOption } from "../components/product-form-data"

// Category options come from the Categories entity (store-backed) rather than a
// hardcoded list, so the product editor and the catalog filter stay in sync with
// the Categories module: rename or add a top-level category there and it shows up
// here. Products carry a single top-level category name (see categoryProductCount),
// so only top-level categories are offered; children roll up on the category detail.
export function useProductCategoryOptions(): ProductSelectOption[] {
  const { data: categories = [] } = useQuery(categoriesListQuery())
  return useMemo(
    () =>
      topLevelCategories(categories).map((category) => ({
        value: category.name,
        label: category.name,
        description: category.description,
      })),
    [categories]
  )
}

// A product carries its category by name, not id (see Product.category), so the
// catalog grid needs this to resolve a name back to the top-level category's id
// (the /categories/$categoryId route param) before it can link the name. Names
// not found here (a renamed or removed category) map to nothing and stay text.
export function useProductCategoryIdByName(): Map<string, string> {
  const { data: categories = [] } = useQuery(categoriesListQuery())
  return useMemo(() => {
    const byName = new Map<string, string>()
    for (const category of topLevelCategories(categories)) {
      byName.set(category.name, category.id)
    }
    return byName
  }, [categories])
}
