import { createFileRoute } from "@tanstack/react-router"

import { PromotionEditor } from "@/features/promotions/components/promotion-editor"

// Static route: takes precedence over `$promotionId`, so /promotions/new is the
// create editor, not a promotion with id "new".
export const Route = createFileRoute("/_app/promotions/new")({
  staticData: { crumb: "New promotion" },
  component: () => <PromotionEditor mode="create" />,
})
