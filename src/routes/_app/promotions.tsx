import { createFileRoute, Outlet } from "@tanstack/react-router"

// Layout for the Promotions section: the list + create/edit editor render in the
// Outlet.
export const Route = createFileRoute("/_app/promotions")({
  staticData: { crumb: "Promotions" },
  component: () => <Outlet />,
})
