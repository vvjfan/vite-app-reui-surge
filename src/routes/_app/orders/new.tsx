import { createFileRoute } from "@tanstack/react-router"

import { OrderEditor } from "@/features/orders/components/order-editor"

// Outside the `_list` layout on purpose: the editor owns the screen, so the
// orders grid must not render behind it. A static route also takes precedence
// over `_list/$orderId`, so /orders/new is the create editor, not an order with
// id "new".
export const Route = createFileRoute("/_app/orders/new")({
  staticData: { crumb: "New order" },
  component: () => <OrderEditor />,
})
