import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { DataGrid } from "@/components/reui/data-grid/data-grid"
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table"
import {
  createFilter,
  Filters,
  type Filter,
  type FilterFieldConfig,
} from "@/components/reui/filters"
import { Frame, FrameFooter, FramePanel } from "@/components/reui/frame"
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnSizingState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table"
import { toast } from "sonner"

import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Product, ProductStatus } from "@/lib/data/products"
import { productsListQuery, useUpdateProduct } from "../queries"
import {
  useProductCategoryOptions,
  useProductCategoryIdByName,
} from "../hooks/use-category-options"
import {
  createProductColumns,
  stockByProduct,
  StatusBadge,
  type ProductsTableMeta,
} from "./products-columns"
import { useInventoryItems } from "@/features/inventory/queries"
import {
  TagIcon,
  FolderIcon,
  DotOutlineIcon as CircleDotIcon,
  CheckCircleIcon as CircleCheckIcon,
  ArchiveIcon,
  DownloadSimpleIcon as DownloadIcon,
  FunnelIcon as FilterIcon,
  FunnelXIcon,
  XIcon,
} from "@phosphor-icons/react"

// ── Filter engine (generic; only field access + config are product-specific) ──

function getActiveFilters(filters: Filter[]) {
  return filters.filter((filter) => {
    const { values } = filter
    if (values.length === 0) return false
    if (
      values.every((value) => typeof value === "string" && value.trim() === "")
    )
      return false
    if (values.every((value) => value === null || value === undefined))
      return false
    if (values.every((value) => Array.isArray(value) && value.length === 0))
      return false
    return true
  })
}

function serializeActiveFiltersKey(active: Filter[]) {
  return JSON.stringify(
    active.map((f) => ({
      field: f.field,
      operator: f.operator,
      values: f.values,
    }))
  )
}

function filterFieldValue(product: Product, field: string): unknown {
  switch (field) {
    case "title":
      return `${product.title} ${product.vendor}`
    case "category":
      return product.category
    case "status":
      return product.status
    default:
      return undefined
  }
}

function applyFiltersToData(data: Product[], filters: Filter[]): Product[] {
  const active = getActiveFilters(filters)
  let result = [...data]
  active.forEach((filter) => {
    const { field, operator, values } = filter
    result = result.filter((item) => {
      const raw = filterFieldValue(item, field)
      const fieldValue = raw != null ? raw : ""

      switch (operator) {
        case "is":
          return values.includes(fieldValue)
        case "is_not":
          return !values.includes(fieldValue)
        case "is_any_of":
          return values.some((v) => fieldValue === v)
        case "is_not_any_of":
          return !values.some((v) => fieldValue === v)
        case "contains": {
          const tokens = values.map((v) => String(v).trim()).filter(Boolean)
          if (tokens.length === 0) return true
          return tokens.some((token) =>
            String(fieldValue).toLowerCase().includes(token.toLowerCase())
          )
        }
        case "not_contains":
          return !values.some((v) =>
            String(fieldValue).toLowerCase().includes(String(v).toLowerCase())
          )
        case "starts_with":
          return values.some((v) =>
            String(fieldValue).toLowerCase().startsWith(String(v).toLowerCase())
          )
        case "ends_with":
          return values.some((v) =>
            String(fieldValue).toLowerCase().endsWith(String(v).toLowerCase())
          )
        case "equals":
          return fieldValue === values[0]
        case "not_equals":
          return fieldValue !== values[0]
        case "empty":
          return fieldValue === ""
        case "not_empty":
          return fieldValue !== ""
        default:
          return true
      }
    })
  })
  return result
}

// ── Filter field config ──

const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
]

function renderSelectedCount(values: unknown[]) {
  if (values.length === 0) return "Select..."
  if (values.length > 1) return `${values.length} selected`
  return null
}

// Category options are sourced from the Categories entity (passed in), so the
// catalog filter stays in sync with the Categories module.
function buildFilterFields(
  categoryOptions: { value: string; label: string }[]
): FilterFieldConfig[] {
  return [
    {
      key: "title",
      label: "Product",
      icon: <TagIcon className="size-3.5" aria-hidden />,
      type: "text",
      className: "w-52",
      placeholder: "Name or vendor...",
    },
    {
      key: "category",
      label: "Category",
      icon: <FolderIcon className="size-3.5" aria-hidden />,
      type: "select",
      searchable: true,
      className: "w-[180px]",
      options: categoryOptions,
      customValueRenderer: (values) => {
        const state = renderSelectedCount(values)
        if (state) return state
        return String(values[0])
      },
    },
    {
      key: "status",
      label: "Status",
      icon: <CircleDotIcon className="size-3.5" aria-hidden />,
      type: "select",
      searchable: false,
      className: "w-[160px]",
      options: STATUS_OPTIONS,
      customValueRenderer: (values) => {
        const state = renderSelectedCount(values)
        if (state) return state
        return <StatusBadge status={values[0] as ProductStatus} />
      },
    },
  ]
}

function createDefaultProductFilters(): Filter[] {
  return [createFilter("title", "contains", [""])]
}

const PRODUCT_COLUMN_ID = "product"
const PRODUCT_COLUMN_DEFAULT_SIZE = 280
// Wider than this the product cell is all dead air between the name and the
// next column, so the surplus goes to the data columns instead.
const PRODUCT_COLUMN_MAX_SIZE = 380
const FLEX_COLUMN_IDS = ["category", "inventory", "price", "status"]

/**
 * Size the columns to fill the container exactly: the product column grows
 * first (to its cap), and whatever width is still left is split across the
 * data columns. Filling the container matters as much as the shares - a
 * shortfall makes the browser stretch every fixed column proportionally,
 * checkbox included.
 */
function getAutoColumnSizes(
  columns: ColumnDef<Product>[],
  containerWidth: number,
  columnVisibility: VisibilityState
): ColumnSizingState {
  const isVisible = (id: string) => columnVisibility[id] !== false
  const sizeOf = (id: string) => {
    const column = columns.find((c) => c.id === id)
    return typeof column?.size === "number" ? column.size : 0
  }
  const occupiedWidth = columns.reduce((total, column) => {
    if (
      !column.id ||
      column.id === PRODUCT_COLUMN_ID ||
      !isVisible(column.id)
    ) {
      return total
    }
    return total + (typeof column.size === "number" ? column.size : 0)
  }, 0)

  const productWidth = Math.min(
    PRODUCT_COLUMN_MAX_SIZE,
    Math.max(
      PRODUCT_COLUMN_DEFAULT_SIZE,
      Math.round(containerWidth - occupiedWidth)
    )
  )
  const sizing: ColumnSizingState = { [PRODUCT_COLUMN_ID]: productWidth }

  const flexIds = FLEX_COLUMN_IDS.filter(isVisible)
  const leftover = Math.max(
    0,
    Math.round(containerWidth - occupiedWidth - productWidth)
  )
  const bump = flexIds.length > 0 ? Math.floor(leftover / flexIds.length) : 0
  for (const id of flexIds) sizing[id] = sizeOf(id) + bump

  return sizing
}

// ── Main component ──

export function ProductsDataGrid() {
  const navigate = useNavigate()
  const handleRowClick = useCallback(
    (product: Product) => {
      navigate({
        to: "/products/$productId",
        params: { productId: product.id },
      })
    },
    [navigate]
  )

  // Source of truth: the shared query cache (store-backed in the demo). Mutations
  // anywhere update this cache, so the grid stays in sync without prop drilling.
  // `isPending` is true until the client's first store read settles (no seed is
  // rendered before then); the grid shows skeleton rows during that window.
  const productsQuery = useQuery(productsListQuery())
  const products = productsQuery.data ?? []
  const updateProduct = useUpdateProduct()

  // Category filter options track the Categories entity (store-backed).
  const categoryOptions = useProductCategoryOptions()
  const filterFields = useMemo(
    () => buildFilterFields(categoryOptions),
    [categoryOptions]
  )

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 8,
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: "product", desc: false },
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [filters, setFilters] = useState<Filter[]>(createDefaultProductFilters)

  // rowSelection is keyed by product id (getRowId returns row.id below).
  const selectedIds = Object.keys(rowSelection)
  const selectedCount = selectedIds.length
  const clearSelection = useCallback(() => setRowSelection({}), [])

  const bulkPublish = useCallback(() => {
    selectedIds.forEach((id) =>
      updateProduct.mutate({ id, patch: { status: "active" } })
    )
    toast.success(`${selectedCount} products published`)
    clearSelection()
  }, [selectedIds, selectedCount, updateProduct, clearSelection])

  const bulkArchive = useCallback(() => {
    selectedIds.forEach((id) =>
      updateProduct.mutate({ id, patch: { status: "draft" } })
    )
    toast.message(`${selectedCount} products set to draft`)
    clearSelection()
  }, [selectedIds, selectedCount, updateProduct, clearSelection])

  const bulkExport = useCallback(() => {
    toast.success(`Exporting ${selectedCount} products`, {
      description: "Demo. Download from your storage.",
    })
  }, [selectedCount])

  const [isLoading, setIsLoading] = useState(false)
  const [filteredData, setFilteredData] = useState<Product[]>(products)
  const [gridWidth, setGridWidth] = useState(0)
  const gridWidthRef = useRef<HTMLDivElement>(null)
  const hasManualColumnSizing = useRef(false)
  const lastAppliedActiveKey = useRef<string>(
    serializeActiveFiltersKey(getActiveFilters(createDefaultProductFilters()))
  )

  // Latest filters, read by the data-sync effect below without making it a
  // dependency (so re-filtering fires on data changes, not on every keystroke).
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const applyFilters = useCallback(
    (newFilters: Filter[]) => applyFiltersToData(products, newFilters),
    [products]
  )

  const simulateAsyncFiltering = useCallback(
    async (newFilters: Filter[]) => {
      setIsLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 400))
      setFilteredData(applyFilters(newFilters))
      setIsLoading(false)
    },
    [applyFilters]
  )

  const handleFiltersChange = useCallback(
    (newFilters: Filter[]) => {
      setFilters(newFilters)
      const newActive = getActiveFilters(newFilters)
      const nextKey = serializeActiveFiltersKey(newActive)
      if (nextKey === lastAppliedActiveKey.current) return
      lastAppliedActiveKey.current = nextKey
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
      simulateAsyncFiltering(newFilters)
    },
    [simulateAsyncFiltering]
  )

  // The ledger holds one row per variant sku; a product's stock is the sum of
  // its rows. Read once here rather than in each cell, because the Inventory
  // column has to SORT on that total and an accessor cannot read a query.
  const inventoryQuery = useInventoryItems()
  const stockTotals = useMemo(
    () => stockByProduct(inventoryQuery.data),
    [inventoryQuery.data]
  )
  // Resolves each product's category name to the category id so the Category
  // column can link through to that category's detail page. Passed to the table
  // through meta (below) rather than closed over the columns, so the column list
  // stays stable while the Categories query settles.
  const categoryIdByName = useProductCategoryIdByName()
  const columns = useMemo(
    () => createProductColumns(stockTotals),
    [stockTotals]
  )
  const tableMeta = useMemo<ProductsTableMeta>(
    () => ({ categoryIdByName }),
    [categoryIdByName]
  )

  // Re-apply the active filters whenever the underlying data changes (a create,
  // edit, publish, or delete updates the shared query cache), and prune the
  // selection so the bulk bar never references a product that no longer exists.
  useEffect(() => {
    setFilteredData(applyFiltersToData(products, filtersRef.current))
    setRowSelection((prev) => {
      const ids = new Set(products.map((p) => p.id))
      const next: RowSelectionState = {}
      let changed = false
      for (const id of Object.keys(prev)) {
        if (ids.has(id)) next[id] = prev[id]
        else changed = true
      }
      return changed ? next : prev
    })
  }, [products])

  useEffect(() => {
    const element = gridWidthRef.current
    if (!element) return

    const syncGridWidth = () => setGridWidth(element.clientWidth)
    syncGridWidth()

    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(syncGridWidth)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (gridWidth <= 0 || hasManualColumnSizing.current) return
    const next = getAutoColumnSizes(columns, gridWidth, columnVisibility)
    setColumnSizing((current) => {
      const unchanged = Object.entries(next).every(
        ([id, width]) => current[id] === width
      )
      return unchanged ? current : { ...current, ...next }
    })
  }, [columnVisibility, gridWidth])

  const [columnOrder, setColumnOrder] = useState<string[]>(
    columns.map((c) => c.id as string)
  )

  const handleColumnSizingChange = useCallback(
    (
      updater:
        ColumnSizingState | ((old: ColumnSizingState) => ColumnSizingState)
    ) => {
      hasManualColumnSizing.current = true
      setColumnSizing(updater)
    },
    []
  )

  // `filteredData` is stateful (it powers the simulated async filtering delay),
  // so on the first store read it can lag one frame behind `products`. Fall back
  // to a synchronous filter in that window so real rows show immediately instead
  // of a blank "no matches" frame. Re-filtering an already-empty result is also
  // empty, so a genuine no-match still renders the empty state correctly.
  const gridRows =
    !isLoading && filteredData.length === 0 && products.length > 0
      ? applyFiltersToData(products, filters)
      : filteredData

  const table = useReactTable({
    columns,
    data: gridRows,
    meta: tableMeta,
    pageCount: Math.ceil(gridRows.length / pagination.pageSize),
    getRowId: (row) => row.id,
    state: {
      pagination,
      sorting,
      columnOrder,
      columnSizing,
      columnVisibility,
      rowSelection,
    },
    columnResizeMode: "onChange",
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: handleColumnSizingChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const showClearButton = filters.length > 0

  // An empty grid has two causes that call for opposite responses, so the
  // message has to say which: a catalog with nothing in it, or filters that
  // exclude every product there is.
  const emptyMessage =
    products.length === 0
      ? "No products yet. Create one to start selling."
      : "No products match your filters."

  return (
    <TooltipProvider delay={200}>
      <DataGrid
        table={table}
        onRowClick={handleRowClick}
        isLoading={isLoading || productsQuery.isPending}
        loadingMode="skeleton"
        recordCount={gridRows.length}
        emptyMessage={
          !isLoading && !productsQuery.isPending && gridRows.length === 0
            ? emptyMessage
            : undefined
        }
        tableLayout={{
          columnsPinnable: true,
          columnsResizable: true,
          columnsMovable: true,
          columnsVisibility: true,
          dense: true,
        }}
      >
        <Frame dense className="w-full">
          <FramePanel className="p-0! shadow-none!">
            <div className="flex flex-wrap items-center justify-between gap-2 px-(--frame-panel-header-px) py-(--frame-panel-header-py)">
              {selectedCount > 0 ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {selectedCount} selected
                    </span>
                    <Button variant="outline" onClick={bulkPublish}>
                      <CircleCheckIcon aria-hidden />
                      Publish
                    </Button>
                    <Button variant="outline" onClick={bulkArchive}>
                      <ArchiveIcon aria-hidden />
                      Set draft
                    </Button>
                    <Button variant="outline" onClick={bulkExport}>
                      <DownloadIcon aria-hidden />
                      Export
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0"
                    onClick={clearSelection}
                  >
                    <XIcon aria-hidden />
                    Clear
                  </Button>
                </>
              ) : (
                <>
                  <Filters
                    filters={filters}
                    fields={filterFields}
                    onChange={handleFiltersChange}
                    trigger={
                      <Button variant="outline" aria-label="Filters">
                        <FilterIcon aria-hidden />
                        Filters
                      </Button>
                    }
                  />
                  {showClearButton && (
                    <Button
                      variant="outline"
                      className="shrink-0"
                      onClick={() => {
                        const next = createDefaultProductFilters()
                        lastAppliedActiveKey.current =
                          serializeActiveFiltersKey(getActiveFilters(next))
                        setFilters(next)
                        simulateAsyncFiltering(next)
                      }}
                      disabled={isLoading}
                    >
                      <FunnelXIcon aria-hidden />
                      Clear
                    </Button>
                  )}
                </>
              )}
            </div>
            <Separator />
            <div ref={gridWidthRef} className="w-full">
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
            </div>
          </FramePanel>
          <FrameFooter>
            <DataGridPagination />
          </FrameFooter>
        </Frame>
      </DataGrid>
    </TooltipProvider>
  )
}
