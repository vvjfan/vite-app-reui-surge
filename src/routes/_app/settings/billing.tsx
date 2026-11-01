import { createFileRoute } from "@tanstack/react-router"

import { BillingSettings } from "@/features/settings/components/billing/billing-settings"

export const Route = createFileRoute("/_app/settings/billing")({
  staticData: { crumb: "Billing" },
  component: () => <BillingSettings />,
})
