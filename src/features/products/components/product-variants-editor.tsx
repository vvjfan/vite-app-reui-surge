import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react"
import {
  DataGrid,
  DataGridContainer,
} from "@/components/reui/data-grid/data-grid"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table"
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
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
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { ProductVariant } from "@/lib/data/products"
import { useInventoryItems } from "@/features/inventory/queries"
import {
  CopyIcon,
  DotsThreeIcon as MoreHorizontalIcon,
  PlusIcon,
  TrashIcon as Trash2Icon,
} from "@phosphor-icons/react"

// A controlled variants matrix relocated from the ReUI `data-grid-editing-2`
// block: the inline cell editors and grid are the block's; the internal
// save/discard bar, search, and status filter were removed because the parent
// product form owns saving. Rows map to `ProductVariant`; Color/Size drive the
// variant's `options` map and derived `title`.

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const NUMBER = new Intl.NumberFormat("en-US")

function validatePrice(raw: string): string | null {
  const value = raw.trim()
  if (value.length === 0) return "Price is required."
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return "Enter a valid number."
  if (parsed < 0) return "Price cannot be negative."
  if (parsed > 100000) return "Price looks too high."
  return null
}

function noValidation(): string | null {
  return null
}

// ── Option <-> variant helpers ──

function deriveTitle(color: string, size: string): string {
  const parts = [color, size].map((part) => part.trim()).filter(Boolean)
  return parts.length ? parts.join(" / ") : "Default"
}

function setVariantOption(
  variant: ProductVariant,
  key: "Color" | "Size",
  value: string
): ProductVariant {
  const options = { ...variant.options }
  if (value.trim()) options[key] = value.trim()
  else delete options[key]
  return {
    ...variant,
    options,
    title: deriveTitle(options.Color ?? "", options.Size ?? ""),
  }
}

// ── Editing state threaded through table meta ──

type VariantEditField = "color" | "size" | "sku" | "price"

interface EditingCell {
  rowId: string
  field: VariantEditField
}

interface VariantsTableMeta {
  editingCell: EditingCell | null
  startEdit: (rowId: string, field: VariantEditField) => void
  cancelEdit: () => void
  commitText: (
    rowId: string,
    field: "color" | "size" | "sku",
    value: string
  ) => void
  commitNumber: (rowId: string, field: "price", value: number) => void
  duplicateRow: (rowId: string) => void
  deleteRow: (rowId: string) => void
}

function isEditing(
  meta: VariantsTableMeta,
  rowId: string,
  field: VariantEditField
) {
  return meta.editingCell?.rowId === rowId && meta.editingCell.field === field
}

function readMeta(table: { options: { meta?: unknown } }): VariantsTableMeta {
  return table.options.meta as VariantsTableMeta
}

// ── Editable display trigger + inline editors (verbatim from the block) ──

function EditableTrigger({
  ariaLabel,
  onStart,
  className,
  children,
}: {
  ariaLabel: string
  onStart: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onStart}
      className={cn(
        "-mx-1.5 flex h-8 w-[calc(100%+0.75rem)] items-center px-1.5 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
        className
      )}
    >
      {children}
    </button>
  )
}

function CellError({ message }: { message: string }) {
  return (
    <span
      role="alert"
      className="absolute top-full left-0 z-20 mt-1 text-sm leading-none font-medium text-destructive"
    >
      {message}
    </span>
  )
}

function TextCellEditor({
  initial,
  validate,
  onCommit,
  onCancel,
  ariaLabel,
}: {
  initial: string
  validate: (value: string) => string | null
  onCommit: (value: string) => void
  onCancel: () => void
  ariaLabel: string
}) {
  const [draft, setDraft] = useState(initial)
  const error = validate(draft)

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      if (!error) onCommit(draft.trim())
    } else if (event.key === "Escape") {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="relative">
      <Input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => (error ? onCancel() : onCommit(draft.trim()))}
        aria-invalid={Boolean(error)}
        aria-label={ariaLabel}
        autoComplete="off"
        className={cn("h-8", error && "border-destructive")}
      />
      {error ? <CellError message={error} /> : null}
    </div>
  )
}

function NumberCellEditor({
  initial,
  validate,
  onCommit,
  onCancel,
  ariaLabel,
}: {
  initial: string
  validate: (value: string) => string | null
  onCommit: (value: number) => void
  onCancel: () => void
  ariaLabel: string
}) {
  const [draft, setDraft] = useState(initial)
  const error = validate(draft)

  const commit = () => {
    if (!error) onCommit(Number(draft.trim()))
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      commit()
    } else if (event.key === "Escape") {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="relative">
      <Input
        autoFocus
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => (error ? onCancel() : commit())}
        aria-invalid={Boolean(error)}
        aria-label={ariaLabel}
        autoComplete="off"
        className={cn(
          "h-8 text-right tabular-nums",
          error && "border-destructive"
        )}
      />
      {error ? <CellError message={error} /> : null}
    </div>
  )
}

// ── Variant display cells ──

function TextCell({
  variant,
  meta,
  field,
  value,
  placeholder,
}: {
  variant: ProductVariant
  meta: VariantsTableMeta
  field: "color" | "size" | "sku"
  value: string
  placeholder: string
}) {
  if (isEditing(meta, variant.id, field)) {
    return (
      <TextCellEditor
        initial={value}
        validate={noValidation}
        ariaLabel={`Edit ${field} for ${variant.title}`}
        onCommit={(next) => meta.commitText(variant.id, field, next)}
        onCancel={meta.cancelEdit}
      />
    )
  }

  return (
    <EditableTrigger
      ariaLabel={`Edit ${field} for ${variant.title}`}
      onStart={() => meta.startEdit(variant.id, field)}
      className="cursor-text"
    >
      <span
        className={cn(
          "truncate text-sm",
          value ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {value || placeholder}
      </span>
    </EditableTrigger>
  )
}

function NumberCell({
  variant,
  meta,
  field,
  display,
}: {
  variant: ProductVariant
  meta: VariantsTableMeta
  field: "price"
  display: string
}) {
  if (isEditing(meta, variant.id, field)) {
    return (
      <NumberCellEditor
        initial={String(variant[field])}
        validate={validatePrice}
        ariaLabel={`Edit ${field} for ${variant.title}`}
        onCommit={(next) => meta.commitNumber(variant.id, field, next)}
        onCancel={meta.cancelEdit}
      />
    )
  }

  return (
    <EditableTrigger
      ariaLabel={`Edit ${field} for ${variant.title}`}
      onStart={() => meta.startEdit(variant.id, field)}
      className="cursor-text justify-end"
    >
      <span className="text-sm text-foreground tabular-nums">{display}</span>
    </EditableTrigger>
  )
}

/**
 * Read-only: stock is the ledger's, summed across that sku's locations, and it
 * is moved only by an adjustment or a transfer in Inventory, so an edit here
 * would have no ledger entry to write to. A variant the ledger has never seen
 * (one added in this form, not yet stocked anywhere) holds nothing.
 */
function StockCell({ variant }: { variant: ProductVariant }) {
  const inventoryQuery = useInventoryItems()
  const row = inventoryQuery.data?.find((item) => item.sku === variant.sku)

  if (inventoryQuery.isPending) {
    return (
      <div className="flex h-8 items-center justify-end">
        <Skeleton className="h-3.5 w-10" />
      </div>
    )
  }

  return (
    <div className="flex h-8 items-center justify-end">
      <span className="text-sm text-foreground tabular-nums">
        {NUMBER.format(row?.onHand ?? 0)}
      </span>
    </div>
  )
}

function ActionsCell({
  variant,
  meta,
}: {
  variant: ProductVariant
  meta: VariantsTableMeta
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Actions for ${variant.title}`}
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => meta.duplicateRow(variant.id)}>
              <CopyIcon aria-hidden="true" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete variant?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes{" "}
              <span className="font-medium text-foreground">
                {variant.title}
              </span>{" "}
              from this product. It is saved when you save the product.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                meta.deleteRow(variant.id)
                setDeleteOpen(false)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function createVariantColumns(): ColumnDef<ProductVariant>[] {
  return [
    {
      id: "color",
      header: ({ column }) => (
        <DataGridColumnHeader title="Color" column={column} />
      ),
      cell: ({ row, table }) => (
        <TextCell
          variant={row.original}
          meta={readMeta(table)}
          field="color"
          value={row.original.options.Color ?? ""}
          placeholder="Add color"
        />
      ),
      enableSorting: false,
      minSize: 140,
      meta: { headerTitle: "Color" },
    },
    {
      id: "size",
      header: ({ column }) => (
        <DataGridColumnHeader title="Size" column={column} />
      ),
      cell: ({ row, table }) => (
        <TextCell
          variant={row.original}
          meta={readMeta(table)}
          field="size"
          value={row.original.options.Size ?? ""}
          placeholder="Add size"
        />
      ),
      enableSorting: false,
      size: 120,
      meta: { headerTitle: "Size" },
    },
    {
      id: "sku",
      header: ({ column }) => (
        <DataGridColumnHeader title="SKU" column={column} />
      ),
      cell: ({ row, table }) => (
        <TextCell
          variant={row.original}
          meta={readMeta(table)}
          field="sku"
          value={row.original.sku}
          placeholder="Add SKU"
        />
      ),
      enableSorting: false,
      size: 150,
      meta: { headerTitle: "SKU" },
    },
    {
      id: "price",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Price"
          column={column}
          className="w-full justify-end text-right"
        />
      ),
      cell: ({ row, table }) => (
        <NumberCell
          variant={row.original}
          meta={readMeta(table)}
          field="price"
          display={CURRENCY.format(row.original.price)}
        />
      ),
      enableSorting: false,
      size: 120,
      meta: { headerTitle: "Price", headerClassName: "text-right!" },
    },
    {
      id: "inventory",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Inventory"
          column={column}
          className="w-full justify-end text-right"
        />
      ),
      cell: ({ row }) => <StockCell variant={row.original} />,
      enableSorting: false,
      size: 120,
      meta: { headerTitle: "Inventory", headerClassName: "text-right!" },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row, table }) => (
        <div className="flex justify-end">
          <ActionsCell variant={row.original} meta={readMeta(table)} />
        </div>
      ),
      enableHiding: false,
      enableSorting: false,
      size: 56,
    },
  ]
}

// ── Controlled variants editor ──

export function ProductVariantsEditor({
  value,
  onChange,
}: {
  value: ProductVariant[]
  onChange: (variants: ProductVariant[]) => void
}) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const counter = useRef(0)

  const nextId = useCallback(() => {
    counter.current += 1
    return `variant-new-${counter.current}`
  }, [])

  const updateRow = useCallback(
    (rowId: string, updater: (variant: ProductVariant) => ProductVariant) => {
      onChange(value.map((row) => (row.id === rowId ? updater(row) : row)))
    },
    [onChange, value]
  )

  const startEdit = useCallback(
    (rowId: string, field: VariantEditField) =>
      setEditingCell({ rowId, field }),
    []
  )
  const cancelEdit = useCallback(() => setEditingCell(null), [])

  const commitText = useCallback(
    (rowId: string, field: "color" | "size" | "sku", text: string) => {
      updateRow(rowId, (variant) => {
        if (field === "color") return setVariantOption(variant, "Color", text)
        if (field === "size") return setVariantOption(variant, "Size", text)
        return { ...variant, sku: text.trim() }
      })
      setEditingCell(null)
    },
    [updateRow]
  )

  const commitNumber = useCallback(
    (rowId: string, field: "price", amount: number) => {
      updateRow(rowId, (variant) => ({ ...variant, [field]: amount }))
      setEditingCell(null)
    },
    [updateRow]
  )

  const addVariant = useCallback(() => {
    const id = nextId()
    onChange([
      ...value,
      // No image: the form shoots no colourways. The product editor fills it
      // from the thumbnail on save, so nothing persists with an empty src.
      { id, sku: "", title: "Default", options: {}, price: 0, image: "" },
    ])
    setEditingCell({ rowId: id, field: "color" })
  }, [nextId, onChange, value])

  const duplicateRow = useCallback(
    (rowId: string) => {
      const index = value.findIndex((row) => row.id === rowId)
      if (index === -1) return
      const source = value[index]
      const copy: ProductVariant = {
        ...source,
        id: nextId(),
        sku: source.sku ? `${source.sku}-C` : "",
      }
      const next = [...value]
      next.splice(index + 1, 0, copy)
      onChange(next)
    },
    [nextId, onChange, value]
  )

  const deleteRow = useCallback(
    (rowId: string) => {
      onChange(value.filter((row) => row.id !== rowId))
      setEditingCell((current) => (current?.rowId === rowId ? null : current))
    },
    [onChange, value]
  )

  const columns = useMemo(() => createVariantColumns(), [])
  const meta: VariantsTableMeta = {
    editingCell,
    startEdit,
    cancelEdit,
    commitText,
    commitNumber,
    duplicateRow,
    deleteRow,
  }

  const table = useReactTable({
    data: value,
    columns,
    getRowId: (row) => row.id,
    meta,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={addVariant}>
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          Add variant
        </Button>
      </div>
      <DataGrid
        table={table}
        recordCount={value.length}
        emptyMessage="No variants yet. Add one to get started."
        tableLayout={{
          dense: false,
          rowBorder: true,
          columnsVisibility: false,
          columnsResizable: false,
          columnsMovable: false,
          width: "fixed",
        }}
        tableClassNames={{
          bodyRow: "[&>td]:h-12",
          edgeCell: "first:ps-3 last:pe-3",
        }}
      >
        <DataGridContainer>
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
        </DataGridContainer>
      </DataGrid>
    </div>
  )
}
