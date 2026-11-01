import { useCallback, useEffect, useRef, useState } from "react"
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
  type VisibilityState,
} from "@tanstack/react-table"
import { toast } from "sonner"

import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  planTransition,
  type OrderTransition,
} from "@/lib/data/order-lifecycle"
import type {
  FulfillmentStatus,
  Order,
  OrderStatus,
  PaymentStatus,
} from "@/lib/data/types"
import { bulkTransitionToast } from "../lib/lifecycle-copy"
import { ordersListQuery, useOrderTransition } from "../queries"
import {
  columns,
  FulfillmentBadge,
  PaymentBadge,
  StatusBadge,
} from "./orders-columns"
import {
  HashIcon,
  UserIcon,
  DotOutlineIcon as CircleDotIcon,
  CreditCardIcon,
  TruckIcon,
  FunnelIcon as FilterIcon,
  FunnelXIcon,
  PackageIcon as PackageCheckIcon,
  ProhibitIcon as BanIcon,
  DownloadSimpleIcon as DownloadIcon,
  XIcon,
} from "@phosphor-icons/react"

// ── Filter engine (generic; only field access + config are order-specific) ──

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

function filterFieldValue(order: Order, field: string): unknown {
  switch (field) {
    case "customer":
      return `${order.customer.name} ${order.customer.email}`
    case "number":
      return order.number
    case "status":
      return order.status
    case "payment":
      return order.payment
    case "fulfillment":
      return order.fulfillment
    case "total":
      return order.totals.total
    default:
      return undefined
  }
}

function applyFiltersToData(data: Order[], filters: Filter[]): Order[] {
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
        case "greater_than":
          return Number(fieldValue) > Number(values[0])
        case "less_than":
          return Number(fieldValue) < Number(values[0])
        case "greater_than_or_equal":
          return Number(fieldValue) >= Number(values[0])
        case "less_than_or_equal":
          return Number(fieldValue) <= Number(values[0])
        case "between":
          if (values.length >= 2) {
            const min = Number(values[0])
            const max = Number(values[1])
            return Number(fieldValue) >= min && Number(fieldValue) <= max
          }
          return true
        case "not_between":
          if (values.length >= 2) {
            const min = Number(values[0])
            const max = Number(values[1])
            return Number(fieldValue) < min || Number(fieldValue) > max
          }
          return true
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

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "cancelled", label: "Cancelled" },
]

const PAYMENT_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "refunded", label: "Refunded" },
]

const FULFILLMENT_OPTIONS: { value: FulfillmentStatus; label: string }[] = [
  { value: "unfulfilled", label: "Unfulfilled" },
  { value: "partial", label: "Partial" },
  { value: "fulfilled", label: "Fulfilled" },
]

function renderSelectedCount(values: unknown[]) {
  if (values.length === 0) return "Select..."
  if (values.length > 1) return `${values.length} selected`
  return null
}

const filterFields: FilterFieldConfig[] = [
  {
    key: "number",
    label: "Order",
    icon: <HashIcon className="size-3.5" aria-hidden />,
    type: "text",
    className: "w-44",
    placeholder: "Search #...",
  },
  {
    key: "customer",
    label: "Customer",
    icon: <UserIcon className="size-3.5" aria-hidden />,
    type: "text",
    className: "w-52",
    placeholder: "Name or email...",
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
      return <StatusBadge status={values[0] as OrderStatus} />
    },
  },
  {
    key: "payment",
    label: "Payment",
    icon: <CreditCardIcon className="size-3.5" aria-hidden />,
    type: "select",
    searchable: false,
    className: "w-[160px]",
    options: PAYMENT_OPTIONS,
    customValueRenderer: (values) => {
      const state = renderSelectedCount(values)
      if (state) return state
      return <PaymentBadge payment={values[0] as PaymentStatus} />
    },
  },
  {
    key: "fulfillment",
    label: "Fulfillment",
    icon: <TruckIcon className="size-3.5" aria-hidden />,
    type: "select",
    searchable: false,
    className: "w-[170px]",
    options: FULFILLMENT_OPTIONS,
    customValueRenderer: (values) => {
      const state = renderSelectedCount(values)
      if (state) return state
      return <FulfillmentBadge fulfillment={values[0] as FulfillmentStatus} />
    },
  },
]

/** Single default row, inactive until the user types (see getActiveFilters). */
function createDefaultOrderFilters(): Filter[] {
  return [createFilter("number", "contains", [""])]
}

const CUSTOMER_COLUMN_ID = "customer"
const CUSTOMER_COLUMN_DEFAULT_SIZE = 260

function getAutoCustomerColumnSize(
  containerWidth: number,
  columnVisibility: VisibilityState
) {
  const occupiedWidth = columns.reduce((total, column) => {
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
    Math.round(containerWidth - occupiedWidth)
  )
}

// ── Main component ──

export function OrdersDataGrid() {
  const navigate = useNavigate()
  const handleRowClick = useCallback(
    (order: Order) => {
      navigate({ to: "/orders/$orderId", params: { orderId: order.id } })
    },
    [navigate]
  )

  // Source of truth: the shared query cache (store-backed in the demo). Mutations
  // anywhere update this cache, so the grid stays in sync without prop drilling.
  // `isPending` is true until the client's first store read settles (no seed is
  // rendered before then); the grid shows skeleton rows during that window.
  const ordersQuery = useQuery(ordersListQuery())
  const orders = ordersQuery.data ?? []
  const transitionOrder = useOrderTransition()

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 8,
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: "order", desc: true },
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [filters, setFilters] = useState<Filter[]>(createDefaultOrderFilters)

  // ── Bulk actions ──
  // rowSelection is keyed by order id (getRowId returns row.id below), so its
  // keys are the selected order ids.
  const selectedIds = Object.keys(rowSelection)
  const selectedCount = selectedIds.length
  const clearSelection = useCallback(() => setRowSelection({}), [])

  /**
   * Run a verb across the selection, and report what it actually did.
   *
   * These used to map selectedIds straight to a patch literal without reading a
   * single order, then toast the selected COUNT as though every one had gone
   * through. Bulk fulfil would silently un-cancel a cancelled order and put its
   * total back into revenue; bulk cancel would strand a paid one.
   *
   * The plan is computed first, from the orders themselves, so the toast is true
   * at the moment it fires. Skipped rows stay selected: they are the ones that
   * still need a decision.
   */
  const runBulk = useCallback(
    (action: OrderTransition) => {
      const selected = orders.filter((order) => order.id in rowSelection)
      const plan = planTransition(selected, action)
      plan.applied.forEach(({ order }) => transitionOrder.run(order, action))

      const { tone, title, description } = bulkTransitionToast(action, plan)
      toast[tone](title, description ? { description } : undefined)

      setRowSelection(
        Object.fromEntries(plan.skipped.map(({ order }) => [order.id, true]))
      )
    },
    [orders, rowSelection, transitionOrder]
  )

  const bulkFulfill = useCallback(() => runBulk("fulfill"), [runBulk])
  const bulkCancel = useCallback(() => runBulk("cancel"), [runBulk])

  const bulkExport = useCallback(() => {
    toast.success(`Exporting ${selectedCount} orders`, {
      description: "Demo. Download from your storage.",
    })
  }, [selectedCount])

  const [isLoading, setIsLoading] = useState(false)
  const [filteredData, setFilteredData] = useState<Order[]>(orders)
  const [gridWidth, setGridWidth] = useState(0)
  const gridWidthRef = useRef<HTMLDivElement>(null)
  const hasManualColumnSizing = useRef(false)
  const lastAppliedActiveKey = useRef<string>(
    serializeActiveFiltersKey(getActiveFilters(createDefaultOrderFilters()))
  )

  // Latest filters, read by the data-sync effect below without making it a
  // dependency (so re-filtering fires on data changes, not on every keystroke).
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const applyFilters = useCallback(
    (newFilters: Filter[]) => applyFiltersToData(orders, newFilters),
    [orders]
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

  // Re-apply the active filters whenever the underlying data changes: a create,
  // edit, cancel, or delete elsewhere updates the shared query cache, and this
  // keeps the visible rows (and their badges) in sync. Also covers first paint.
  // Also prune the selection so the bulk bar never references a deleted order
  // (its id would otherwise linger and make a bulk action target a ghost row).
  useEffect(() => {
    setFilteredData(applyFiltersToData(orders, filtersRef.current))
    setRowSelection((prev) => {
      const ids = new Set(orders.map((o) => o.id))
      const next: RowSelectionState = {}
      let changed = false
      for (const id of Object.keys(prev)) {
        if (ids.has(id)) next[id] = prev[id]
        else changed = true
      }
      return changed ? next : prev
    })
  }, [orders])

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
    const nextWidth = getAutoCustomerColumnSize(gridWidth, columnVisibility)
    setColumnSizing((current) =>
      current[CUSTOMER_COLUMN_ID] === nextWidth
        ? current
        : { ...current, [CUSTOMER_COLUMN_ID]: nextWidth }
    )
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
  // so on the first store read it can lag one frame behind `orders`. Fall back to
  // a synchronous filter in that window so real rows show immediately instead of
  // a blank "no matches" frame. Re-filtering an already-empty result is also
  // empty, so a genuine no-match still renders the empty state correctly.
  const gridRows =
    !isLoading && filteredData.length === 0 && orders.length > 0
      ? applyFiltersToData(orders, filters)
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
  // message has to say which: a store with no orders in it, or filters that
  // exclude every order there is.
  const emptyMessage =
    orders.length === 0
      ? "No orders yet. Create one to start fulfilling."
      : "No orders match your filters."

  return (
    <TooltipProvider delay={200}>
      <DataGrid
        table={table}
        onRowClick={handleRowClick}
        isLoading={isLoading || ordersQuery.isPending}
        loadingMode="skeleton"
        recordCount={gridRows.length}
        emptyMessage={
          !isLoading && !ordersQuery.isPending && gridRows.length === 0
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
                    <Button variant="outline" onClick={bulkFulfill}>
                      <PackageCheckIcon aria-hidden />
                      Fulfill
                    </Button>
                    <Button variant="outline" onClick={bulkCancel}>
                      <BanIcon aria-hidden />
                      Cancel
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
                        const next = createDefaultOrderFilters()
                        lastAppliedActiveKey.current =
                          serializeActiveFiltersKey(getActiveFilters(next))
                        setFilters(next)
                        simulateAsyncFiltering(next)
                      }}
                      disabled={isLoading}
                    >
                      <FunnelXIcon className="size-3.5" aria-hidden />
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
