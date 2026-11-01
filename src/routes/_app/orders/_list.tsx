import { createFileRoute, Outlet } from "@tanstack/react-router"

import { OrdersDataGrid } from "@/features/orders/components/orders-data-grid"
import { OrdersHeader } from "@/features/orders/components/orders-header"

// Pathless layout for the list half of the Orders section: the page header +
// grid stay mounted while the detail sheet (a child route) overlays via the
// Outlet, so the grid keeps its filters, scroll, and selection underneath.
//
// Pathless means no path segment: the children below still answer /orders and
// /orders/$orderId. /orders/new deliberately sits OUTSIDE this layout, as a
// sibling of `_list`, so the editor is a full page with no grid behind it.
export const Route = createFileRoute("/_app/orders/_list")({
  component: OrdersListLayout,
})

function OrdersListLayout() {
  return (
    <div className="flex flex-col gap-4">
      <OrdersHeader />
      <OrdersDataGrid />
      <Outlet />
    </div>
  )
}
