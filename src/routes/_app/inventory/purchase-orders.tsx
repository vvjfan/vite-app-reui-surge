import { createFileRoute } from "@tanstack/react-router"

import { PurchaseOrdersGrid } from "@/features/purchase-orders/components/purchase-orders-grid"

export const Route = createFileRoute("/_app/inventory/purchase-orders")({
  staticData: { crumb: "Purchase orders" },
  component: PurchaseOrdersPage,
})

// The shared content frame (max width + padding) lives in _app.tsx, so the
// grid renders directly - it owns its own PageHeader.
function PurchaseOrdersPage() {
  return <PurchaseOrdersGrid />
}
