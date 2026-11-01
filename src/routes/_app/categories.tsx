import { createFileRoute, Outlet } from "@tanstack/react-router"

// Layout for the Categories section: the list + detail render in the Outlet.
export const Route = createFileRoute("/_app/categories")({
  staticData: { crumb: "Categories" },
  component: () => <Outlet />,
})
