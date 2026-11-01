import { createFileRoute } from "@tanstack/react-router"

import { PromotionsGrid } from "@/features/promotions/components/promotions-grid"
import { PromotionsHeader } from "@/features/promotions/components/promotions-header"

export const Route = createFileRoute("/_app/promotions/")({
  component: PromotionsListPage,
})

// Page header + grid. The shared content frame (max width + padding) lives in
// _app.tsx, so this renders content directly without an mx-auto max-w wrapper.
function PromotionsListPage() {
  return (
    <div className="flex flex-col gap-4">
      <PromotionsHeader />
      <PromotionsGrid />
    </div>
  )
}
