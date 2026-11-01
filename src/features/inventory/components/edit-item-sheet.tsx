import { useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/reui/badge"
import { ProductRef } from "@/components/shared/product-ref"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { useSuppliers } from "@/features/suppliers/queries"
import {
  applyItemEdit,
  useUpdateInventoryItem,
  type InventoryItemEdit,
  type StockRow,
} from "../queries"
import { statusVariant } from "./ledger-data"
import { SectionCard, STOCK_SHEET_CONTENT_CLASS } from "./stock-sheet"

// Edit the fields a stock count cannot fix. Levels (on hand / allocated) are
// deliberately absent: they move only through Adjust stock, so every quantity
// change is recorded in the movement ledger.
//
// Supplier is a Select over the Suppliers entity, not free text: a purchase
// order is raised TO a supplier, so it has to be one of the real ones. It was
// a text box until a typo could invent a filter option. New suppliers are
// created in Settings > Suppliers, the way locations are.
//
// Location and bin are absent because they belong to a level, not to the item:
// an item can sit at several locations at once, and a bin only names a shelf
// inside one of them. Stock changes location by moving, so that is Transfer's
// job.

export function EditItemSheet({
  item,
  open,
  onOpenChange,
}: {
  item: StockRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateItem = useUpdateInventoryItem()
  const { data: suppliers = [] } = useSuppliers()
  const [draft, setDraft] = useState<InventoryItemEdit | null>(null)

  // Only active suppliers are offered for new stock - but never drop the one
  // this item already has, or deactivating a supplier would silently blank the
  // Select on every row still sourcing from it.
  const supplierOptions = useMemo(
    () =>
      suppliers
        .filter((s) => s.isActive || s.id === draft?.supplierId)
        .map((s) => ({ value: s.id, label: s.name })),
    [suppliers, draft?.supplierId]
  )

  // Reload the draft whenever the sheet opens for an item, so a cancelled edit
  // never leaks into the next one.
  const resetInputs1 = [open, item] as const
  const [previousInputs1, setPreviousInputs1] = useState<
    typeof resetInputs1 | null
  >(null)
  if (
    previousInputs1 === null ||
    resetInputs1.some(
      (input, index) => !Object.is(input, previousInputs1[index])
    )
  ) {
    setPreviousInputs1(resetInputs1)

    if (open && item) {
      setDraft({
        supplierId: item.supplierId,
        reorderPoint: item.reorderPoint,
        safetyStock: item.safetyStock,
        unitCost: item.unitCost,
      })
    }
  }

  if (!item || !draft) return null

  const set = <TKey extends keyof InventoryItemEdit>(
    key: TKey,
    value: InventoryItemEdit[TKey]
  ) => setDraft((current) => (current ? { ...current, [key]: value } : current))

  const toNumber = (raw: string) => {
    const parsed = Number(raw)
    return raw.trim() === "" || !Number.isFinite(parsed) || parsed < 0
      ? 0
      : parsed
  }

  const valid = draft.supplierId !== ""

  // Raising the reorder point above `available` flips the row to Low stock and
  // pulls it into the reorder queue, so surface that before saving.
  const preview = applyItemEdit(item, draft)
  const statusChanges = preview.status !== item.status

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!valid || updateItem.isPending) return
    const patch = applyItemEdit(item, draft)
    updateItem.mutate(
      { id: item.id, patch },
      {
        onSuccess: () => {
          onOpenChange(false)
          toast.success("Item saved", { description: item.sku })
        },
      }
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={STOCK_SHEET_CONTENT_CLASS}>
        <SheetHeader className="border-b px-5 py-4 sm:px-6">
          <SheetTitle>Edit item</SheetTitle>
          <SheetDescription>
            <ProductRef
              product={{ id: item.productId, title: item.name }}
              className="font-normal text-muted-foreground"
            />{" "}
            · <span className="font-mono">{item.sku}</span>
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4 sm:px-6">
            <SectionCard label="Sourcing">
              <div className="flex flex-col gap-3">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="edit-supplier">Supplier</FieldLabel>
                  <Select
                    value={draft.supplierId}
                    onValueChange={(value) => value && set("supplierId", value)}
                    items={supplierOptions}
                  >
                    <SelectTrigger id="edit-supplier">
                      <SelectValue placeholder="Pick a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {supplierOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <p className="text-xs text-muted-foreground">
                  Stock location and bin are set per location. Use Transfer to
                  move stock between them.
                </p>
              </div>
            </SectionCard>

            <SectionCard label="Reordering">
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <Field className="flex-1 gap-1.5">
                    <FieldLabel htmlFor="edit-reorder">
                      Reorder point
                    </FieldLabel>
                    <Input
                      id="edit-reorder"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={String(draft.reorderPoint)}
                      onChange={(e) =>
                        set("reorderPoint", toNumber(e.target.value))
                      }
                    />
                  </Field>
                  <Field className="flex-1 gap-1.5">
                    <FieldLabel htmlFor="edit-safety">Safety stock</FieldLabel>
                    <Input
                      id="edit-safety"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={String(draft.safetyStock)}
                      onChange={(e) =>
                        set("safetyStock", toNumber(e.target.value))
                      }
                    />
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.available.toLocaleString()} available today. Stock
                  levels change through Adjust stock, so every movement is
                  recorded.
                </p>
              </div>
            </SectionCard>

            <SectionCard label="Cost">
              <Field className="gap-1.5">
                <FieldLabel htmlFor="edit-cost">Unit cost</FieldLabel>
                <Input
                  id="edit-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={String(draft.unitCost)}
                  onChange={(e) => set("unitCost", toNumber(e.target.value))}
                />
              </Field>
            </SectionCard>

            {statusChanges ? (
              <div className="flex items-center justify-between rounded-lg border border-dashed px-4 py-3 text-sm">
                <span className="text-muted-foreground">Status becomes</span>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant[item.status]}>
                    {item.status}
                  </Badge>
                  <span className="text-muted-foreground">to</span>
                  <Badge variant={statusVariant[preview.status!]}>
                    {preview.status}
                  </Badge>
                </div>
              </div>
            ) : null}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t px-5 py-4 sm:px-6">
            <SheetClose render={<Button type="button" variant="outline" />}>
              Cancel
            </SheetClose>
            <Button type="submit" disabled={!valid || updateItem.isPending}>
              {updateItem.isPending ? (
                <Spinner data-icon="inline-start" aria-hidden="true" />
              ) : null}
              Save changes
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
