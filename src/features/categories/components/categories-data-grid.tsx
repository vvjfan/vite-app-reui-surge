import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { DataGrid } from "@/components/reui/data-grid/data-grid"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTableDndRows } from "@/components/reui/data-grid/data-grid-table-dnd-rows"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import {
  createFilter,
  Filters,
  type Filter,
  type FilterFieldConfig,
} from "@/components/reui/filters"
import type { DragEndEvent } from "@dnd-kit/core"
import {
  getCoreRowModel,
  useReactTable,
  type ColumnSizingState,
} from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  categoryProductCount,
  childCategories,
  topLevelCategories,
  type Category,
} from "@/lib/data/categories"
import { productsListQuery } from "@/features/products/queries"
import { categoriesListQuery, useReorderCategories } from "../queries"
import {
  columns,
  type CategoriesTableMeta,
  type CategoryRow,
} from "./categories-columns"
import {
  CaretDoubleUpIcon as ChevronsDownUpIcon,
  CaretUpDownIcon as ChevronsUpDownIcon,
  DotOutlineIcon as CircleDotIcon,
  EyeIcon,
  FunnelIcon as FilterIcon,
  FunnelXIcon,
  TagIcon,
} from "@phosphor-icons/react"

// ── Filter engine (customers-grid conventions, applied to a tree) ──

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

function categoryMatches(category: Category, filters: Filter[]): boolean {
  return getActiveFilters(filters).every((filter) => {
    const { field, operator, values } = filter
    if (field === "search") {
      const tokens = values.map((v) => String(v).trim()).filter(Boolean)
      if (tokens.length === 0) return true
      const haystack = `${category.name} ${category.description}`.toLowerCase()
      const matches = tokens.some((token) =>
        haystack.includes(token.toLowerCase())
      )
      return operator === "not_contains" ? !matches : matches
    }
    if (field === "status") {
      const value = category.isActive ? "active" : "inactive"
      return operator === "is_not"
        ? !values.includes(value)
        : values.includes(value)
    }
    if (field === "visibility") {
      const value = category.isInternal ? "internal" : "public"
      return operator === "is_not"
        ? !values.includes(value)
        : values.includes(value)
    }
    return true
  })
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "internal", label: "Internal" },
]

function renderSelectedCount(values: unknown[]) {
  if (values.length === 0) return "Select..."
  if (values.length > 1) return `${values.length} selected`
  return null
}

const FILTER_FIELDS: FilterFieldConfig[] = [
  {
    key: "search",
    label: "Search",
    icon: <TagIcon className="size-3.5" aria-hidden />,
    type: "text",
    className: "w-56",
    placeholder: "Name, description...",
  },
  {
    key: "status",
    label: "Status",
    icon: <CircleDotIcon className="size-3.5" aria-hidden />,
    type: "select",
    searchable: false,
    className: "w-[150px]",
    options: STATUS_OPTIONS,
    customValueRenderer: (values) =>
      renderSelectedCount(values) ??
      (values[0] === "active" ? "Active" : "Inactive"),
  },
  {
    key: "visibility",
    label: "Visibility",
    icon: <EyeIcon className="size-3.5" aria-hidden />,
    type: "select",
    searchable: false,
    className: "w-[150px]",
    options: VISIBILITY_OPTIONS,
    customValueRenderer: (values) =>
      renderSelectedCount(values) ??
      (values[0] === "internal" ? "Internal" : "Public"),
  },
]

function createDefaultCategoryFilters(): Filter[] {
  return [createFilter("search", "contains", [""])]
}

export function CategoriesDataGrid() {
  const navigate = useNavigate()
  const categoriesQuery = useQuery(categoriesListQuery())
  const productsQuery = useQuery(productsListQuery())
  const categories = categoriesQuery.data ?? []
  const products = productsQuery.data ?? []
  const reorderCategories = useReorderCategories()

  const topLevel = useMemo(() => topLevelCategories(categories), [categories])

  // Only the first branch opens by default, so the tree reads as a tree. An
  // entry in the map is an explicit user choice and overrides that.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const defaultOpenId = topLevel[0]?.id
  const isExpanded = useCallback(
    (id: string) => expanded[id] ?? id === defaultOpenId,
    [expanded, defaultOpenId]
  )
  const toggleExpand = useCallback(
    (id: string) =>
      setExpanded((prev) => ({
        ...prev,
        [id]: !(prev[id] ?? id === defaultOpenId),
      })),
    [defaultOpenId]
  )

  const parentIds = useMemo(
    () =>
      categories
        .filter((c) => childCategories(categories, c.id).length > 0)
        .map((c) => c.id),
    [categories]
  )
  const setAll = (open: boolean) =>
    setExpanded(Object.fromEntries(parentIds.map((id) => [id, open])))

  // The filters the user is editing vs the ones the tree is showing: applying
  // through a short simulated latency keeps the grid's loading behaviour
  // identical to the customers grid.
  const [filters, setFilters] = useState<Filter[]>(createDefaultCategoryFilters)
  const [appliedFilters, setAppliedFilters] = useState<Filter[]>(
    createDefaultCategoryFilters
  )
  const [isFiltering, setIsFiltering] = useState(false)
  const lastAppliedActiveKey = useRef<string>(
    serializeActiveFiltersKey(getActiveFilters(createDefaultCategoryFilters()))
  )

  const handleFiltersChange = useCallback((next: Filter[]) => {
    setFilters(next)
    const key = serializeActiveFiltersKey(getActiveFilters(next))
    if (key === lastAppliedActiveKey.current) return
    lastAppliedActiveKey.current = key
    setIsFiltering(true)
    window.setTimeout(() => {
      setAppliedFilters(next)
      setIsFiltering(false)
    }, 400)
  }, [])

  const filtersActive = getActiveFilters(appliedFilters).length > 0

  // Flatten the tree into visible rows. Unfiltered, the walk honours the
  // expanded map. Filtered, a match brings its ancestors along and every such
  // branch is forced open - a hit deep in the tree is meaningless without the
  // path that leads to it.
  const rows = useMemo<CategoryRow[]>(() => {
    const out: CategoryRow[] = []
    if (!filtersActive) {
      const walk = (nodes: Category[], depth: number) => {
        for (const node of nodes) {
          const children = childCategories(categories, node.id)
          out.push({
            category: node,
            depth,
            hasChildren: children.length > 0,
            productCount: categoryProductCount(node, categories, products),
          })
          if (children.length > 0 && isExpanded(node.id)) {
            walk(children, depth + 1)
          }
        }
      }
      walk(topLevel, 0)
      return out
    }

    const byId = new Map(categories.map((c) => [c.id, c]))
    const visible = new Set<string>()
    for (const category of categories) {
      if (!categoryMatches(category, appliedFilters)) continue
      let current: Category | undefined = category
      while (current) {
        visible.add(current.id)
        current = current.parentId ? byId.get(current.parentId) : undefined
      }
    }
    const walk = (nodes: Category[], depth: number) => {
      for (const node of nodes) {
        if (!visible.has(node.id)) continue
        const children = childCategories(categories, node.id)
        out.push({
          category: node,
          depth,
          hasChildren: children.length > 0,
          productCount: categoryProductCount(node, categories, products),
        })
        if (children.length > 0) walk(children, depth + 1)
      }
    }
    walk(topLevel, 0)
    return out
  }, [
    categories,
    products,
    topLevel,
    isExpanded,
    filtersActive,
    appliedFilters,
  ])

  const dataIds = useMemo(() => rows.map((row) => row.category.id), [rows])

  const handleRowClick = useCallback(
    (row: CategoryRow) => {
      navigate({
        to: "/categories/$categoryId",
        params: { categoryId: row.category.id },
      })
    },
    [navigate]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const byId = new Map(categories.map((c) => [c.id, c]))
      const moved = byId.get(String(active.id))
      if (!moved) return

      // An expanded branch puts its children between two siblings, so a drop
      // can land on a row from another level. Rank only orders siblings, so
      // resolve the drop up to the target's ancestor that shares the dragged
      // category's parent; anything else is a reparent and is not a drag.
      let target = byId.get(String(over.id))
      while (target && target.parentId !== moved.parentId) {
        target = target.parentId ? byId.get(target.parentId) : undefined
      }
      if (!target || target.id === moved.id) return

      const siblings =
        moved.parentId === null
          ? topLevel
          : childCategories(categories, moved.parentId)
      const from = siblings.findIndex((c) => c.id === moved.id)
      const to = siblings.findIndex((c) => c.id === target.id)
      if (from === -1 || to === -1 || from === to) return

      const next = [...siblings]
      const [lifted] = next.splice(from, 1)
      next.splice(to, 0, lifted)
      reorderCategories.mutate(next.map((c) => c.id))
    },
    [categories, topLevel, reorderCategories]
  )

  const meta: CategoriesTableMeta = { isExpanded, toggleExpand }

  // The table is layout-fixed, so when the column sizes sum to less than the
  // container the browser stretches EVERY column proportionally - including
  // the 36px drag handle, which drifts away from the row content. Handing all
  // surplus width to the category column keeps the fixed columns at their
  // authored size (the same arrangement the customers grid uses).
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [gridWidth, setGridWidth] = useState(0)
  const gridWidthRef = useRef<HTMLDivElement>(null)

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
    if (gridWidth <= 0) return
    const occupied = columns.reduce(
      (total, column) =>
        column.id === "category"
          ? total
          : total + (typeof column.size === "number" ? column.size : 0),
      0
    )
    const nextWidth = Math.max(280, Math.round(gridWidth - occupied))
    setColumnSizing((current) =>
      current["category"] === nextWidth
        ? current
        : { ...current, category: nextWidth }
    )
  }, [gridWidth])

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.category.id,
    meta,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <TooltipProvider delay={200}>
      <DataGrid
        table={table}
        onRowClick={handleRowClick}
        isLoading={categoriesQuery.isPending || isFiltering}
        loadingMode="skeleton"
        recordCount={rows.length}
        emptyMessage={
          !categoriesQuery.isPending && !isFiltering && rows.length === 0
            ? categories.length === 0
              ? "No categories yet."
              : "No categories match your filters."
            : undefined
        }
        tableLayout={{
          dense: true,
          rowBorder: true,
          columnsResizable: false,
          columnsMovable: false,
          columnsVisibility: false,
        }}
      >
        <Frame dense className="w-full">
          <FrameHeader className="flex-row items-center justify-between gap-3">
            <FrameTitle>Catalog tree</FrameTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setAll(true)}>
                <ChevronsUpDownIcon aria-hidden="true" />
                Expand all
              </Button>
              <Button variant="outline" onClick={() => setAll(false)}>
                <ChevronsDownUpIcon aria-hidden="true" />
                Collapse all
              </Button>
            </div>
          </FrameHeader>
          <FramePanel className="p-0! shadow-none!">
            <div className="flex flex-wrap items-center justify-between gap-2 px-(--frame-panel-header-px) py-(--frame-panel-header-py)">
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
              {filters.length > 0 && (
                <Button
                  variant="outline"
                  className="shrink-0"
                  onClick={() => {
                    const next = createDefaultCategoryFilters()
                    lastAppliedActiveKey.current = serializeActiveFiltersKey(
                      getActiveFilters(next)
                    )
                    setFilters(next)
                    setAppliedFilters(next)
                  }}
                  disabled={isFiltering}
                >
                  <FunnelXIcon aria-hidden />
                  Clear
                </Button>
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
        </Frame>
      </DataGrid>
    </TooltipProvider>
  )
}
