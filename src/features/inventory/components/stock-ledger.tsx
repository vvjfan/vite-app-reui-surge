import { InventoryMetricsRow } from "./inventory-metrics-row"
import { StatsHeader } from "./stats-header"
import { StockLedgerGrid } from "./stock-ledger-grid"

// The shared page container (max-width + padding) lives in the app layout
// (_app.tsx), so this renders content directly without an mx-auto max-w wrapper.
export function StockLedger() {
  return (
    <div className="@container flex w-full flex-col gap-6">
      <InventoryMetricsRow />
      <StatsHeader />
      <StockLedgerGrid />
    </div>
  )
}
