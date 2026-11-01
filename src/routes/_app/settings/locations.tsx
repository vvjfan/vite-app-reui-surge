import { createFileRoute } from "@tanstack/react-router"

import { LocationsPanel } from "@/features/locations/components/locations-panel"

export const Route = createFileRoute("/_app/settings/locations")({
  staticData: { crumb: "Locations" },
  component: () => <LocationsPanel />,
})
