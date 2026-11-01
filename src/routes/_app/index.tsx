import { createFileRoute } from "@tanstack/react-router"

import { Dashboard } from "@/features/dashboard/components/dashboard"

export const Route = createFileRoute("/_app/")({
  staticData: { crumb: "Dashboard" },
  component: DashboardPage,
})

function DashboardPage() {
  return <Dashboard />
}
