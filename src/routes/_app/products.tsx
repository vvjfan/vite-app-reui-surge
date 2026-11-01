import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/products")({
  staticData: { crumb: "Products" },
  component: () => <Outlet />,
})
