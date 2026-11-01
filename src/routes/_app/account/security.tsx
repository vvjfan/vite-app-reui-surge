import { createFileRoute } from "@tanstack/react-router"

import { SecuritySettings } from "@/features/account/components/security-settings"

// Personal sign-in security. Header + tab nav live in the account layout; this
// route is just the content.
export const Route = createFileRoute("/_app/account/security")({
  staticData: { crumb: "Security" },
  component: () => <SecuritySettings />,
})
