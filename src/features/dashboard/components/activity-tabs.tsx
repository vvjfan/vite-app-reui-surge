import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ProductRef } from "@/components/shared/product-ref"
import { toast } from "sonner"
import { Badge } from "@/components/reui/badge"
import { DataGrid } from "@/components/reui/data-grid/data-grid"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
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
import { Rating } from "@/components/reui/rating"
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import type {
  ColumnDef,
  PaginationState,
  SortingState,
} from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { STATUS_LABEL } from "@/lib/data/dashboard"
import type { ProductRow, StockStatus } from "@/lib/data/dashboard"
import { EditItemSheet } from "@/features/inventory/components/edit-item-sheet"
import {
  useInventoryItems,
  useUpdateInventoryItem,
} from "@/features/inventory/queries"
import { dashboardProductsQuery } from "../queries"
import {
  DotsThreeIcon as MoreHorizontalIcon,
  EyeIcon,
  SlidersHorizontalIcon,
  PackageIcon,
  ArchiveIcon,
  DownloadSimpleIcon as DownloadIcon,
} from "@phosphor-icons/react"

type StockTab = "all" | StockStatus

const TAB_DESCRIPTIONS: Record<StockTab, string> = {
  all: "Across every location",
  in_stock: "Above reorder point",
  low_stock: "Below reorder point",
  out_of_stock: "Nothing left to sell",
}

const STATUS_VARIANT: Record<
  StockStatus,
  "success-light" | "warning-light" | "destructive-light"
> = {
  in_stock: "success-light",
  low_stock: "warning-light",
  out_of_stock: "destructive-light",
}

// ─────────────────────────────────────────────────────────────────────────
// Cells, adapted from data-grid-10 CourseCell / TagsCell / RatingCell
// ─────────────────────────────────────────────────────────────────────────

function ProductCell({ product }: { product: ProductRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative shrink-0 overflow-hidden rounded-lg bg-muted">
        <img
          src={product.thumbnail}
          alt=""
          aria-hidden="true"
          className="h-[42px] w-[42px] object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <ProductRef product={{ id: product.productId, title: product.name }} />
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
          <span className="font-mono">{product.sku}</span>
          <span
            className="size-1 shrink-0 rounded-full bg-muted-foreground/40"
            aria-hidden="true"
          />
          <span className="truncate">{product.vendor}</span>
        </span>
      </div>
    </div>
  )
}

// A category is a label, not a status: one variant, and the text carries the
// distinction.
function CategoryBadgeCell({ category }: { category: string }) {
  return <Badge variant="secondary">{category}</Badge>
}

function PriceCell({ product }: { product: ProductRow }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-sm font-medium text-foreground tabular-nums">
        ${product.retailPrice}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        cost ${product.unitPrice}
      </span>
    </div>
  )
}

function StockCell({ product }: { product: ProductRow }) {
  const tone =
    product.status === "out_of_stock"
      ? "text-destructive-foreground font-semibold"
      : product.status === "low_stock"
        ? "text-warning-foreground font-semibold"
        : "text-foreground font-medium"
  return (
    <div className="flex min-w-0 flex-col">
      <span className={cn("text-sm tabular-nums", tone)}>{product.onHand}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        reorder at {product.reorderPoint}
      </span>
    </div>
  )
}

function RatingCell({ product }: { product: ProductRow }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Rating rating={product.rating} size="sm" className="gap-0.5" />
      <span className="text-xs text-muted-foreground tabular-nums">
        ({product.reviewCount})
      </span>
    </div>
  )
}

// Every item here acts on something real: the product it stocks, the inventory
// item behind the row, or the reorder queue. "Discontinue" replaces the donor
// block's "Archive" because there is no archive in this domain - the ledger's
// own Discontinued status is the thing that action means.
function ProductActionsCell({ product }: { product: ProductRow }) {
  const [editOpen, setEditOpen] = useState(false)
  const [discontinueOpen, setDiscontinueOpen] = useState(false)
  const { data: items } = useInventoryItems()
  const updateItem = useUpdateInventoryItem()

  // The sheet edits the real ledger row, so resolve it rather than passing the
  // derived view. Null until the items read settles; the sheet handles that.
  const item = items?.find((row) => row.id === product.itemId) ?? null

  const discontinue = () => {
    setDiscontinueOpen(false)
    updateItem.mutate(
      { id: product.itemId, patch: { status: "Discontinued" } },
      {
        onSuccess: () =>
          toast.success("Marked discontinued", { description: product.name }),
      }
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Open actions for ${product.name}`}
            />
          }
        >
          <MoreHorizontalIcon className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <Link
                  to="/products/$productId"
                  params={{ productId: product.productId }}
                />
              }
            >
              <EyeIcon className="size-4" aria-hidden="true" />
              View product
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!item}
              onClick={() => setEditOpen(true)}
            >
              <SlidersHorizontalIcon className="size-4" aria-hidden="true" />
              Adjust stock
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/inventory/reorder" />}>
              <PackageIcon className="size-4" aria-hidden="true" />
              Reorder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={!item}
              onClick={() => setDiscontinueOpen(true)}
            >
              <ArchiveIcon className="size-4" aria-hidden="true" />
              Discontinue
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditItemSheet item={item} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={discontinueOpen} onOpenChange={setDiscontinueOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Discontinue this SKU?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {product.name}
              </span>{" "}
              ({product.sku}) is marked Discontinued in the stock ledger: you
              have stopped selling it. Its {product.onHand.toLocaleString()} on
              hand and its movement history are kept, and you can set the status
              back from the ledger.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep stocking</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={discontinue}>
              Discontinue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Column definitions, Products uses the data-grid-10 column factory pattern
// ─────────────────────────────────────────────────────────────────────────

const productColumns: ColumnDef<ProductRow>[] = [
  {
    accessorFn: (row) => row.name,
    id: "product",
    header: ({ column }) => (
      <DataGridColumnHeader title="Product" column={column} />
    ),
    cell: ({ row }) => <ProductCell product={row.original} />,
    enableSorting: true,
    enableHiding: false,
    minSize: 280,
    meta: {
      autoSize: true,
      headerClassName: "ps-(--frame-panel-px)",
      cellClassName: "ps-(--frame-panel-px)",
      skeleton: (
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="size-[42px] shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ),
    },
  },
  {
    accessorFn: (row) => row.category,
    id: "category",
    header: ({ column }) => (
      <DataGridColumnHeader title="Category" column={column} />
    ),
    cell: ({ row }) => <CategoryBadgeCell category={row.original.category} />,
    size: 140,
    enableSorting: true,
    meta: {
      skeleton: <Skeleton className="h-5 w-20 rounded-md" />,
    },
  },
  {
    accessorFn: (row) => row.retailPrice,
    id: "price",
    header: ({ column }) => (
      <DataGridColumnHeader title="Price" column={column} />
    ),
    cell: ({ row }) => <PriceCell product={row.original} />,
    size: 110,
    enableSorting: true,
    meta: {
      skeleton: (
        <div className="flex flex-col gap-0.5">
          <Skeleton className="h-3.5 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
      ),
    },
  },
  {
    accessorFn: (row) => row.onHand,
    id: "stock",
    header: ({ column }) => (
      <DataGridColumnHeader title="Stock" column={column} />
    ),
    cell: ({ row }) => <StockCell product={row.original} />,
    size: 120,
    enableSorting: true,
    meta: {
      skeleton: (
        <div className="flex flex-col gap-0.5">
          <Skeleton className="h-3.5 w-10" />
          <Skeleton className="h-3 w-20" />
        </div>
      ),
    },
  },
  {
    accessorFn: (row) => row.status,
    id: "status",
    header: ({ column }) => (
      <DataGridColumnHeader title="Status" column={column} />
    ),
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status]}>
        {STATUS_LABEL[row.original.status]}
      </Badge>
    ),
    size: 130,
    enableSorting: true,
    meta: {
      skeleton: <Skeleton className="h-5 w-20 rounded-md" />,
    },
  },
  {
    accessorFn: (row) => row.rating,
    id: "rating",
    header: ({ column }) => (
      <DataGridColumnHeader title="Rating" column={column} />
    ),
    cell: ({ row }) => <RatingCell product={row.original} />,
    size: 160,
    enableSorting: true,
    meta: {
      skeleton: (
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-[88px]" />
          <Skeleton className="h-3 w-6" />
        </div>
      ),
    },
  },
  {
    id: "actions",
    header: () => null,
    cell: ({ row }) => <ProductActionsCell product={row.original} />,
    size: 50,
    enableSorting: false,
    enableResizing: false,
    meta: {
      headerClassName: "pr-(--frame-panel-px)",
      cellClassName: "pr-(--frame-panel-px)",
      skeleton: <Skeleton className="size-7 rounded-md" />,
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────
// Per-tab DataGrid, filters products by stock status
// ─────────────────────────────────────────────────────────────────────────

function StocksGrid({ tab }: { tab: StockTab }) {
  const productsQuery = useQuery(dashboardProductsQuery())
  const products = productsQuery.data ?? []
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  })
  const data = useMemo(
    () => (tab === "all" ? products : products.filter((p) => p.status === tab)),
    [tab, products]
  )
  const table = useReactTable({
    data,
    columns: productColumns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <DataGrid
      table={table}
      isLoading={productsQuery.isPending}
      loadingMode="skeleton"
      recordCount={data.length}
      tableLayout={{ headerSticky: false, dense: false }}
    >
      <DataGridScrollArea>
        <DataGridTable />
      </DataGridScrollArea>
      <Separator />
      <FrameFooter>
        <DataGridPagination />
      </FrameFooter>
    </DataGrid>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Main tabbed surface
// ─────────────────────────────────────────────────────────────────────────

export function ActivityTabs() {
  const productsQuery = useQuery(dashboardProductsQuery())
  const products = productsQuery.data ?? []
  const [activeTab, setActiveTab] = useState<StockTab>("all")

  const tabs = useMemo<{ value: StockTab; label: string; count: number }[]>(
    () => [
      { value: "all", label: "All products", count: products.length },
      {
        value: "in_stock",
        label: "In stock",
        count: products.filter((p) => p.status === "in_stock").length,
      },
      {
        value: "low_stock",
        label: "Low stock",
        count: products.filter((p) => p.status === "low_stock").length,
      },
      {
        value: "out_of_stock",
        label: "Out of stock",
        count: products.filter((p) => p.status === "out_of_stock").length,
      },
    ],
    [products]
  )

  return (
    <Frame dense className="w-full">
      <FrameHeader className="flex-row items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <FrameTitle>Inventory stocks</FrameTitle>
          <FrameDescription className="text-pretty">
            {TAB_DESCRIPTIONS[activeTab]}
          </FrameDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() =>
            toast.success("Export", {
              description: "Demo. Download from your storage.",
            })
          }
        >
          <DownloadIcon
            data-icon="inline-start"
            className="size-4"
            aria-hidden="true"
          />
          Export
        </Button>
      </FrameHeader>

      <FramePanel className="p-0 shadow-none!">
        {/* Four tabs are wider than a phone: the row scrolls on its own rather
            than taking the page sideways with it. The scrollbar itself is
            hidden (overflow-x forces overflow-y to auto, so without this a
            one-pixel overflow paints a stray bar beside the tabs). */}
        <div className="[scrollbar-width:none] overflow-x-auto overflow-y-hidden px-(--frame-panel-header-px) pt-(--frame-panel-header-py) [&::-webkit-scrollbar]:hidden">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as StockTab)}
          >
            <TabsList variant="line" className="gap-5">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-2 px-0 pb-3 text-sm"
                >
                  <span>{tab.label}</span>
                  {/* The counts are 0 until the store read settles, so a
                      skeleton stands in rather than a wrong number. Sized to the
                      badge it replaces, so the row does not shift on load. */}
                  {productsQuery.isPending ? (
                    <Skeleton className="h-5 w-6 rounded-full" />
                  ) : (
                    <Badge
                      variant="secondary"
                      radius="full"
                      className="tabular-nums"
                    >
                      {tab.count}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <Separator />

        <StocksGrid tab={activeTab} />
      </FramePanel>
    </Frame>
  )
}
