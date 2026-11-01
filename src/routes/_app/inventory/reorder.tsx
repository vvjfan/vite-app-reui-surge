import { createFileRoute } from "@tanstack/react-router"

import { ReorderHeader } from "@/features/inventory/components/reorder-header"
import { ReorderView } from "@/features/inventory/components/reorder-view"

export const Route = createFileRoute("/_app/inventory/reorder")({
  staticData: { crumb: "Reorder queue" },
  component: ReorderPage,
})

// Page header + reorder queue. The shared content frame (max width + padding)
// lives in _app.tsx, so this renders content directly without an mx-auto
// max-w wrapper.
function ReorderPage() {
  return (
    <div className="flex flex-col gap-4">
      <ReorderHeader />
      <ReorderView />
    </div>
  )
}
