import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
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
  type VisibilityState,
} from "@tanstack/react-table"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ordersListQuery } from "@/features/orders/queries"
import type { CustomerGroup } from "@/lib/data/types"
import {
  buildCustomerRows,
  customerGroupsListQuery,
  customersListQuery,
  useDeleteCustomer,
  type CustomerRow,
} from "../queries"
import { createCustomerColumns } from "./customers-columns"
import {
  UserIcon,
  DotOutlineIcon as CircleDotIcon,
  UsersIcon,
  BagIcon as ShoppingBagIcon,
  FunnelIcon as FilterIcon,
  FunnelXIcon,
  DownloadSimpleIcon as DownloadIcon,
  TrashIcon as Trash2Icon,
  XIcon,
} from "@phosphor-icons/react"

// ── Filter engine (generic; group is matched against the groups array) ──

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

function filterFieldValue(customer: CustomerRow, field: string): unknown {
  switch (field) {
    case "search":
      return `${customer.name} ${customer.email} ${customer.company ?? ""}`
    case "status":
      return customer.hasAccount ? "registered" : "guest"
    case "hasOrders":
      return customer.ordersCount > 0 ? "yes" : "no"
    default:
      return undefined
  }
}

function applyFiltersToData(
  data: CustomerRow[],
  filters: Filter[]
): CustomerRow[] {
  const active = getActiveFilters(filters)
  let result = [...data]
  active.forEach((filter) => {
    const { field, operator, values } = filter
    result = result.filter((item) => {
      // Group membership is an array intersection, not a scalar compare.
      if (field === "group") {
        return values.some((v) => item.groups.includes(String(v)))
      }
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

const STATUS_OPTIONS = [
  { value: "registered", label: "Registered" },
  { value: "guest", label: "Guest" },
]

const HAS_ORDERS_OPTIONS = [
  { value: "yes", label: "Has orders" },
  { value: "no", label: "No orders" },
]

function renderSelectedCount(values: unknown[]) {
  if (values.length === 0) return "Select..."
  if (values.length > 1) return `${values.length} selected`
  return null
}

function buildFilterFields(groups: CustomerGroup[]): FilterFieldConfig[] {
  return [
    {
      key: "search",
      label: "Search",
      icon: <UserIcon className="size-3.5" aria-hidden />,
      type: "text",
      className: "w-56",
      placeholder: "Name, email, company...",
    },
    {
      key: "status",
      label: "Status",
      icon: <CircleDotIcon className="size-3.5" aria-hidden />,
      type: "select",
      searchable: false,
      className: "w-[160px]",
      options: STATUS_OPTIONS,
      customValueRenderer: (values) =>
        renderSelectedCount(values) ??
        (values[0] === "registered" ? "Registered" : "Guest"),
    },
    {
      key: "group",
      label: "Group",
      icon: <UsersIcon className="size-3.5" aria-hidden />,
      type: "select",
      searchable: true,
      className: "w-[180px]",
      options: groups.map((g) => ({ value: g.id, label: g.name })),
      customValueRenderer: (values) =>
        renderSelectedCount(values) ??
        groups.find((g) => g.id === values[0])?.name ??
        String(values[0]),
    },
    {
      key: "hasOrders",
      label: "Orders",
      icon: <ShoppingBagIcon className="size-3.5" aria-hidden />,
      type: "select",
      searchable: false,
      className: "w-[150px]",
      options: HAS_ORDERS_OPTIONS,
      customValueRenderer: (values) =>
        renderSelectedCount(values) ??
        (values[0] === "yes" ? "Has orders" : "No orders"),
    },
  ]
}

function createDefaultCustomerFilters(): Filter[] {
  return [createFilter("search", "contains", [""])]
}

const CUSTOMER_COLUMN_ID = "customer"
const CUSTOMER_COLUMN_DEFAULT_SIZE = 260

function getAutoCustomerColumnSize(
  columns: ReturnType<typeof createCustomerColumns>,
  containerWidth: number,
  columnVisibility: VisibilityState
) {
  const occupied = columns.reduce((total, column) => {
    if (
      !column.id ||
      column.id === CUSTOMER_COLUMN_ID ||
      columnVisibility[column.id] === false
    ) {
      return total
    }
    return total + (typeof column.size === "number" ? column.size : 0)
  }, 0)
  return Math.max(
    CUSTOMER_COLUMN_DEFAULT_SIZE,
    Math.round(containerWidth - occupied)
  )
}

// ── Main component ──

export function CustomersDataGrid() {
  const navigate = useNavigate()
  const handleRowClick = useCallback(
    (customer: CustomerRow) => {
      navigate({ to: "/customers/$handle", params: { handle: customer.id } })
    },
    [navigate]
  )

  const customersQuery = useQuery(customersListQuery())
  const ordersQuery = useQuery(ordersListQuery())
  const groupsQuery = useQuery(customerGroupsListQuery())
  const isPending = customersQuery.isPending || ordersQuery.isPending

  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data])
  const groupsById = useMemo(
    () => new Map(groups.map((g) => [g.id, g])),
    [groups]
  )
  const rows = useMemo(
    () => buildCustomerRows(customersQuery.data ?? [], ordersQuery.data ?? []),
    [customersQuery.data, ordersQuery.data]
  )
  const columns = useMemo(() => createCustomerColumns(groupsById), [groupsById])
  const filterFields = useMemo(() => buildFilterFields(groups), [groups])
  const deleteCustomer = useDeleteCustomer()

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: "signedUp", desc: true },
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [filters, setFilters] = useState<Filter[]>(createDefaultCustomerFilters)

  const selectedIds = Object.keys(rowSelection)
  const selectedCount = selectedIds.length
  const clearSelection = useCallback(() => setRowSelection({}), [])

  const bulkDelete = useCallback(() => {
    selectedIds.forEach((id) => deleteCustomer.mutate(id))
    toast.success(`${selectedCount} customers deleted`)
    clearSelection()
  }, [selectedIds, selectedCount, deleteCustomer, clearSelection])

  const bulkExport = useCallback(() => {
    toast.success(`Exporting ${selectedCount} customers`, {
      description: "Demo. Download from your storage.",
    })
  }, [selectedCount])

  const [isLoading, setIsLoading] = useState(false)
  const [filteredData, setFilteredData] = useState<CustomerRow[]>([])
  const [gridWidth, setGridWidth] = useState(0)
  const gridWidthRef = useRef<HTMLDivElement>(null)
  const hasManualColumnSizing = useRef(false)
  const lastAppliedActiveKey = useRef<string>(
    serializeActiveFiltersKey(getActiveFilters(createDefaultCustomerFilters()))
  )

  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const applyFilters = useCallback(
    (newFilters: Filter[]) => applyFiltersToData(rows, newFilters),
    [rows]
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
      const nextKey = serializeActiveFiltersKey(getActiveFilters(newFilters))
      if (nextKey === lastAppliedActiveKey.current) return
      lastAppliedActiveKey.current = nextKey
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
      simulateAsyncFiltering(newFilters)
    },
    [simulateAsyncFiltering]
  )

  // Re-filter + prune selection whenever the underlying rows change.
  useEffect(() => {
    setFilteredData(applyFiltersToData(rows, filtersRef.current))
    setRowSelection((prev) => {
      const ids = new Set(rows.map((r) => r.id))
      const next: RowSelectionState = {}
      let changed = false
      for (const id of Object.keys(prev)) {
        if (ids.has(id)) next[id] = prev[id]
        else changed = true
      }
      return changed ? next : prev
    })
  }, [rows])

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
    const nextWidth = getAutoCustomerColumnSize(
      columns,
      gridWidth,
      columnVisibility
    )
    setColumnSizing((current) =>
      current[CUSTOMER_COLUMN_ID] === nextWidth
        ? current
        : { ...current, [CUSTOMER_COLUMN_ID]: nextWidth }
    )
  }, [columns, columnVisibility, gridWidth])

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

  const gridRows =
    !isLoading && filteredData.length === 0 && rows.length > 0
      ? applyFiltersToData(rows, filters)
      : filteredData

  const table = useReactTable({
    columns,
    data: gridRows,
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
  // message has to say which: a store with no customers in it, or filters that
  // exclude every customer there is.
  const emptyMessage =
    rows.length === 0
      ? "No customers yet. Create one to start taking orders."
      : "No customers match your filters."

  return (
    <TooltipProvider delay={200}>
      <DataGrid
        table={table}
        onRowClick={handleRowClick}
        isLoading={isLoading || isPending}
        loadingMode="skeleton"
        recordCount={gridRows.length}
        emptyMessage={
          !isLoading && !isPending && gridRows.length === 0
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
                    <Button variant="outline" onClick={bulkExport}>
                      <DownloadIcon aria-hidden />
                      Export
                    </Button>
                    <Button variant="outline" onClick={bulkDelete}>
                      <Trash2Icon aria-hidden />
                      Delete
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
                        const next = createDefaultCustomerFilters()
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
