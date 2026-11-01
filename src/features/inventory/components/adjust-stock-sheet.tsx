import { useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"

import { USER } from "@/components/shared/app-shell/data"
import { Badge } from "@/components/reui/badge"
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
import { sumLevels, type MovementKind } from "@/lib/data/inventory"
import { locationName } from "@/lib/data/locations"
import { useLocations } from "@/features/locations/queries"
import {
  applyStockAdjustment,
  useUpdateInventoryItem,
  type StockAdjustMode,
  type StockRow,
} from "../queries"
import { statusVariant } from "./ledger-data"
import { SectionCard, STOCK_SHEET_CONTENT_CLASS } from "./stock-sheet"

const MODE_OPTIONS: { value: StockAdjustMode; label: string }[] = [
  { value: "add", label: "Add stock" },
  { value: "remove", label: "Remove stock" },
  { value: "set", label: "Set on-hand" },
]

const REASON_OPTIONS: { value: MovementKind; label: string }[] = [
  { value: "Restock", label: "Restock" },
  { value: "Adjustment", label: "Adjustment" },
  { value: "Sale", label: "Sale" },
  { value: "Transfer", label: "Transfer" },
]

// A sensible movement reason for each mode; the user can still override it.
const DEFAULT_REASON: Record<StockAdjustMode, MovementKind> = {
  add: "Restock",
  remove: "Sale",
  set: "Adjustment",
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground tabular-nums">
        {value}
      </span>
    </div>
  )
}

export function AdjustStockSheet({
  item,
  open,
  onOpenChange,
}: {
  item: StockRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const adjustStock = useUpdateInventoryItem()
  const { data: locations = [] } = useLocations()
  const [mode, setMode] = useState<StockAdjustMode>("add")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState<MovementKind>("Restock")
  const [note, setNote] = useState("")
  // An adjustment counts stock at ONE location, so the form always names one.
  const [locationId, setLocationId] = useState("")

  // Reset the form each time the sheet opens for a fresh item. The location
  // starts where the row reads as sitting, which is the one being counted in
  // the overwhelming majority of adjustments.
  const resetInputs1 = [open, item?.id] as const
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
      setMode("add")
      setQuantity("")
      setReason("Restock")
      setNote("")
      setLocationId(item.primaryLocationId)
    }
  }

  const qty = Number(quantity)
  const validQty = quantity.trim() !== "" && Number.isFinite(qty) && qty >= 0

  // Live preview of the result, computed with the exact helper the mutation uses.
  const preview = useMemo(() => {
    if (!item || !validQty || !locationId) return null
    return applyStockAdjustment(item, {
      locationId,
      mode,
      quantity: qty,
      reason,
      author: USER,
    })
  }, [item, validQty, locationId, mode, qty, reason])

  if (!item) return null

  // The counted level, before and after. The adjustment lands on this one
  // location, so the preview reads it rather than the item's summed total.
  const currentOnHand =
    item.levels.find((l) => l.locationId === locationId)?.onHand ?? 0
  const previewLevel = preview?.levels.find((l) => l.locationId === locationId)

  // Each option carries its own on-hand: picking a location is really picking
  // the count you are about to correct.
  const locationItems = item.levels.map((level) => ({
    value: level.locationId,
    label: `${locationName(locations, level.locationId)} · ${level.onHand.toLocaleString()} on hand`,
  }))
  const multiLocation = item.levels.length > 1

  const handleModeChange = (next: StockAdjustMode) => {
    setMode(next)
    setReason(DEFAULT_REASON[next])
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validQty || !locationId || adjustStock.isPending) return
    const patch = applyStockAdjustment(item, {
      locationId,
      mode,
      quantity: qty,
      reason,
      note: note.trim() || undefined,
      author: USER,
    })
    const nextOnHand =
      patch.levels.find((l) => l.locationId === locationId)?.onHand ?? 0
    if (nextOnHand === currentOnHand) {
      toast.message("No change", {
        description: "On-hand is already that count.",
      })
      return
    }
    adjustStock.mutate(
      { id: item.id, patch },
      {
        onSuccess: (updated) => {
          onOpenChange(false)
          toast.success("Stock adjusted", {
            description: `${item.sku} · on-hand now ${sumLevels(
              updated.levels,
              (l) => l.onHand
            ).toLocaleString()}`,
          })
        },
      }
    )
  }

  const delta = previewLevel ? previewLevel.onHand - currentOnHand : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={STOCK_SHEET_CONTENT_CLASS}>
        <SheetHeader className="border-b px-5 py-4 sm:px-6">
          <SheetTitle>Adjust stock</SheetTitle>
          <SheetDescription>
            {item.name} · <span className="font-mono">{item.sku}</span>
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4 sm:px-6">
            {/* Current levels, summed across every location the item sits in. */}
            <SectionCard>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="On hand" value={item.onHand.toLocaleString()} />
                <Stat
                  label="Allocated"
                  value={item.allocated.toLocaleString()}
                />
                <Stat
                  label="Available"
                  value={item.available.toLocaleString()}
                />
              </div>
            </SectionCard>

            <SectionCard label="Adjustment">
              <div className="flex flex-col gap-3">
                {/* Where the count is happening. Only the item's own levels are
                    offered: an adjustment counts stock already somewhere. */}
                <Field className="gap-1.5">
                  <FieldLabel
                    htmlFor={multiLocation ? "adjust-location" : undefined}
                  >
                    Location
                  </FieldLabel>
                  {multiLocation ? (
                    <Select
                      value={locationId}
                      onValueChange={(next) => next && setLocationId(next)}
                      items={locationItems}
                    >
                      <SelectTrigger id="adjust-location">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {locationItems.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  ) : (
                    // A one-option picker is noise, so the only location is stated.
                    <span className="text-sm text-foreground">
                      {locationName(locations, locationId)}
                    </span>
                  )}
                </Field>

                <div className="flex gap-3">
                  <Field className="flex-1 gap-1.5">
                    <FieldLabel htmlFor="adjust-mode">Action</FieldLabel>
                    <Select
                      value={mode}
                      onValueChange={(next) => handleModeChange(next ?? "add")}
                      items={MODE_OPTIONS}
                    >
                      <SelectTrigger id="adjust-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {MODE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field className="w-28 gap-1.5">
                    <FieldLabel htmlFor="adjust-qty">
                      {mode === "set" ? "New on-hand" : "Quantity"}
                    </FieldLabel>
                    <Input
                      id="adjust-qty"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0"
                      autoComplete="off"
                    />
                  </Field>
                </div>

                <Field className="gap-1.5">
                  <FieldLabel htmlFor="adjust-reason">Reason</FieldLabel>
                  <Select
                    value={reason}
                    onValueChange={(next) => setReason(next ?? "Adjustment")}
                    items={REASON_OPTIONS}
                  >
                    <SelectTrigger id="adjust-reason">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {REASON_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field className="gap-1.5">
                  <FieldLabel htmlFor="adjust-note">Note (optional)</FieldLabel>
                  <Input
                    id="adjust-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. PO #4218 received, cycle count..."
                    autoComplete="off"
                  />
                </Field>
              </div>
            </SectionCard>

            {/* Result preview. On-hand is the counted LOCATION's, while available
                and status are the item's across every location, which is what the
                grid and the reorder queue will show. */}
            {preview && previewLevel ? (
              <div className="flex items-center justify-between rounded-lg border border-dashed px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {multiLocation ? "New on-hand here" : "New on-hand"}
                  </span>
                  <span className="font-medium text-foreground tabular-nums">
                    {previewLevel.onHand.toLocaleString()}
                  </span>
                  {delta !== 0 ? (
                    <Badge
                      variant={
                        delta > 0 ? "success-light" : "destructive-light"
                      }
                      className="tabular-nums"
                    >
                      {delta > 0 ? "+" : ""}
                      {delta.toLocaleString()}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {Math.max(
                      0,
                      sumLevels(preview.levels, (l) => l.onHand) -
                        item.allocated
                    ).toLocaleString()}
                  </span>
                  <Badge variant={statusVariant[preview.status]}>
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
            <Button
              type="submit"
              disabled={!validQty || !locationId || adjustStock.isPending}
            >
              {adjustStock.isPending ? (
                <Spinner data-icon="inline-start" aria-hidden="true" />
              ) : null}
              Save adjustment
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
