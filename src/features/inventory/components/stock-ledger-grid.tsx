"use client"

import { useCallback, useMemo, useState } from "react"
import { DataGrid } from "@/components/reui/data-grid/data-grid"
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table"
import { Frame, FrameFooter, FramePanel } from "@/components/reui/frame"
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
  InputGroupButton,
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
import type { StockStatus } from "@/lib/data/inventory"
import { locationById, locationName } from "@/lib/data/locations"
import { useLocations } from "@/features/locations/queries"
import { useSuppliers } from "@/features/suppliers/queries"
import { supplierById, supplierName } from "@/lib/data/suppliers"
import { useInventoryItems, type StockRow } from "../queries"
import {
  useInventoryCategoryOptions,
  useLocationOptions,
  useSupplierOptions,
} from "../hooks/use-filter-options"
import {
  getStockSearchBlob,
  STATUS_OPTIONS,
  TOAST_SUCCESS_ICON,
} from "./ledger-data"
import { USER } from "@/components/shared/app-shell/data"
import { AdjustStockSheet } from "./adjust-stock-sheet"
import { EditItemSheet } from "./edit-item-sheet"
import { createLedgerColumns } from "./ledger-columns"
import { LedgerSelectionBar } from "./ledger-selection-bar"
import { StockDetailSheet } from "./stock-detail-sheet"
import { TransferStockSheet } from "./transfer-stock-sheet"
import { CreatePurchaseOrderSheet } from "./create-po-sheet"
import type { PoLine } from "@/features/purchase-orders/queries"
import { suggestedOrderQuantity } from "@/lib/data/purchase-orders"
import { MagnifyingGlassIcon as SearchIcon, XIcon } from "@phosphor-icons/react"

// One filter dropdown, shared grammar for the four toolbar Selects.
function FilterSelect({
  value,
  onChange,
  options,
  width,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  width: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next ?? "all")}
      items={options}
    >
      <SelectTrigger className={width}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function StockLedgerGrid() {
  // Source of truth: the shared query cache (store-backed in the demo). No seed
  // renders before the first store read settles; the grid shows skeleton rows
  // during that window via `isLoading`.
  const query = useInventoryItems()
  const items = useMemo(() => query.data ?? [], [query.data])

  // Derived from the store, so a client's own suppliers/locations show up here
  // and the Categories module drives the category list.
  const categoryOptions = useInventoryCategoryOptions()
  const { data: suppliers = [] } = useSuppliers()
  const suppliersById = useMemo(() => supplierById(suppliers), [suppliers])
  const supplierOptions = useSupplierOptions(suppliers)
  // Rows reference a location by id; resolve names once for the cells, the
  // search blob, and the filter.
  const { data: locations = [] } = useLocations()
  const locationsById = useMemo(() => locationById(locations), [locations])
  const locationOptions = useLocationOptions(locations)

  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [supplierFilter, setSupplierFilter] = useState<string>("all")
  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<StockStatus | "all">("all")
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 8,
  })
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockRow | null>(null)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustItem, setAdjustItem] = useState<StockRow | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editItem, setEditItem] = useState<StockRow | null>(null)
  const [transferItem, setTransferItem] = useState<StockRow | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((row) => {
      if (categoryFilter !== "all" && row.category !== categoryFilter)
        return false
      if (supplierFilter !== "all" && row.supplierId !== supplierFilter)
        return false
      // A row matches a location if it stocks ANY of it there. Filtering on the
      // primary alone would hide a row that genuinely sits at the picked place,
      // just with more of it somewhere else.
      if (
        locationFilter !== "all" &&
        !row.levels.some((level) => level.locationId === locationFilter)
      )
        return false
      if (statusFilter !== "all" && row.status !== statusFilter) return false
      if (
        q &&
        !getStockSearchBlob(
          row,
          row.levels.map((level) => locationName(locations, level.locationId)),
          supplierName(suppliers, row.supplierId)
        ).includes(q)
      )
        return false
      return true
    })
  }, [
    items,
    locations,
    suppliers,
    search,
    categoryFilter,
    supplierFilter,
    locationFilter,
    statusFilter,
  ])

  const handleView = useCallback((item: StockRow) => {
    setSelectedItem(item)
    setDetailOpen(true)
  }, [])

  const handleAdjust = useCallback((item: StockRow) => {
    setAdjustItem(item)
    setAdjustOpen(true)
  }, [])

  const handleEdit = useCallback((item: StockRow) => {
    setEditItem(item)
    setEditOpen(true)
  }, [])

  const handleTransfer = useCallback((item: StockRow) => {
    setTransferItem(item)
    setTransferOpen(true)
  }, [])

  // Non-null while the Create-PO sheet is open, holding the lines it drafts.
  const [poLines, setPoLines] = useState<PoLine[] | null>(null)
  // Stable, so passing it into the columns useMemo below does not rebuild the
  // grid every render (react-table treats new columns as a full reset).
  const buildPoLine = useCallback(
    (row: StockRow): PoLine => ({
      productId: row.productId,
      sku: row.sku,
      name: row.name,
      thumbnail: row.thumbnail,
      quantity: suggestedOrderQuantity(row.reorderPoint, row.available),
      unitCost: row.unitCost,
      supplierId: row.supplierId,
      supplierName: supplierName(suppliers, row.supplierId),
    }),
    [suppliers]
  )
  // Row action: one SKU. Toolbar / bulk bar act on the current selection.
  const handleRowCreatePO = useCallback(
    (item: StockRow) => setPoLines([buildPoLine(item)]),
    [buildPoLine]
  )

  const columns = useMemo(
    () =>
      createLedgerColumns({
        onView: handleView,
        onAdjust: handleAdjust,
        onEdit: handleEdit,
        onTransfer: handleTransfer,
        onCreatePO: handleRowCreatePO,
        locationsById,
        suppliersById,
      }),
    [
      handleView,
      handleAdjust,
      handleEdit,
      handleTransfer,
      handleRowCreatePO,
      locationsById,
      suppliersById,
    ]
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

  const selectedItems = table
    .getSelectedRowModel()
    .rows.map((row) => row.original)
  const selectedCount = selectedItems.length

  const handleCreatePO = () => {
    if (selectedCount === 0) return
    setPoLines(selectedItems.map(buildPoLine))
  }

  const handleClearSelection = useCallback(() => {
    setRowSelection({})
  }, [])

  const runBulkAction = useCallback(
    (title: string, tail: string) => {
      if (selectedCount === 0) return
      setRowSelection({})
      toast.success(title, {
        description: `${selectedCount} SKU${selectedCount === 1 ? "" : "s"} ${tail}`,
        icon: TOAST_SUCCESS_ICON,
      })
    },
    [selectedCount]
  )

  const handleBulkAdjust = () =>
    runBulkAction("Adjustments queued", "sent to cycle count CNT-0096.")
  const handleBulkTransfer = () =>
    runBulkAction("Transfer drafted", "added to TRF-0349 to East DC.")

  const hasActiveFilters =
    search.trim().length > 0 ||
    categoryFilter !== "all" ||
    supplierFilter !== "all" ||
    locationFilter !== "all" ||
    statusFilter !== "all"

  const handleClearFilters = useCallback(() => {
    setSearch("")
    setCategoryFilter("all")
    setSupplierFilter("all")
    setLocationFilter("all")
    setStatusFilter("all")
  }, [])

  // An empty ledger has two causes that call for opposite responses, so the
  // message has to say which: nothing is stocked at all, or filters that exclude
  // every SKU there is. A SKU exists only as a variant of a product, so an empty
  // ledger is answered in the catalog rather than here.
  const emptyMessage =
    items.length === 0
      ? "No stock yet. Create a product to start tracking inventory."
      : "No SKUs match these filters. Clear filters or widen your search."

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
                    placeholder="Search SKUs..."
                    aria-label="Search SKUs"
                  />
                  {search ? (
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        aria-label="Clear search"
                        size="icon-xs"
                        onClick={() => setSearch("")}
                      >
                        <XIcon aria-hidden="true" />
                      </InputGroupButton>
                    </InputGroupAddon>
                  ) : null}
                </InputGroup>

                <FilterSelect
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={categoryOptions}
                  width="w-[140px]"
                />

                <FilterSelect
                  value={supplierFilter}
                  onChange={setSupplierFilter}
                  options={supplierOptions}
                  width="w-[160px]"
                />

                <FilterSelect
                  value={locationFilter}
                  onChange={setLocationFilter}
                  options={locationOptions}
                  width="w-[150px]"
                />

                <FilterSelect
                  value={statusFilter}
                  onChange={(value) =>
                    setStatusFilter(value as StockStatus | "all")
                  }
                  options={STATUS_OPTIONS}
                  width="w-[140px]"
                />

                {hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={handleClearFilters}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </div>
            </div>

            <Separator />

            {selectedCount > 0 ? (
              <>
                <LedgerSelectionBar
                  selectedCount={selectedCount}
                  onAdjust={handleBulkAdjust}
                  onTransfer={handleBulkTransfer}
                  onCreatePO={handleCreatePO}
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

      <StockDetailSheet
        item={selectedItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <AdjustStockSheet
        item={adjustItem}
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
      />

      <EditItemSheet
        item={editItem}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <TransferStockSheet
        item={transferItem}
        open={transferOpen}
        onOpenChange={setTransferOpen}
        author={USER}
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
