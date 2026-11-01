import { DataGrid } from "@/components/reui/data-grid/data-grid"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"

import type { Product } from "@/lib/data/products"
import type { OrderDraftLineErrors } from "../order-draft"
import {
  createOrderLineColumns,
  type OrderLineRow,
} from "./order-line-items-columns"

export type { OrderLineRow }

export function OrderLineItems({
  rows,
  products,
  lineErrors,
  isLoading,
  onProductChange,
  onVariantChange,
  onQtyChange,
  onRemoveLine,
}: {
  rows: OrderLineRow[]
  products: Product[]
  lineErrors?: Record<number, OrderDraftLineErrors>
  isLoading?: boolean
  onProductChange: (index: number, productId: string) => void
  onVariantChange: (index: number, variantId: string) => void
  onQtyChange: (index: number, qty: string) => void
  onRemoveLine: (index: number) => void
}) {
  // Rebuilt each render on purpose: every editable cell closes over the draft's
  // change handlers, which the editor re-creates on each keystroke. Memoizing
  // here would never hit.
  const columns = createOrderLineColumns({
    products,
    lineErrors,
    rowCount: rows.length,
    onProductChange,
    onVariantChange,
    onQtyChange,
    onRemoveLine,
  })

  const table = useReactTable({
    columns,
    data: rows,
    // Index is the only identity a draft line has: the id does not exist until
    // toOrderPayload builds one.
    getRowId: (_row, index) => String(index),
    getCoreRowModel: getCoreRowModel(),
    state: {
      // A draft is never paginated (no getPaginationRowModel, so every line
      // renders). pageSize is set only because it is what the skeleton counts
      // rows by: sized to the draft, the loading state is the shape of the form
      // rather than ten rows the operator does not have.
      pagination: { pageIndex: 0, pageSize: Math.max(rows.length, 1) },
    },
  })

  return (
    <DataGrid
      table={table}
      recordCount={rows.length}
      isLoading={isLoading}
      loadingMode="skeleton"
      tableLayout={{ dense: true, width: "fixed" }}
    >
      <DataGridScrollArea>
        <DataGridTable />
      </DataGridScrollArea>
    </DataGrid>
  )
}
