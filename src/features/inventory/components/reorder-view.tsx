import { ReorderStatsHeader } from "./reorder-stats-header"
import { ReorderQueue } from "./reorder-queue"

// The shared page container (max-width + padding) lives in the app layout
// (_app.tsx), so this renders content directly without an mx-auto max-w wrapper.
export function ReorderView() {
  return (
    <div className="@container flex w-full flex-col gap-6">
      <ReorderStatsHeader />
      <ReorderQueue />
    </div>
  )
}
