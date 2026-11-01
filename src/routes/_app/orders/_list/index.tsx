import { createFileRoute } from "@tanstack/react-router"

// The grid lives in the parent layout (orders/_list.tsx); the index adds nothing
// over it. A detail sheet mounts here via the Outlet at /orders/$orderId.
export const Route = createFileRoute("/_app/orders/_list/")({
  component: () => null,
})
