import { createFileRoute } from "@tanstack/react-router"

import { SuppliersPanel } from "@/features/suppliers/components/suppliers-panel"

export const Route = createFileRoute("/_app/settings/suppliers")({
  staticData: { crumb: "Suppliers" },
  component: () => <SuppliersPanel />,
})
