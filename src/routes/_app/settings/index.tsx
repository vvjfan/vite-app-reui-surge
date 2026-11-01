import { createFileRoute } from "@tanstack/react-router"

import { DemoDataCard } from "@/features/settings/components/general/demo-data"
import { GeneralSettings } from "@/features/settings/components/general/general-settings"
import { isDemoMode } from "@/lib/data/repositories"

export const Route = createFileRoute("/_app/settings/")({
  staticData: { crumb: "General" },
  component: SettingsGeneralPage,
})

function SettingsGeneralPage() {
  return (
    <div className="flex w-full flex-col gap-5">
      <GeneralSettings />
      {/* Demo-store only: against a real backend there is no sample dataset to
          load, and the controls would have nothing to act on. */}
      {isDemoMode ? <DemoDataCard /> : null}
    </div>
  )
}
