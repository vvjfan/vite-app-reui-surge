import { createFileRoute, Outlet } from "@tanstack/react-router"

// Section layout for Settings, matching the other sections (products, orders,
// categories). Settings pages fill the shared container from `_app.tsx` and set
// no width of their own.
export const Route = createFileRoute("/_app/settings")({
  staticData: { crumb: "Settings" },
  component: () => <Outlet />,
})
