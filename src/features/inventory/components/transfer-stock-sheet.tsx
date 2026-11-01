import { useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"

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
import { Textarea } from "@/components/ui/textarea"
import { useLocations } from "@/features/locations/queries"
import { locationName } from "@/lib/data/locations"
import {
  applyStockTransfer,
  useUpdateInventoryItem,
  validateTransfer,
  type StockRow,
} from "../queries"
import { SectionCard, STOCK_SHEET_CONTENT_CLASS } from "./stock-sheet"
import { ArrowRightIcon } from "@phosphor-icons/react"

// Move stock between two of an item's locations.
//
// There is no transfer entity: a transfer is just the on-hand set on both
// levels at once, which is what applyStockTransfer does. The movement row is
// ours, so the ledger still records who moved what.
//
// Only AVAILABLE units can move. Allocated units are committed to orders that
// ship from the source, so moving them would break those orders.

export function TransferStockSheet({
  item,
  open,
  onOpenChange,
  author,
}: {
  item: StockRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  author: { name: string; initials: string; avatar?: string }
}) {
  const { data: locations = [] } = useLocations()
  const updateItem = useUpdateInventoryItem()

  const [fromLocationId, setFromLocationId] = useState("")
  const [toLocationId, setToLocationId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [note, setNote] = useState("")

  // Sources are the locations this item actually holds stock at; destinations
  // are every other active location, including ones it has never stocked (that
  // is how a row gains a level).
  const sourceOptions = useMemo(
    () =>
      (item?.levels ?? [])
        .filter((level) => level.available > 0)
        .map((level) => ({
          value: level.locationId,
          label: `${locationName(locations, level.locationId)} · ${level.available.toLocaleString()} available`,
        })),
    [item, locations]
  )

  const destinationOptions = useMemo(
    () =>
      locations
        .filter(
          (location) => location.isActive && location.id !== fromLocationId
        )
        .map((location) => ({ value: location.id, label: location.name })),
    [locations, fromLocationId]
  )

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
      const firstWithStock =
        item.levels.find((level) => level.available > 0)?.locationId ?? ""
      setFromLocationId(firstWithStock)
      setToLocationId("")
      setQuantity("")
      setNote("")
    }
  }

  if (!item) return null

  const parsedQuantity = Number(quantity)
  const check = validateTransfer(item, {
    fromLocationId,
    toLocationId,
    quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : 0,
  })
  // Only nag once there is something to nag about: an untouched form is not an
  // error, it is just empty.
  const showError = quantity.trim() !== "" || toLocationId !== ""
  const canSubmit = check.error === null && !updateItem.isPending

  const preview =
    check.error === null
      ? applyStockTransfer(item, {
          fromLocationId,
          toLocationId,
          quantity: parsedQuantity,
          author,
        })
      : null

  const levelAfter = (locationId: string) =>
    preview?.levels.find((level) => level.locationId === locationId)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    const patch = applyStockTransfer(item, {
      fromLocationId,
      toLocationId,
      quantity: parsedQuantity,
      note,
      author,
    })
    updateItem.mutate(
      { id: item.id, patch },
      {
        onSuccess: () => {
          onOpenChange(false)
          toast.success("Stock transferred", {
            description: `${parsedQuantity.toLocaleString()} units of ${item.sku} to ${locationName(locations, toLocationId)}.`,
          })
        },
      }
    )
  }

  const hasStockToMove = sourceOptions.length > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={STOCK_SHEET_CONTENT_CLASS}>
        <SheetHeader className="border-b px-5 py-4 sm:px-6">
          <SheetTitle>Transfer stock</SheetTitle>
          <SheetDescription>
            {item.name} · <span className="font-mono">{item.sku}</span>
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4 sm:px-6">
            {!hasStockToMove ? (
              <SectionCard>
                <p className="text-center text-sm text-muted-foreground">
                  Nothing to move. Every unit of this SKU is either allocated to
                  an order or out of stock.
                </p>
              </SectionCard>
            ) : (
              <>
                <SectionCard label="Move">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-end gap-3">
                      <Field className="min-w-0 flex-1 gap-1.5">
                        <FieldLabel htmlFor="transfer-from">From</FieldLabel>
                        <Select
                          value={fromLocationId}
                          onValueChange={(value) =>
                            value && setFromLocationId(value)
                          }
                          items={sourceOptions}
                        >
                          <SelectTrigger id="transfer-from">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {sourceOptions.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>

                      <ArrowRightIcon
                        className="mb-2.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />

                      <Field className="min-w-0 flex-1 gap-1.5">
                        <FieldLabel htmlFor="transfer-to">To</FieldLabel>
                        <Select
                          value={toLocationId}
                          onValueChange={(value) =>
                            value && setToLocationId(value)
                          }
                          items={destinationOptions}
                        >
                          <SelectTrigger id="transfer-to">
                            <SelectValue placeholder="Pick a location" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {destinationOptions.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>

                    <Field className="gap-1.5">
                      <FieldLabel htmlFor="transfer-qty">Units</FieldLabel>
                      <Input
                        id="transfer-qty"
                        type="number"
                        min={1}
                        max={check.maxQuantity}
                        inputMode="numeric"
                        value={quantity}
                        placeholder="0"
                        onChange={(event) => setQuantity(event.target.value)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {check.maxQuantity.toLocaleString()} available to move.
                        Allocated units stay put: they are committed to orders
                        shipping from there.
                      </span>
                    </Field>

                    <Field className="gap-1.5">
                      <FieldLabel htmlFor="transfer-note">Note</FieldLabel>
                      <Textarea
                        id="transfer-note"
                        rows={2}
                        value={note}
                        placeholder="e.g. balancing East DC coverage"
                        onChange={(event) => setNote(event.target.value)}
                      />
                    </Field>
                  </div>
                </SectionCard>

                {preview ? (
                  <div className="flex flex-col gap-1.5 rounded-lg border border-dashed px-4 py-3 text-sm">
                    {[fromLocationId, toLocationId].map((locationId) => {
                      const after = levelAfter(locationId)
                      const before = item.levels.find(
                        (level) => level.locationId === locationId
                      )
                      return (
                        <div
                          key={locationId}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="truncate text-muted-foreground">
                            {locationName(locations, locationId)}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            <span className="text-muted-foreground">
                              {(before?.onHand ?? 0).toLocaleString()}
                            </span>
                            <span className="mx-1.5 text-muted-foreground">
                              to
                            </span>
                            <span className="font-medium text-foreground">
                              {(after?.onHand ?? 0).toLocaleString()}
                            </span>
                          </span>
                        </div>
                      )
                    })}
                    <span className="pt-1 text-xs text-muted-foreground">
                      Total on hand stays {item.onHand.toLocaleString()}: the
                      stock moved, it was not created.
                    </span>
                  </div>
                ) : showError && check.error ? (
                  <p className="text-xs text-destructive">{check.error}</p>
                ) : null}
              </>
            )}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t px-5 py-4 sm:px-6">
            <SheetClose render={<Button type="button" variant="outline" />}>
              Cancel
            </SheetClose>
            {hasStockToMove ? (
              <Button type="submit" disabled={!canSubmit}>
                {updateItem.isPending ? (
                  <Spinner data-icon="inline-start" aria-hidden="true" />
                ) : null}
                Transfer stock
              </Button>
            ) : null}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
