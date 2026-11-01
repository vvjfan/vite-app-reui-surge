import { createFileRoute } from "@tanstack/react-router"

import { NotificationPreferences } from "@/features/settings/components/notifications/notification-preferences"

export const Route = createFileRoute("/_app/settings/notifications")({
  staticData: { crumb: "Notifications" },
  component: () => <NotificationPreferences />,
})
