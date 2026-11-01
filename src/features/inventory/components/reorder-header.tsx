import { PageHeader } from "@/components/shared/page-header"
import { useInventoryItems } from "../queries"
import { deriveReorderStats } from "./reorder-data"

export function ReorderHeader() {
  // Same query as the queue: the count reflects the DERIVED reorder queue (the
  // SKUs still short after open POs are netted, via StockRow.onOrder), not the
  // full item list. Undefined until the store read settles, so the badge appears
  // only once real.
  const { data: items } = useInventoryItems()
  const count = items ? deriveReorderStats(items).belowReorder : undefined

  return (
    <PageHeader
      title="Reorder queue"
      count={count === undefined ? undefined : `${count} SKUs`}
    />
  )
}
