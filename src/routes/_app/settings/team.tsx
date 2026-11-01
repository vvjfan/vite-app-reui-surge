import { createFileRoute } from "@tanstack/react-router"

import { MembersGrid } from "@/features/settings/components/team/members-grid"

export const Route = createFileRoute("/_app/settings/team")({
  staticData: { crumb: "Team" },
  component: SettingsTeamPage,
})

function SettingsTeamPage() {
  return <MembersGrid />
}
