import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DataGrid } from "@/components/reui/data-grid/data-grid"
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTableDndRows } from "@/components/reui/data-grid/data-grid-table-dnd-rows"
import {
  createFilter,
  Filters,
  type Filter,
  type FilterFieldConfig,
} from "@/components/reui/filters"
import { Frame, FrameFooter, FramePanel } from "@/components/reui/frame"
import type { DragEndEvent } from "@dnd-kit/core"
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
  PROMOTION_METHOD_OPTIONS,
  PROMOTION_STATUS_OPTIONS,
  PROMOTION_TARGET_OPTIONS,
  sortPromotionsByRank,
  type Promotion,
  type PromotionStatus,
} from "@/lib/data/promotions"
import {
  promotionsListQuery,
  useDeletePromotion,
  useReorderPromotions,
  useSetPromotionStatus,
} from "../queries"
import { columns, StatusBadge } from "./promotions-columns"
import {
  TagIcon,
  DotOutlineIcon as CircleDotIcon,
  LightningIcon as ZapIcon,
  TargetIcon,
  FunnelIcon as FilterIcon,
  FunnelXIcon,
  CheckCircleIcon as CircleCheckIcon,
  PauseCircleIcon as CirclePauseIcon,
  TrashIcon as Trash2Icon,
  XIcon,
} from "@phosphor-icons/react"

// ── Filter engine (generic; only field access + config are promotion-specific) ──

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

function filterFieldValue(promotion: Promotion, field: string): unknown {
  switch (field) {
    case "code":
      return `${promotion.code} ${promotion.name}`
    case "status":
      return promotion.status
    case "method":
      return promotion.method
    case "target":
      return promotion.target
    default:
      return undefined
  }
}

function applyFiltersToData(data: Promotion[], filters: Filter[]): Promotion[] {
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

function renderSelectedCount(values: unknown[]) {
  if (values.length === 0) return "Select..."
  if (values.length > 1) return `${values.length} selected`
  return null
}

function labelFor(
  options: { value: string; label: string }[],
  value: unknown
): string {
  return options.find((o) => o.value === value)?.label ?? String(value ?? "")
}

const filterFields: FilterFieldConfig[] = [
  {
    key: "code",
    label: "Code",
    icon: <TagIcon className="size-3.5" aria-hidden />,
    type: "text",
    className: "w-52",
    placeholder: "Code or name...",
  },
  {
    key: "status",
    label: "Status",
    icon: <CircleDotIcon className="size-3.5" aria-hidden />,
    type: "select",
    searchable: false,
    className: "w-[170px]",
    options: PROMOTION_STATUS_OPTIONS,
    customValueRenderer: (values) => {
      const state = renderSelectedCount(values)
      if (state) return state
      return <StatusBadge status={values[0] as PromotionStatus} />
    },
  },
  {
    key: "method",
    label: "Method",
    icon: <ZapIcon className="size-3.5" aria-hidden />,
    type: "select",
    searchable: false,
    className: "w-[160px]",
    options: PROMOTION_METHOD_OPTIONS,
    customValueRenderer: (values) => {
      const state = renderSelectedCount(values)
      if (state) return state
      return labelFor(PROMOTION_METHOD_OPTIONS, values[0])
    },
  },
  {
    key: "target",
    label: "Target",
    icon: <TargetIcon className="size-3.5" aria-hidden />,
    type: "select",
    searchable: false,
    className: "w-[160px]",
    options: PROMOTION_TARGET_OPTIONS,
    customValueRenderer: (values) => {
      const state = renderSelectedCount(values)
      if (state) return state
      return labelFor(PROMOTION_TARGET_OPTIONS, values[0])
    },
  },
]

/** Single default row, inactive until the user types (see getActiveFilters). */
function createDefaultPromotionFilters(): Filter[] {
  return [createFilter("code", "contains", [""])]
}

const PROMOTION_COLUMN_ID = "promotion"
const PROMOTION_COLUMN_DEFAULT_SIZE = 220

function getAutoPromotionColumnSize(
  containerWidth: number,
  columnVisibility: VisibilityState
) {
  const occupiedWidth = columns.reduce((total, column) => {
    if (
      !column.id ||
      column.id === PROMOTION_COLUMN_ID ||
      columnVisibility[column.id] === false
    ) {
      return total
    }
    return total + (typeof column.size === "number" ? column.size : 0)
  }, 0)

  return Math.max(
    PROMOTION_COLUMN_DEFAULT_SIZE,
    Math.round(containerWidth - occupiedWidth)
  )
}

// ── Main component ──

export function PromotionsGrid() {
  // Source of truth: the shared query cache (store-backed in the demo). Mutations
  // anywhere update this cache, so the grid stays in sync without prop drilling.
  // `isPending` is true until the client's first store read settles (no seed is
  // rendered before then); the grid shows skeleton rows during that window.
  const promotionsQuery = useQuery(promotionsListQuery())
  // Rank order is the stacking order, so it is the list's natural order: the
  // grid reads top to bottom as "which promotion wins".
  const promotions = useMemo(
    () => sortPromotionsByRank(promotionsQuery.data ?? []),
    [promotionsQuery.data]
  )
  const setPromotionStatus = useSetPromotionStatus()
  const deletePromotion = useDeletePromotion()
  const reorderPromotions = useReorderPromotions()

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 8,
  })
  // No default column sort: the rows arrive in rank order, and a column sort
  // would hide the stacking order the drag handle exists to edit.
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [filters, setFilters] = useState<Filter[]>(
    createDefaultPromotionFilters
  )

  // ── Bulk actions ──
  // rowSelection is keyed by promotion id (getRowId returns row.id below), so its
  // keys are the selected promotion ids.
  const selectedIds = Object.keys(rowSelection)
  const selectedCount = selectedIds.length
  const clearSelection = useCallback(() => setRowSelection({}), [])

  const bulkEnable = useCallback(() => {
    setPromotionStatus(selectedIds, "active")
    toast.success(`${selectedCount} promotions enabled`)
    clearSelection()
  }, [selectedIds, selectedCount, setPromotionStatus, clearSelection])

  const bulkDisable = useCallback(() => {
    setPromotionStatus(selectedIds, "draft")
    toast.message(`${selectedCount} promotions disabled`)
    clearSelection()
  }, [selectedIds, selectedCount, setPromotionStatus, clearSelection])

  const bulkDelete = useCallback(() => {
    selectedIds.forEach((id) => deletePromotion.mutate(id))
    toast.success(`${selectedCount} promotions deleted`)
    clearSelection()
  }, [selectedIds, selectedCount, deletePromotion, clearSelection])

  const [isLoading, setIsLoading] = useState(false)
  const [filteredData, setFilteredData] = useState<Promotion[]>(promotions)
  const [gridWidth, setGridWidth] = useState(0)
  const gridWidthRef = useRef<HTMLDivElement>(null)
  const hasManualColumnSizing = useRef(false)
  const lastAppliedActiveKey = useRef<string>(
    serializeActiveFiltersKey(getActiveFilters(createDefaultPromotionFilters()))
  )

  // Latest filters, read by the data-sync effect below without making it a
  // dependency (so re-filtering fires on data changes, not on every keystroke).
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const applyFilters = useCallback(
    (newFilters: Filter[]) => applyFiltersToData(promotions, newFilters),
    [promotions]
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
  // status toggle, or delete elsewhere updates the shared query cache, and this
  // keeps the visible rows (and their badges) in sync. Also covers first paint.
  // Also prune the selection so the bulk bar never references a deleted promotion
  // (its id would otherwise linger and make a bulk action target a ghost row).
  useEffect(() => {
    setFilteredData(applyFiltersToData(promotions, filtersRef.current))
    setRowSelection((prev) => {
      const ids = new Set(promotions.map((p) => p.id))
      const next: RowSelectionState = {}
      let changed = false
      for (const id of Object.keys(prev)) {
        if (ids.has(id)) next[id] = prev[id]
        else changed = true
      }
      return changed ? next : prev
    })
  }, [promotions])

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
    const nextWidth = getAutoPromotionColumnSize(gridWidth, columnVisibility)
    setColumnSizing((current) =>
      current[PROMOTION_COLUMN_ID] === nextWidth
        ? current
        : { ...current, [PROMOTION_COLUMN_ID]: nextWidth }
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
  // so on the first store read it can lag one frame behind `promotions`. Fall
  // back to a synchronous filter in that window so real rows show immediately
  // instead of a blank "no matches" frame. Re-filtering an already-empty result
  // is also empty, so a genuine no-match still renders the empty state correctly.
  const gridRows =
    !isLoading && filteredData.length === 0 && promotions.length > 0
      ? applyFiltersToData(promotions, filters)
      : filteredData

  // Rank spans the whole list, but a drop can only be read against the rows the
  // user can actually see. A column sort or an active filter means the visible
  // order is not rank order, so a drop would land somewhere the user did not
  // aim: the handle is inert in that state rather than guessing.
  const isRankOrdered =
    sorting.length === 0 && gridRows.length === promotions.length
  const dataIds = useMemo(() => gridRows.map((row) => row.id), [gridRows])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id || !isRankOrdered) return

      const from = promotions.findIndex((p) => p.id === String(active.id))
      const to = promotions.findIndex((p) => p.id === String(over.id))
      if (from === -1 || to === -1 || from === to) return

      const next = [...promotions]
      const [lifted] = next.splice(from, 1)
      next.splice(to, 0, lifted)
      reorderPromotions.mutate(next.map((p) => p.id))
    },
    [promotions, isRankOrdered, reorderPromotions]
  )

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
  // message has to say which: no promotions have been written, or filters that
  // exclude every promotion there is.
  const emptyMessage =
    promotions.length === 0
      ? "No promotions yet. Create one to start discounting."
      : "No promotions match your filters."

  return (
    <TooltipProvider delay={200}>
      <DataGrid
        table={table}
        isLoading={isLoading || promotionsQuery.isPending}
        loadingMode="skeleton"
        recordCount={gridRows.length}
        emptyMessage={
          !isLoading && !promotionsQuery.isPending && gridRows.length === 0
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
                    <Button variant="outline" onClick={bulkEnable}>
                      <CircleCheckIcon aria-hidden />
                      Enable
                    </Button>
                    <Button variant="outline" onClick={bulkDisable}>
                      <CirclePauseIcon aria-hidden />
                      Disable
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
                        const next = createDefaultPromotionFilters()
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
                <DataGridTableDndRows
                  handleDragEnd={handleDragEnd}
                  dataIds={dataIds}
                />
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
