import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/reui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
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
  useCreatePurchaseOrders,
  type PoLine,
} from "@/features/purchase-orders/queries"
import { SectionCard, STOCK_SHEET_CONTENT_CLASS } from "./stock-sheet"
import {
  PackageIcon,
  ReceiptIcon as ReceiptTextIcon,
} from "@phosphor-icons/react"

// Draft a purchase order from a set of SKUs. Persists through the purchase-order
// repository: one draft PO per supplier (a PO is single-supplier), each raised
// against the chosen receiving location. The sheet is the review step -
// quantities, delivery location, expected date, note - before the write.
export function CreatePurchaseOrderSheet({
  lines,
  open,
  onOpenChange,
  onCreated,
}: {
  lines: PoLine[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}) {
  const { data: locations = [] } = useLocations()
  const createOrders = useCreatePurchaseOrders()

  // Editable quantity per SKU, seeded from the suggestion each time the sheet
  // opens (never carried across opens, which would draft last time's numbers).
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [locationId, setLocationId] = useState("")
  const [expected, setExpected] = useState("")
  const [note, setNote] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Seed the draft from the SKUs the caller passed, once per opening.
  //
  // `locations` is deliberately not a dependency here. It arrives from a query,
  // so its array identity changes on every refetch - and any mutation that
  // invalidates locations would re-run this effect and wipe the quantities,
  // date and note the operator had already typed. (In a test, where the query
  // settles repeatedly, that same feedback loop never terminates.)
  const resetInputs1 = [open, lines] as const
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

    if (open) {
      setQuantities(
        Object.fromEntries(
          lines.map((line) => [line.sku, String(line.quantity)])
        )
      )
      setLocationId("")
      setExpected("")
      setNote("")
      setErrors({})
    }
  }

  // Default the receiving location once the locations read settles, without
  // overwriting a choice already made: a refetch must not move the operator's
  // selection out from under them.
  const resetInputs2 = [open, locations[0]?.id] as const
  const [previousInputs2, setPreviousInputs2] = useState<
    typeof resetInputs2 | null
  >(null)
  if (
    previousInputs2 === null ||
    resetInputs2.some(
      (input, index) => !Object.is(input, previousInputs2[index])
    )
  ) {
    setPreviousInputs2(resetInputs2)

    if (open) {
      setLocationId((current) => current || (locations[0]?.id ?? ""))
    }
  }

  function clearError(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function setQuantity(sku: string, value: string) {
    setQuantities((prev) => ({ ...prev, [sku]: value }))
    clearError(sku)
  }

  const suppliers = [...new Set(lines.map((line) => line.supplierName))]
  const totalUnits = lines.reduce((sum, line) => {
    const value = Number.parseInt(quantities[line.sku] ?? "", 10)
    return sum + (Number.isFinite(value) && value > 0 ? value : 0)
  }, 0)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // Every line has to order at least one unit; a zero line is a SKU that
    // should not be on the PO at all, not a valid order for none.
    const nextErrors: Record<string, string> = {}
    for (const line of lines) {
      const value = Number.parseInt(quantities[line.sku] ?? "", 10)
      if (!Number.isFinite(value) || value < 1) {
        nextErrors[line.sku] = "Order at least 1 unit."
      }
    }
    if (!locationId) nextErrors.location = "Choose a receiving location."
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      const firstQty = lines.find((line) => nextErrors[line.sku])
      if (firstQty) document.getElementById(`po-qty-${firstQty.sku}`)?.focus()
      else document.getElementById("po-location")?.focus()
      return
    }

    const drafted = lines.map((line) => ({
      ...line,
      quantity: Number.parseInt(quantities[line.sku] ?? "", 10),
    }))
    createOrders.mutate(
      {
        lines: drafted,
        locationId,
        expectedDate: expected || undefined,
        note,
      },
      {
        onSuccess: (orders) => {
          const supplierLabel =
            orders.length === 1
              ? drafted[0].supplierName
              : `${orders.length} suppliers`
          toast.success(
            orders.length === 1
              ? `${orders[0].id} drafted`
              : `${orders.length} draft POs created`,
            {
              description: `${lines.length} SKU${lines.length === 1 ? "" : "s"} · ${totalUnits.toLocaleString()} units for ${supplierLabel}.`,
            }
          )
          onCreated?.()
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={STOCK_SHEET_CONTENT_CLASS}>
        <SheetHeader className="border-b px-5 py-4 sm:px-6">
          <SheetTitle>Create purchase order</SheetTitle>
          <SheetDescription>
            {lines.length} SKU{lines.length === 1 ? "" : "s"} ·{" "}
            {suppliers.length === 1
              ? suppliers[0]
              : `${suppliers.length} suppliers`}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4 sm:px-6">
            <SectionCard label="Items">
              <div className="flex flex-col gap-3">
                {lines.map((line) => (
                  <div key={line.sku} className="flex items-start gap-3">
                    {line.thumbnail ? (
                      <img
                        src={line.thumbnail}
                        alt=""
                        loading="lazy"
                        className="size-9 shrink-0 rounded-md border object-cover"
                      />
                    ) : (
                      <div
                        className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground"
                        aria-hidden="true"
                      >
                        <PackageIcon className="size-4" />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-foreground">
                        {line.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-mono text-xs text-muted-foreground">
                          {line.sku}
                        </span>
                        {suppliers.length > 1 ? (
                          <Badge variant="secondary" className="shrink-0">
                            {line.supplierName}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <Field className="w-24 shrink-0 gap-1.5">
                      <Input
                        id={`po-qty-${line.sku}`}
                        type="number"
                        min={1}
                        inputMode="numeric"
                        aria-label={`Order quantity for ${line.name}`}
                        aria-invalid={!!errors[line.sku]}
                        value={quantities[line.sku] ?? ""}
                        onChange={(event) =>
                          setQuantity(line.sku, event.target.value)
                        }
                        className="text-right tabular-nums"
                      />
                      {errors[line.sku] ? (
                        <FieldError>{errors[line.sku]}</FieldError>
                      ) : null}
                    </Field>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard label="Details">
              <div className="flex flex-col gap-3">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="po-location">Receive into</FieldLabel>
                  <Select
                    value={locationId}
                    onValueChange={(value) => {
                      if (value) setLocationId(value)
                      clearError("location")
                    }}
                  >
                    <SelectTrigger
                      id="po-location"
                      className="w-full"
                      aria-invalid={!!errors.location}
                    >
                      <SelectValue placeholder="Pick a location">
                        {locationId
                          ? locationName(locations, locationId)
                          : "Pick a location"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {errors.location ? (
                    <FieldError>{errors.location}</FieldError>
                  ) : null}
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="po-expected">
                    Expected delivery
                  </FieldLabel>
                  <Input
                    id="po-expected"
                    type="date"
                    value={expected}
                    onChange={(event) => setExpected(event.target.value)}
                  />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="po-note">Note</FieldLabel>
                  <Textarea
                    id="po-note"
                    rows={2}
                    value={note}
                    placeholder="e.g. rush order, split shipment accepted"
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>
              </div>
            </SectionCard>

            <div className="flex items-center justify-between rounded-lg border border-dashed px-4 py-3 text-sm">
              <span className="text-muted-foreground">Total units</span>
              <span className="font-medium text-foreground tabular-nums">
                {totalUnits.toLocaleString()}
              </span>
            </div>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t px-5 py-4 sm:px-6">
            <SheetClose render={<Button type="button" variant="outline" />}>
              Cancel
            </SheetClose>
            <Button type="submit" disabled={createOrders.isPending}>
              {createOrders.isPending ? (
                <Spinner data-icon="inline-start" aria-hidden="true" />
              ) : (
                <ReceiptTextIcon data-icon="inline-start" aria-hidden="true" />
              )}
              Create draft PO
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
