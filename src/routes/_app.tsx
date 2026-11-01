import { Outlet, createFileRoute } from "@tanstack/react-router"

import { AppShell } from "@/components/shared/app-shell/app-shell"

// Pathless layout for the signed-in area. The app shell mounts here exactly
// once and wraps every route nested under `_app/`.
export const Route = createFileRoute("/_app")({
  component: AppLayout,
})

function AppLayout() {
  return (
    <AppShell>
      {/* Shared content frame: every page gets the same max width + padding. */}
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <Outlet />
      </div>
    </AppShell>
  )
}
