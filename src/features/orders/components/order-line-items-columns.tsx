import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import type { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { Product } from "@/lib/data/products"
import type { OrderLine } from "@/lib/data/types"
import type { OrderDraftLine, OrderDraftLineErrors } from "../order-draft"
import { formatCurrency } from "../lib/format"
import { TrashIcon as Trash2Icon } from "@phosphor-icons/react"

// The line-items grid's columns. The row is Product -> Variant -> Qty, because a
// product alone does not price anything - the variant does.
//
// Unit Price is READ-ONLY, displayed from `built` (the OrderLine that
// buildOrderLine made from the chosen variant). It is never an input:
// buildOrderLine takes the price from the variant, so a typed price would be a
// second source of truth that the saved order would silently ignore.

const PLACEHOLDER = "-"

/** A draft slot plus the OrderLine it builds into, when it resolves to one. */
export interface OrderLineRow {
  line: OrderDraftLine
  /** buildOrderLine's output for this slot; null while product/variant are unresolved. */
  built: OrderLine | null
}

export interface OrderLineColumnsContext {
  products: Product[]
  lineErrors?: Record<number, OrderDraftLineErrors>
  rowCount: number
  onProductChange: (index: number, productId: string) => void
  onVariantChange: (index: number, variantId: string) => void
  onQtyChange: (index: number, qty: string) => void
  onRemoveLine: (index: number) => void
}

/**
 * Columns are built per render rather than declared once, because every editable
 * cell needs the draft's change handlers. Index is the only identity a draft
 * line has: the id does not exist until toOrderPayload builds one.
 */
export function createOrderLineColumns({
  products,
  lineErrors,
  rowCount,
  onProductChange,
  onVariantChange,
  onQtyChange,
  onRemoveLine,
}: OrderLineColumnsContext): ColumnDef<OrderLineRow>[] {
  return [
    {
      id: "product",
      accessorFn: (row) => row.line.productId,
      header: ({ column }) => <DataGridColumnHeader column={column} />,
      cell: ({ row }) => {
        const index = row.index
        const product = products.find(
          (p) => p.id === row.original.line.productId
        )
        const errors = lineErrors?.[index]
        return (
          <div className="flex min-w-0 flex-col gap-1.5">
            <Select
              value={row.original.line.productId}
              onValueChange={(value) =>
                value && onProductChange(index, String(value))
              }
            >
              <SelectTrigger
                aria-label={`Product for line ${index + 1}`}
                aria-invalid={Boolean(errors?.productId)}
                className="min-w-0"
              >
                <SelectValue
                  className={cn(!product && "text-muted-foreground")}
                >
                  {product?.title ?? "Select product"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="w-(--anchor-width)">
                <SelectGroup>
                  {products.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldError>{errors?.productId}</FieldError>
          </div>
        )
      },
      size: 260,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: "Product",
        skeleton: <Skeleton className="h-8 w-full" />,
        headerClassName: "ps-(--frame-panel-px)",
        cellClassName: "ps-(--frame-panel-px)",
      },
    },
    {
      id: "variant",
      accessorFn: (row) => row.line.variantId,
      header: ({ column }) => <DataGridColumnHeader column={column} />,
      cell: ({ row }) => {
        const index = row.index
        const product = products.find(
          (p) => p.id === row.original.line.productId
        )
        // Only THIS product's variants: offering another product's variants is
        // the join bug validateOrderDraft rejects, so the picker cannot show
        // one in the first place.
        const variants = product?.variants ?? []
        const variant = variants.find(
          (v) => v.id === row.original.line.variantId
        )
        const errors = lineErrors?.[index]
        const rowLabel = product?.title ?? `line ${index + 1}`
        return (
          <div className="flex min-w-0 flex-col gap-1.5">
            <Select
              value={row.original.line.variantId}
              onValueChange={(value) =>
                value && onVariantChange(index, String(value))
              }
              disabled={!product}
            >
              <SelectTrigger
                aria-label={`Variant for ${rowLabel}`}
                aria-invalid={Boolean(errors?.variantId)}
                className="min-w-0"
              >
                <SelectValue
                  className={cn(!variant && "text-muted-foreground")}
                >
                  {variant?.title ??
                    (product ? "Select variant" : "Choose a product first")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="w-(--anchor-width)">
                <SelectGroup>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldError>{errors?.variantId}</FieldError>
          </div>
        )
      },
      size: 200,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: "Variant",
        skeleton: <Skeleton className="h-8 w-full" />,
      },
    },
    {
      id: "qty",
      accessorFn: (row) => row.line.qty,
      header: ({ column }) => <DataGridColumnHeader column={column} />,
      cell: ({ row }) => {
        const index = row.index
        const product = products.find(
          (p) => p.id === row.original.line.productId
        )
        const errors = lineErrors?.[index]
        const rowLabel = product?.title ?? `line ${index + 1}`
        return (
          <div className="flex flex-col gap-1.5">
            <Input
              type="number"
              min={1}
              step={1}
              value={row.original.line.qty}
              aria-label={`Quantity for ${rowLabel}`}
              aria-invalid={Boolean(errors?.qty)}
              className="w-20"
              onChange={(event) => onQtyChange(index, event.target.value)}
            />
            <FieldError>{errors?.qty}</FieldError>
          </div>
        )
      },
      size: 96,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: "Qty",
        skeleton: <Skeleton className="h-8 w-16" />,
      },
    },
    {
      id: "unitPrice",
      accessorFn: (row) => row.built?.unitPrice ?? 0,
      header: ({ column }) => <DataGridColumnHeader column={column} />,
      // Read-only: the variant prices the line, not the operator.
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {row.original.built
            ? formatCurrency(row.original.built.unitPrice)
            : PLACEHOLDER}
        </span>
      ),
      size: 128,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: "Unit price",
        skeleton: <Skeleton className="h-4 w-16" />,
      },
    },
    {
      id: "amount",
      accessorFn: (row) =>
        row.built ? row.built.unitPrice * row.built.qty : 0,
      header: ({ column }) => <DataGridColumnHeader column={column} />,
      cell: ({ row }) => (
        <span className="flex justify-end text-sm font-medium tabular-nums">
          {row.original.built
            ? formatCurrency(
                row.original.built.unitPrice * row.original.built.qty
              )
            : PLACEHOLDER}
        </span>
      ),
      size: 128,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: "Amount",
        headerClassName: "justify-end",
        skeleton: <Skeleton className="ms-auto h-4 w-20" />,
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const index = row.index
        const product = products.find(
          (p) => p.id === row.original.line.productId
        )
        const rowLabel = product?.title ?? `line ${index + 1}`
        return (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${rowLabel}`}
            // The draft always keeps a slot: removing the last one would leave
            // the operator with no row to type into.
            disabled={rowCount === 1}
            onClick={() => onRemoveLine(index)}
          >
            <Trash2Icon aria-hidden="true" />
          </Button>
        )
      },
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
