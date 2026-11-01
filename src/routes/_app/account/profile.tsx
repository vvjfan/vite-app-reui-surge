import { createFileRoute } from "@tanstack/react-router"

import { ProfileSettings } from "@/features/account/components/profile-settings"

// Personal profile. Header + tab nav live in the account layout; this route is
// just the content.
export const Route = createFileRoute("/_app/account/profile")({
  staticData: { crumb: "Profile" },
  component: () => <ProfileSettings />,
})
