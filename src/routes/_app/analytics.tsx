import { createFileRoute } from "@tanstack/react-router"

import { Analytics } from "@/features/analytics/components/analytics"

export const Route = createFileRoute("/_app/analytics")({
  staticData: { crumb: "Analytics" },
  component: Analytics,
})
