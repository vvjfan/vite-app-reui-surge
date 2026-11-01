import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

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
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ordersListQuery } from "@/features/orders/queries"
import {
  customerAggregates,
  customerGroupsListQuery,
  customersListQuery,
  useDeleteGroup,
} from "../queries"
import { groupsColumns, type GroupRow } from "./groups-columns"
import {
  FunnelIcon as FilterIcon,
  FunnelXIcon,
  TrashIcon as Trash2Icon,
  UsersIcon,
  XIcon,
} from "@phosphor-icons/react"

// ── Filter engine (mirrors the customers grid; one searchable text field) ──

function getActiveFilters(filters: Filter[]) {
  return filters.filter((filter) => {
    const { values } = filter
    if (values.length === 0) return false
    if (
      values.every((value) => typeof value === "string" && value.trim() === "")
    )
      return false
    return !values.every((value) => value === null || value === undefined)
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

function applyFiltersToData(data: GroupRow[], filters: Filter[]): GroupRow[] {
  const active = getActiveFilters(filters)
  let result = [...data]
  active.forEach((filter) => {
    const { field, operator, values } = filter
    if (field !== "search") return
    const haystack = (row: GroupRow) =>
      `${row.group.name} ${row.group.description ?? ""}`.toLowerCase()
    result = result.filter((row) => {
      const tokens = values.map((v) => String(v).trim()).filter(Boolean)
      if (tokens.length === 0) return true
      const matches = tokens.some((token) =>
        haystack(row).includes(token.toLowerCase())
      )
      return operator === "not_contains" ? !matches : matches
    })
  })
  return result
}

const FILTER_FIELDS: FilterFieldConfig[] = [
  {
    key: "search",
    label: "Search",
    icon: <UsersIcon className="size-3.5" aria-hidden />,
    type: "text",
    className: "w-56",
    placeholder: "Name, description...",
  },
]

function createDefaultGroupFilters(): Filter[] {
  return [createFilter("search", "contains", [""])]
}

// ── The group column stretches to fill what the fixed columns leave ──

const GROUP_COLUMN_ID = "group"
const GROUP_COLUMN_DEFAULT_SIZE = 260

function getAutoGroupColumnSize(
  containerWidth: number,
  columnVisibility: VisibilityState
) {
  const occupied = groupsColumns.reduce((total, column) => {
    if (
      !column.id ||
      column.id === GROUP_COLUMN_ID ||
      columnVisibility[column.id] === false
    ) {
      return total
    }
    return total + (typeof column.size === "number" ? column.size : 0)
  }, 0)
  return Math.max(
    GROUP_COLUMN_DEFAULT_SIZE,
    Math.round(containerWidth - occupied)
  )
}

// ── Main component ──

export function GroupsDataGrid() {
  const navigate = useNavigate()
  const groupsQuery = useQuery(customerGroupsListQuery())
  const customersQuery = useQuery(customersListQuery())
  const ordersQuery = useQuery(ordersListQuery())
  const deleteGroup = useDeleteGroup()

  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data])
  const customers = useMemo(
    () => customersQuery.data ?? [],
    [customersQuery.data]
  )
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data])

  // Every figure derives at read time from the customers and orders reads,
  // the same joins the customers page makes per customer.
  const rows = useMemo<GroupRow[]>(
    () =>
      groups.map((group) => {
        const members = customers.filter((customer) =>
          customer.groups.includes(group.id)
        )
        let ordersCount = 0
        let totalSpent = 0
        let lastOrderDate: string | null = null
        for (const member of members) {
          const aggregate = customerAggregates(member.id, orders)
          ordersCount += aggregate.ordersCount
          totalSpent += aggregate.totalSpent
          if (
            aggregate.lastOrderDate &&
            (!lastOrderDate || aggregate.lastOrderDate > lastOrderDate)
          ) {
            lastOrderDate = aggregate.lastOrderDate
          }
        }
        return {
          group,
          members,
          share: customers.length > 0 ? members.length / customers.length : 0,
          ordersCount,
          totalSpent,
          lastOrderDate,
        }
      }),
    [groups, customers, orders]
  )

  const isPending =
    groupsQuery.isPending || customersQuery.isPending || ordersQuery.isPending

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: "members", desc: true },
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [filters, setFilters] = useState<Filter[]>(createDefaultGroupFilters)

  const selectedIds = Object.keys(rowSelection)
  const selectedCount = selectedIds.length
  const clearSelection = useCallback(() => setRowSelection({}), [])

  const bulkDelete = useCallback(() => {
    selectedIds.forEach((id) => deleteGroup.mutate(id))
    toast.success(
      `${selectedCount} ${selectedCount === 1 ? "group" : "groups"} deleted`
    )
    clearSelection()
  }, [selectedIds, selectedCount, deleteGroup, clearSelection])

  const [isLoading, setIsLoading] = useState(false)
  const [filteredData, setFilteredData] = useState<GroupRow[]>([])
  const [gridWidth, setGridWidth] = useState(0)
  const gridWidthRef = useRef<HTMLDivElement>(null)
  const hasManualColumnSizing = useRef(false)
  const lastAppliedActiveKey = useRef<string>(
    serializeActiveFiltersKey(getActiveFilters(createDefaultGroupFilters()))
  )

  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const simulateAsyncFiltering = useCallback(
    async (newFilters: Filter[]) => {
      setIsLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 400))
      setFilteredData(applyFiltersToData(rows, newFilters))
      setIsLoading(false)
    },
    [rows]
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
      const ids = new Set(rows.map((row) => row.group.id))
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
    const nextWidth = getAutoGroupColumnSize(gridWidth, columnVisibility)
    setColumnSizing((current) =>
      current[GROUP_COLUMN_ID] === nextWidth
        ? current
        : { ...current, [GROUP_COLUMN_ID]: nextWidth }
    )
  }, [columnVisibility, gridWidth])

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
    columns: groupsColumns,
    data: gridRows,
    pageCount: Math.ceil(gridRows.length / pagination.pageSize),
    getRowId: (row) => row.group.id,
    state: {
      pagination,
      sorting,
      columnSizing,
      columnVisibility,
      rowSelection,
    },
    columnResizeMode: "onChange",
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

  // Two causes for an empty grid, two opposite responses: an unsegmented
  // store, or filters that exclude every group there is.
  const emptyMessage =
    rows.length === 0
      ? "No groups yet. Create one to start segmenting customers."
      : "No groups match your filters."

  const handleRowClick = useCallback(
    (row: GroupRow) => {
      navigate({
        to: "/customers/groups/$groupId",
        params: { groupId: row.group.id },
      })
    },
    [navigate]
  )

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
                    fields={FILTER_FIELDS}
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
                        const next = createDefaultGroupFilters()
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
