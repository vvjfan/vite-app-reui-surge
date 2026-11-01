import { createFileRoute } from "@tanstack/react-router"

import { InventoryHeader } from "@/features/inventory/components/inventory-header"
import { StockLedger } from "@/features/inventory/components/stock-ledger"

export const Route = createFileRoute("/_app/inventory/")({
  staticData: { crumb: "Stock ledger" },
  component: InventoryPage,
})

// Page header + ledger. The shared content frame (max width + padding) lives in
// _app.tsx, so this renders content directly without an mx-auto max-w wrapper.
function InventoryPage() {
  return (
    <div className="flex flex-col gap-4">
      <InventoryHeader />
      <StockLedger />
    </div>
  )
}
