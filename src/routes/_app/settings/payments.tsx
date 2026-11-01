import { createFileRoute } from "@tanstack/react-router"

import { PaymentSettings } from "@/features/settings/components/payments/payment-settings"

export const Route = createFileRoute("/_app/settings/payments")({
  staticData: { crumb: "Payments" },
  component: () => <PaymentSettings />,
})
