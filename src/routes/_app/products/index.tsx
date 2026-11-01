import { createFileRoute } from "@tanstack/react-router"

import { ProductsDataGrid } from "@/features/products/components/products-data-grid"
import { ProductsHeader } from "@/features/products/components/products-header"

export const Route = createFileRoute("/_app/products/")({
  component: ProductsListPage,
})

function ProductsListPage() {
  return (
    <div className="flex flex-col gap-4">
      <ProductsHeader />
      <ProductsDataGrid />
    </div>
  )
}
