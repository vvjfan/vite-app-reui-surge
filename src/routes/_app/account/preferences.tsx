import { createFileRoute } from "@tanstack/react-router"

import { PreferencesSettings } from "@/features/account/components/preferences-settings"

// Personal app preferences. Header + tab nav live in the account layout; this
// route is just the content.
export const Route = createFileRoute("/_app/account/preferences")({
  staticData: { crumb: "Preferences" },
  component: () => <PreferencesSettings />,
})
