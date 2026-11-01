import { createFileRoute, Outlet } from "@tanstack/react-router"

// Bare section layout, mirroring products.tsx. The grid used to live here, but
// /orders/new needs a full page with no grid behind it, and a sibling of the
// grid would have rendered stacked below it. The grid moved down into the
// pathless `_list` layout instead: `_list` adds no path segment, so /orders and
// /orders/$orderId are unchanged, while /orders/new sits outside it.
export const Route = createFileRoute("/_app/orders")({
  staticData: { crumb: "Orders" },
  component: () => <Outlet />,
})
