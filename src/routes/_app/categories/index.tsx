import { createFileRoute } from "@tanstack/react-router"

import { CategoriesDataGrid } from "@/features/categories/components/categories-data-grid"
import { CategoriesHeader } from "@/features/categories/components/categories-header"

export const Route = createFileRoute("/_app/categories/")({
  component: CategoriesListPage,
})

function CategoriesListPage() {
  return (
    <div className="flex flex-col gap-4">
      <CategoriesHeader />
      <CategoriesDataGrid />
    </div>
  )
}
