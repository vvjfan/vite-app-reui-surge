import type { ReactNode } from "react"
import { createContext, useContext, useMemo, useLayoutEffect } from "react"
import type {
  Column,
  ColumnFiltersState,
  RowData,
  SortingState,
  Table,
} from "@tanstack/react-table"

import { cn } from "@/lib/utils"

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    headerTitle?: string
    headerClassName?: string
    cellClassName?: string
    skeleton?: ReactNode
    expandedContent?: (row: TData, value?: TValue) => ReactNode
    autoSize?: boolean
  }
}

/** Label for headers / column visibility: `meta.headerTitle`, string `columnDef.header`, or `column.id`. */
export function getColumnHeaderLabel<TData, TValue>(
  column: Column<TData, TValue>
): string {
  const meta = column.columnDef.meta
  if (typeof meta?.headerTitle === "string") return meta.headerTitle
  const defHeader = column.columnDef.header
  if (typeof defHeader === "string") return defHeader
  return String(column.id)
}

export type DataGridApiFetchParams = {
  pageIndex: number
  pageSize: number
  sorting?: SortingState
  filters?: ColumnFiltersState
  searchQuery?: string
}

export type DataGridApiResponse<T> = {
  data: T[]
  empty: boolean
  pagination: {
    total: number
    page: number
  }
}

export interface DataGridContextProps<TData> {
  props: DataGridProps<TData>
  table: Table<TData>
  recordCount: number
  isLoading: boolean
}

export type DataGridRequestParams = {
  pageIndex: number
  pageSize: number
  sorting?: SortingState
  columnFilters?: ColumnFiltersState
}

export interface DataGridProps<TData> {
  className?: string
  table?: Table<TData>
  recordCount: number
  children?: ReactNode
  onRowClick?: (row: TData) => void
  isLoading?: boolean
  loadingMode?: "skeleton" | "spinner"
  loadingMessage?: ReactNode | string
  fetchingMoreMessage?: ReactNode | string
  allRowsLoadedMessage?: ReactNode | string
  emptyMessage?: ReactNode | string
  tableLayout?: {
    dense?: boolean
    cellBorder?: boolean
    rowBorder?: boolean
    rowRounded?: boolean
    stripped?: boolean
    headerBackground?: boolean
    footerBackground?: boolean
    headerBorder?: boolean
    headerSticky?: boolean
    width?: "auto" | "fixed"
    columnsVisibility?: boolean
    columnsResizable?: boolean
    columnsResizeMode?: "onChange" | "onEnd"
    columnsPinnable?: boolean
    columnsMovable?: boolean
    columnsDraggable?: boolean
    rowsDraggable?: boolean
    rowsPinnable?: boolean
  }
  tableClassNames?: {
    base?: string
    header?: string
    headerRow?: string
    headerSticky?: string
    body?: string
    bodyRow?: string
    footer?: string
    edgeCell?: string
  }
}

const DataGridContext = createContext<
  DataGridContextProps<unknown> | undefined
>(undefined)

function useDataGrid<TData = unknown>() {
  const context = useContext(DataGridContext)
  if (!context) {
    throw new Error("useDataGrid must be used within a DataGridProvider")
  }
  return context as DataGridContextProps<TData>
}

function DataGridProvider<TData>({
  children,
  table,
  ...props
}: DataGridProps<TData> & { table: Table<TData> }) {
  const resolvedColumnsResizeMode =
    props.tableLayout?.columnsResizeMode ?? "onEnd"

  // Keep resize mode aligned with the DataGrid contract after each commit so
  // consumer-level useReactTable options cannot flip it back between drags.
  useLayoutEffect(() => {
    if (props.tableLayout?.columnsResizable) {
      table.setOptions((previous) => ({
        ...previous,
        columnResizeMode: resolvedColumnsResizeMode,
      }))
    }
  }, [table, props.tableLayout?.columnsResizable, resolvedColumnsResizeMode])
  const value = useMemo(
    () => ({
      props,
      table,
      recordCount: props.recordCount,
      isLoading: props.isLoading || false,
    }),
    [table, props]
  )

  return (
    <DataGridContext.Provider
      value={value as unknown as DataGridContextProps<unknown>}
    >
      {children}
    </DataGridContext.Provider>
  )
}

function DataGrid<TData>({ children, table, ...props }: DataGridProps<TData>) {
  const defaultProps: Partial<DataGridProps<TData>> = {
    loadingMode: "skeleton",
    tableLayout: {
      dense: false,
      cellBorder: false,
      rowBorder: true,
      rowRounded: false,
      stripped: false,
      headerSticky: false,
      headerBackground: false,
      footerBackground: false,
      headerBorder: true,
      width: "fixed",
      columnsVisibility: false,
      columnsResizable: false,
      columnsResizeMode: "onEnd",
      columnsPinnable: false,
      columnsMovable: false,
      columnsDraggable: false,
      rowsDraggable: false,
      rowsPinnable: false,
    },
    tableClassNames: {
      base: "",
      header: "",
      headerRow: "",
      headerSticky: "sticky top-0 z-15 bg-background/90 backdrop-blur-xs",
      body: "",
      bodyRow: "",
      footer: "",
      edgeCell: "",
    },
  }

  const mergedProps: DataGridProps<TData> = {
    ...defaultProps,
    ...props,
    tableLayout: {
      ...defaultProps.tableLayout,
      ...(props.tableLayout || {}),
    },
    tableClassNames: {
      ...defaultProps.tableClassNames,
      ...(props.tableClassNames || {}),
    },
  }

  // Ensure table is provided
  if (!table) {
    throw new Error('DataGrid requires a "table" prop')
  }

  return (
    <DataGridProvider table={table} {...mergedProps}>
      {children}
    </DataGridProvider>
  )
}

function DataGridContainer({
  children,
  className,
}: {
  children: ReactNode
  className?: string
  border?: boolean
}) {
  return (
    <div
      data-slot="data-grid"
      className={cn("w-full overflow-hidden", className)}
    >
      {children}
    </div>
  )
}

export { useDataGrid, DataGridProvider, DataGrid, DataGridContainer }
