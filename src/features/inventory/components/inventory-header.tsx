import { PageHeader } from "@/components/shared/page-header"
import { useInventoryItems } from "../queries"

export function InventoryHeader() {
  // Same query as the grid: the count reflects the live store. Undefined until
  // the read settles, so the badge appears only once real (never a seed count).
  const { data: items } = useInventoryItems()
  const count = items?.length

  return (
    <PageHeader
      title="Inventory"
      count={count === undefined ? undefined : `${count} SKUs`}
    />
  )
}
