import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import type { Review, ReviewStatus } from "@/lib/data/reviews"
import { customersListQuery } from "@/features/customers/queries"
import { productsListQuery } from "@/features/products/queries"
import { reviewsListQuery, useUpdateReview } from "../queries"
import { columns, StatusBadge, type ReviewsTableMeta } from "./reviews-columns"
import { ReviewDetailSheet } from "./review-detail-sheet"
import {
  ProhibitIcon as BanIcon,
  CheckCircleIcon as CircleCheckIcon,
  DotOutlineIcon as CircleDotIcon,
  FunnelIcon as FilterIcon,
  FunnelXIcon,
  ChatTextIcon as MessageSquareIcon,
  StarIcon,
  XIcon,
} from "@phosphor-icons/react"

// ── Filter engine (generic; only field access + config are review-specific) ──

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

function filterFieldValue(review: Review, field: string): unknown {
  switch (field) {
    case "review":
      return `${review.title} ${review.content} ${review.authorName}`
    case "status":
      return review.status
    case "rating":
      return String(review.rating)
    default:
      return undefined
  }
}

function applyFiltersToData(data: Review[], filters: Filter[]): Review[] {
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

const STATUS_OPTIONS: { value: ReviewStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
]

const RATING_OPTIONS = [5, 4, 3, 2, 1].map((star) => ({
  value: String(star),
  label: `${star} star${star === 1 ? "" : "s"}`,
}))

function renderSelectedCount(values: unknown[]) {
  if (values.length === 0) return "Select..."
  if (values.length > 1) return `${values.length} selected`
  return null
}

const filterFields: FilterFieldConfig[] = [
  {
    key: "review",
    label: "Review",
    icon: <MessageSquareIcon className="size-3.5" aria-hidden />,
    type: "text",
    className: "w-52",
    placeholder: "Title, text or author...",
  },
  {
    key: "status",
    label: "Status",
    icon: <CircleDotIcon className="size-3.5" aria-hidden />,
    type: "select",
    searchable: false,
    className: "w-[170px]",
    options: STATUS_OPTIONS,
    customValueRenderer: (values) => {
      const state = renderSelectedCount(values)
      if (state) return state
      return <StatusBadge status={values[0] as ReviewStatus} />
    },
  },
  {
    key: "rating",
    label: "Rating",
    icon: <StarIcon className="size-3.5" aria-hidden />,
    type: "select",
    searchable: false,
    className: "w-[150px]",
    options: RATING_OPTIONS,
    customValueRenderer: (values) => {
      const state = renderSelectedCount(values)
      if (state) return state
      return String(values[0])
    },
  },
]

// The page opens as a moderation queue: only reviews awaiting a decision. The
// filter chip stays visible in the toolbar, and Clear drops back to every review.
function createDefaultReviewFilters(): Filter[] {
  return [createFilter("status", "is_any_of", ["pending"])]
}

const REVIEW_COLUMN_ID = "review"
const REVIEW_COLUMN_DEFAULT_SIZE = 240

function getAutoReviewColumnSize(
  containerWidth: number,
  columnVisibility: VisibilityState
) {
  const occupiedWidth = columns.reduce((total, column) => {
    if (
      !column.id ||
      column.id === REVIEW_COLUMN_ID ||
      columnVisibility[column.id] === false
    ) {
      return total
    }
    return total + (typeof column.size === "number" ? column.size : 0)
  }, 0)

  return Math.max(
    REVIEW_COLUMN_DEFAULT_SIZE,
    Math.round(containerWidth - occupiedWidth)
  )
}

// ── Main component ──

export function ReviewsDataGrid() {
  // Source of truth: the shared query cache (store-backed in the demo).
  // `isPending` is true until the client's first store read settles, so the grid
  // shows skeleton rows rather than a seed flash.
  const reviewsQuery = useQuery(reviewsListQuery())
  const reviews = reviewsQuery.data ?? []
  const productsQuery = useQuery(productsListQuery())
  const customersQuery = useQuery(customersListQuery())
  const updateReview = useUpdateReview()

  // Reviews carry only a productId; resolve titles and thumbnails from the
  // products cache so products stay the single source of truth.
  const productById = useMemo(
    () => new Map((productsQuery.data ?? []).map((p) => [p.id, p])),
    [productsQuery.data]
  )

  // Same for the reviewer: a review denormalizes only the name, so the avatar
  // comes from the customer record a registered reviewer points at.
  const customerById = useMemo(
    () => new Map((customersQuery.data ?? []).map((c) => [c.id, c])),
    [customersQuery.data]
  )

  const [openReviewId, setOpenReviewId] = useState<string | null>(null)
  const handleRowClick = useCallback(
    (review: Review) => setOpenReviewId(review.id),
    []
  )
  // Read the open review out of the list so the sheet reflects a moderation
  // change immediately (and closes if the row is deleted).
  const openReview =
    reviews.find((review) => review.id === openReviewId) ?? null

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 8,
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [filters, setFilters] = useState<Filter[]>(createDefaultReviewFilters)

  // rowSelection is keyed by review id (getRowId returns row.id below).
  const selectedIds = Object.keys(rowSelection)
  const selectedCount = selectedIds.length
  const clearSelection = useCallback(() => setRowSelection({}), [])

  // Bulk moderation. A backend typically takes this as one POST
  // /admin/reviews/status { ids, status }; the demo seam is per-row, so fan the
  // status patch out the same way the orders and products grids do.
  const bulkApprove = useCallback(() => {
    selectedIds.forEach((id) =>
      updateReview.mutate({ id, patch: { status: "approved" } })
    )
    toast.success(
      `${selectedCount} review${selectedCount === 1 ? "" : "s"} approved`
    )
    clearSelection()
  }, [selectedIds, selectedCount, updateReview, clearSelection])

  const bulkReject = useCallback(() => {
    selectedIds.forEach((id) =>
      updateReview.mutate({ id, patch: { status: "rejected" } })
    )
    toast.message(
      `${selectedCount} review${selectedCount === 1 ? "" : "s"} rejected`
    )
    clearSelection()
  }, [selectedIds, selectedCount, updateReview, clearSelection])

  const [isLoading, setIsLoading] = useState(false)
  const [filteredData, setFilteredData] = useState<Review[]>(reviews)
  const [gridWidth, setGridWidth] = useState(0)
  const gridWidthRef = useRef<HTMLDivElement>(null)
  const hasManualColumnSizing = useRef(false)
  const lastAppliedActiveKey = useRef<string>(
    serializeActiveFiltersKey(getActiveFilters(createDefaultReviewFilters()))
  )

  // Latest filters, read by the data-sync effect below without making it a
  // dependency (so re-filtering fires on data changes, not on every keystroke).
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const applyFilters = useCallback(
    (newFilters: Filter[]) => applyFiltersToData(reviews, newFilters),
    [reviews]
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

  // Re-apply the active filters whenever the underlying data changes (a
  // moderation or delete updates the shared query cache), and prune the
  // selection so the bulk bar never references a review that no longer exists.
  useEffect(() => {
    setFilteredData(applyFiltersToData(reviews, filtersRef.current))
    setRowSelection((prev) => {
      const ids = new Set(reviews.map((review) => review.id))
      const next: RowSelectionState = {}
      let changed = false
      for (const id of Object.keys(prev)) {
        if (ids.has(id)) next[id] = prev[id]
        else changed = true
      }
      return changed ? next : prev
    })
  }, [reviews])

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
    const nextWidth = getAutoReviewColumnSize(gridWidth, columnVisibility)
    setColumnSizing((current) =>
      current[REVIEW_COLUMN_ID] === nextWidth
        ? current
        : { ...current, [REVIEW_COLUMN_ID]: nextWidth }
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
  // so on the first store read it can lag one frame behind `reviews`. Fall back
  // to a synchronous filter in that window so real rows show immediately instead
  // of a blank "no matches" frame.
  const gridRows =
    !isLoading && filteredData.length === 0 && reviews.length > 0
      ? applyFiltersToData(reviews, filters)
      : filteredData

  const tableMeta: ReviewsTableMeta = { productById, customerById }

  const table = useReactTable({
    columns,
    data: gridRows,
    pageCount: Math.ceil(gridRows.length / pagination.pageSize),
    getRowId: (row) => row.id,
    meta: tableMeta,
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
  // message has to say which: nothing has been reviewed yet, or filters that
  // exclude every review there is. Reviews are written by shoppers and there is
  // no admin create flow, so the empty case points at the source, not a button.
  const emptyMessage =
    reviews.length === 0
      ? "No reviews yet. They arrive when shoppers rate a product."
      : "No reviews match your filters."

  return (
    <TooltipProvider delay={200}>
      <DataGrid
        table={table}
        onRowClick={handleRowClick}
        isLoading={isLoading || reviewsQuery.isPending}
        loadingMode="skeleton"
        recordCount={gridRows.length}
        emptyMessage={
          !isLoading && !reviewsQuery.isPending && gridRows.length === 0
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
                    <Button variant="outline" onClick={bulkApprove}>
                      <CircleCheckIcon aria-hidden />
                      Approve
                    </Button>
                    <Button variant="outline" onClick={bulkReject}>
                      <BanIcon aria-hidden />
                      Reject
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
                        const next: Filter[] = []
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

      <ReviewDetailSheet
        review={openReview}
        product={
          openReview ? (productById.get(openReview.productId) ?? null) : null
        }
        customer={
          openReview?.customerId
            ? (customerById.get(openReview.customerId) ?? null)
            : null
        }
        open={openReview !== null}
        onOpenChange={(open) => {
          if (!open) setOpenReviewId(null)
        }}
      />
    </TooltipProvider>
  )
}
