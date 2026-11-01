import { omitKeys } from "@/lib/omit-keys"
import { memo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { CategoryRef } from "@/components/shared/category-ref"
import { ProductRef } from "@/components/shared/product-ref"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { Badge } from "@/components/reui/badge"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import {
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/reui/data-grid/data-grid-table"
import type { ColumnDef, Row } from "@tanstack/react-table"
import { toast } from "sonner"

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
import { Skeleton } from "@/components/ui/skeleton"
import {
  productPriceRange,
  productVariantCount,
  type Product,
  type ProductStatus,
} from "@/lib/data/products"
import { type StockRow } from "@/features/inventory/queries"
import { formatCurrency } from "../lib/format"
import { useCreateProduct, useDeleteProduct } from "../queries"
import {
  DotsThreeIcon as MoreHorizontalIcon,
  PencilIcon,
  CopyIcon,
  CopySimpleIcon as CopyPlusIcon,
  TrashIcon as Trash2Icon,
} from "@phosphor-icons/react"

// ── Status badge ──

export const StatusBadge = memo(function StatusBadge({
  status,
}: {
  status: ProductStatus
}) {
  if (status === "active") return <Badge variant="success-light">Active</Badge>
  if (status === "scheduled")
    return <Badge variant="info-light">Scheduled</Badge>
  return <Badge variant="secondary">Draft</Badge>
})

function formatPriceRange(product: Product): string {
  const { min, max } = productPriceRange(product)
  return min === max
    ? formatCurrency(min)
    : `${formatCurrency(min)} - ${formatCurrency(max)}`
}

// ── Stock ──

/**
 * Each product's total on hand, summed from the ledger's per-variant rows.
 *
 * Built once for the grid rather than per cell, because the sort accessor needs
 * the same number the cell shows and is handed the row alone - it cannot read a
 * query. `undefined` means the ledger has not resolved yet, which is why this is
 * a map rather than a defaulted-to-zero lookup: a product with no stock and a
 * product whose stock is still loading are different states, and only the second
 * one gets a skeleton.
 */
export function stockByProduct(
  rows: StockRow[] | undefined
): Map<string, number> | undefined {
  if (!rows) return undefined
  const totals = new Map<string, number>()
  for (const row of rows) {
    totals.set(row.productId, (totals.get(row.productId) ?? 0) + row.onHand)
  }
  return totals
}

/**
 * Stock comes from the ledger, one row per variant sku, summed across the
 * product's variants. The product itself carries no stock scalar, so this is a
 * second read: the variant count paints immediately, the total waits for the
 * ledger like every other consumer of the store.
 */
function ProductStockCell({
  product,
  totals,
}: {
  product: Product
  totals: Map<string, number> | undefined
}) {
  const stock = totals?.get(product.id) ?? 0
  const variants = productVariantCount(product)

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {totals === undefined ? (
        <Skeleton className="h-3.5 w-20" />
      ) : (
        <span
          className={
            stock === 0
              ? "text-sm font-medium text-destructive"
              : "text-sm font-medium text-foreground tabular-nums"
          }
        >
          {stock === 0 ? "Out of stock" : `${stock} in stock`}
        </span>
      )}
      <span className="truncate text-xs text-muted-foreground">
        {variants} {variants === 1 ? "variant" : "variants"}
      </span>
    </div>
  )
}

// ── Row actions ──

export function ActionsCell({ row }: { row: Row<Product> }) {
  const { copyToClipboard } = useCopyToClipboard()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const product = row.original
  const createProduct = useCreateProduct()
  const deleteProduct = useDeleteProduct()

  const handleCopyHandle = () => {
    copyToClipboard(product.id)
    toast.success("Handle copied", { description: product.id })
  }

  const handleDuplicate = () => {
    const rest = omitKeys(product, ["id"])
    createProduct.mutate(
      { ...rest, title: `${product.title} (copy)`, status: "draft" },
      {
        onSuccess: (created) =>
          toast.success("Product duplicated", {
            description: `${created.title} created as a draft.`,
          }),
      }
    )
  }

  const handleDeleteConfirm = () => {
    setDeleteOpen(false)
    deleteProduct.mutate(product.id, {
      onSuccess: () =>
        toast.success("Product deleted", { description: product.title }),
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Product actions"
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start" className="min-w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <Link
                  to="/products/$productId"
                  params={{ productId: product.id }}
                />
              }
            >
              <PencilIcon className="size-4" aria-hidden="true" />
              Edit product
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyHandle}>
              <CopyIcon className="size-4" aria-hidden="true" />
              Copy handle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicate}>
              <CopyPlusIcon className="size-4" aria-hidden="true" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon className="size-4" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes{" "}
              <span className="font-medium text-foreground">
                {product.title}
              </span>{" "}
              and all its variants from the catalog. Wire to your commerce
              backend.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep product</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              Delete product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Columns ──

// The category cell resolves each product's category name to its id (the route
// param) to link it. That lookup is passed through the table meta, not closed
// over the column defs, so the columns stay referentially stable while the
// Categories query settles: a churning column list would remount every row on
// every render. Mirrors the reviews grid, which resolves products and customers
// the same way.
export type ProductsTableMeta = {
  categoryIdByName: Map<string, string>
}

/**
 * The grid's columns. A factory rather than a constant because the Inventory
 * column sorts on a number the Product does not carry: the totals have to be
 * closed over so the accessor and the cell read one source.
 */
export function createProductColumns(
  totals: Map<string, number> | undefined
): ColumnDef<Product>[] {
  return [
    {
      accessorKey: "id",
      id: "id",
      header: () => <DataGridTableRowSelectAll />,
      cell: ({ row }) => (
        <span
          className="flex items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <DataGridTableRowSelect row={row} />
        </span>
      ),
      enableSorting: false,
      size: 35,
      enableResizing: false,
      enableHiding: false,
      meta: {
        skeleton: <Skeleton className="size-4 rounded" />,
        headerClassName: "ps-(--frame-panel-px)",
        cellClassName: "ps-(--frame-panel-px)",
      },
    },
    {
      accessorFn: (row) => row.title,
      id: "product",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <img
            src={row.original.thumbnail}
            alt=""
            loading="lazy"
            className="size-9 shrink-0 rounded-md border object-cover"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <ProductRef
              product={{ id: row.original.id, title: row.original.title }}
            />
            <span className="truncate text-xs text-muted-foreground">
              {row.original.vendor}
            </span>
          </div>
        </div>
      ),
      minSize: 200,
      enableSorting: true,
      enableHiding: true,
      enableResizing: true,
      meta: {
        headerTitle: "Product",
        skeleton: (
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <Skeleton className="h-3.5 w-40" />
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
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row, table }) => {
        // The product carries its category by name; the id (route param) is
        // resolved through the table meta. A name with no match stays text.
        const meta = table.options.meta as ProductsTableMeta | undefined
        const categoryId = meta?.categoryIdByName.get(row.original.category)
        return (
          <CategoryRef
            category={{ name: row.original.category, id: categoryId ?? null }}
          />
        )
      },
      size: 130,
      enableSorting: true,
      enableHiding: true,
      enableResizing: true,
      meta: {
        headerTitle: "Category",
        skeleton: <Skeleton className="h-4 w-20" />,
      },
    },
    {
      // Sorts on the ledger total the cell renders, so the header's sort control
      // orders by stock as it always has. A product still loading its stock sorts
      // as 0 for that frame; it cannot sort by a number nobody has yet.
      accessorFn: (row) => totals?.get(row.id) ?? 0,
      id: "inventory",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => (
        <ProductStockCell product={row.original} totals={totals} />
      ),
      size: 130,
      enableSorting: true,
      enableHiding: true,
      enableResizing: true,
      meta: {
        headerTitle: "Inventory",
        skeleton: (
          <div className="flex flex-col gap-0.5">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ),
      },
    },
    {
      accessorFn: (row) => productPriceRange(row).min,
      id: "price",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {formatPriceRange(row.original)}
        </span>
      ),
      size: 140,
      enableSorting: true,
      enableHiding: true,
      meta: {
        headerTitle: "Price",
        skeleton: <Skeleton className="h-4 w-24" />,
      },
    },
    {
      accessorFn: (row) => row.status,
      id: "status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} visibility={true} />
      ),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      size: 110,
      enableSorting: true,
      enableHiding: true,
      enableResizing: false,
      meta: {
        headerTitle: "Status",
        skeleton: <Skeleton className="h-5 w-20 rounded-sm" />,
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <ActionsCell row={row} />
        </div>
      ),
      size: 50,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: {
        skeleton: <Skeleton className="size-7 rounded" />,
        headerClassName:
          "[--data-grid-header-cell-pe:var(--frame-panel-header-px)]",
        cellClassName: "[--data-grid-body-cell-pe:var(--frame-panel-px)]",
      },
    },
  ]
}
