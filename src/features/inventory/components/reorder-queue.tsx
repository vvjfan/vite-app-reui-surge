"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DataGrid } from "@/components/reui/data-grid/data-grid"
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table"
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useInventoryItems, type StockRow } from "../queries"
import { BulkActionBar } from "./reorder-bulk-action-bar"
import { useSuppliers } from "@/features/suppliers/queries"
import { useSupplierOptions } from "../hooks/use-filter-options"
import {
  getReorderSearchBlob,
  matchesUrgency,
  toReorderRows,
  TOAST_INFO_ICON,
  URGENCY_OPTIONS,
  type ReorderRow,
  type Urgency,
} from "./reorder-data"
import { createReorderColumns } from "./reorder-columns"
import { EditItemSheet } from "./edit-item-sheet"
import { ReorderDetailSheet } from "./reorder-detail-sheet"
import { CreatePurchaseOrderSheet } from "./create-po-sheet"
import type { PoLine } from "@/features/purchase-orders/queries"
import {
  FileArrowDownIcon as FileDownIcon,
  MagnifyingGlassIcon as SearchIcon,
} from "@phosphor-icons/react"

// A queue row already carries everything a PO line needs; the sheet only wants
// the buying fields, so drop the reorder maths on the way in.
function reorderRowToPoLine(row: ReorderRow): PoLine {
  return {
    productId: row.productId,
    sku: row.sku,
    name: row.name,
    thumbnail: row.thumbnail,
    quantity: row.suggestedPo,
    unitCost: row.unitCost,
    supplierId: row.supplierId,
    supplierName: row.supplier,
  }
}

export function ReorderQueue() {
  // Source of truth: the shared query cache (store-backed in the demo). The
  // queue is DERIVED from the same items the ledger reads - only the SKUs at or
  // below their reorder point - so no seed renders before the store settles.
  const query = useInventoryItems()
  const { data: suppliers = [] } = useSuppliers()
  // StockRow.onOrder is already netted at the query seam, so a SKU a raised PO
  // covers drops out of the queue (or asks for less) with nothing to thread.
  const rows = useMemo(
    () => toReorderRows(query.data ?? [], suppliers),
    [query.data, suppliers]
  )

  // Every supplier, from the entity rather than from the queue's rows: one with
  // nothing currently below its reorder point is still a legitimate thing to
  // filter by, and the answer (an empty queue) is the useful one.
  const supplierOptions = useSupplierOptions(suppliers)

  const [search, setSearch] = useState("")
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency>("all")
  const [supplierFilter, setSupplierFilter] = useState<string>("all")
  const [sorting, setSorting] = useState<SortingState>([
    { id: "deficit", desc: true },
  ])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 6,
  })

  const [activeRow, setActiveRow] = useState<ReorderRow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editItem, setEditItem] = useState<StockRow | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  // Non-null while the Create-PO sheet is open; holds the lines it drafts.
  const [poLines, setPoLines] = useState<PoLine[] | null>(null)

  const handleView = useCallback((row: ReorderRow) => {
    setActiveRow(row)
    setSheetOpen(true)
  }, [])

  // The queue renders derived rows; the edit sheet needs the item behind one, so
  // resolve it by id from the same query the rows came from.
  const handleEdit = useCallback(
    (row: ReorderRow) => {
      const item = (query.data ?? []).find((entry) => entry.id === row.id)
      if (!item) return
      setEditItem(item)
      setEditOpen(true)
    },
    [query.data]
  )

  const handleCreatePo = useCallback((row: ReorderRow) => {
    setPoLines([reorderRowToPoLine(row)])
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (!matchesUrgency(row, urgencyFilter)) return false
      if (supplierFilter !== "all" && row.supplierId !== supplierFilter)
        return false
      if (q && !getReorderSearchBlob(row).includes(q)) return false
      return true
    })
  }, [rows, search, urgencyFilter, supplierFilter])

  useEffect(() => {
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
    )
    setRowSelection({})
  }, [search, urgencyFilter, supplierFilter])

  const columns = useMemo(
    () =>
      createReorderColumns({
        onView: handleView,
        onCreatePo: handleCreatePo,
        onEdit: handleEdit,
      }),
    [handleView, handleCreatePo, handleEdit]
  )

  const table = useReactTable({
    data: filtered,
    columns,
    getRowId: (row) => row.id,
    state: { sorting, pagination, rowSelection },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const selectedRows = table.getSelectedRowModel().rows
  const selectedCount = selectedRows.length
  const suggestedTotal = selectedRows.reduce(
    (sum, r) => sum + r.original.suggestedPo,
    0
  )

  const handleClearSelection = useCallback(() => setRowSelection({}), [])

  const handleBulkCreatePo = useCallback(() => {
    if (selectedRows.length === 0) return
    setPoLines(selectedRows.map((r) => reorderRowToPoLine(r.original)))
  }, [selectedRows])

  const handleBulkExport = useCallback(() => {
    if (selectedCount === 0) return
    toast.info("Export ready", {
      description: `${selectedCount} reorder row${selectedCount === 1 ? "" : "s"} downloading as CSV. Demo only.`,
      icon: TOAST_INFO_ICON,
    })
  }, [selectedCount])

  // An empty queue has three causes and each calls for a different response, so
  // the message has to say which. The queue holds only the SKUs at or below
  // their reorder point, so `rows` being empty while stock exists is the genuine
  // all-clear; with no stock at all there is nothing to be above a reorder point
  // in the first place, and only the third case is answered by clearing filters.
  const emptyMessage =
    (query.data ?? []).length === 0
      ? "No stock yet. Create a product to start tracking reorder points."
      : rows.length === 0
        ? "Every SKU is above its reorder point."
        : "No SKUs match these filters. Clear the filters to review the full queue."

  return (
    <TooltipProvider delay={200}>
      <DataGrid
        table={table}
        recordCount={filtered.length}
        isLoading={query.isPending}
        loadingMode="skeleton"
        emptyMessage={
          !query.isPending && filtered.length === 0 ? emptyMessage : undefined
        }
        tableLayout={{ headerSticky: false, dense: false }}
      >
        <Frame dense className="w-full">
          <FrameHeader className="flex-row items-center justify-between gap-3">
            <div className="flex flex-col gap-px">
              <FrameTitle>Reorder queue</FrameTitle>
              {/* Counted only once the read settles: a pending query would
                  otherwise report an all-clear queue as fact. */}
              {query.isPending ? null : (
                <FrameDescription>
                  {filtered.length} SKU{filtered.length === 1 ? "" : "s"} below
                  reorder point
                </FrameDescription>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                toast.info("Export ready", {
                  description: "The full reorder queue is downloading as CSV.",
                  icon: TOAST_INFO_ICON,
                })
              }
            >
              <FileDownIcon className="size-4" aria-hidden="true" />
              Export
            </Button>
          </FrameHeader>

          <FramePanel className="p-0 shadow-none!">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-(--frame-panel-header-px) py-(--frame-panel-header-py)">
              <div className="flex flex-wrap items-center gap-2">
                <InputGroup className="w-full min-w-52 sm:w-[220px]">
                  <InputGroupAddon align="inline-start">
                    <SearchIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search SKU or product..."
                    aria-label="Search reorder queue"
                  />
                </InputGroup>

                <Select
                  value={urgencyFilter}
                  onValueChange={(value) => value && setUrgencyFilter(value)}
                  items={URGENCY_OPTIONS}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {URGENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Select
                  value={supplierFilter}
                  onValueChange={(value) => value && setSupplierFilter(value)}
                  items={supplierOptions}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {supplierOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {selectedCount > 0 ? (
              <>
                <BulkActionBar
                  selectedCount={selectedCount}
                  suggestedTotal={suggestedTotal}
                  onCreatePo={handleBulkCreatePo}
                  onExport={handleBulkExport}
                  onClear={handleClearSelection}
                />
                <Separator />
              </>
            ) : null}

            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>

            <Separator />

            <FrameFooter>
              <DataGridPagination />
            </FrameFooter>
          </FramePanel>
        </Frame>
      </DataGrid>

      <ReorderDetailSheet
        row={activeRow}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onCreatePo={handleCreatePo}
      />

      <EditItemSheet
        item={editItem}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <CreatePurchaseOrderSheet
        lines={poLines ?? []}
        open={poLines !== null}
        onOpenChange={(next) => {
          if (!next) setPoLines(null)
        }}
        onCreated={() => setRowSelection({})}
      />
    </TooltipProvider>
  )
}
