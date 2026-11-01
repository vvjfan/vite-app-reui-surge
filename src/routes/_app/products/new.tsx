import { createFileRoute } from "@tanstack/react-router"

import { ProductEditor } from "@/features/products/components/product-editor"

// Static route: takes precedence over `$productId`, so /products/new is the
// create editor, not a product with id "new".
export const Route = createFileRoute("/_app/products/new")({
  staticData: { crumb: "New product" },
  component: () => <ProductEditor mode="create" />,
})
