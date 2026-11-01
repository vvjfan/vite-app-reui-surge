import { useState, type FormEvent, type ReactElement } from "react"
import { toast } from "sonner"

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
  SheetTrigger,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  STOCK_LOCATION_KIND_LABEL,
  type StockLocation,
  type StockLocationKind,
} from "@/lib/data/locations"
import { useCreateLocation, useUpdateLocation } from "../queries"

const KIND_OPTIONS: { value: StockLocationKind; label: string }[] = (
  Object.keys(STOCK_LOCATION_KIND_LABEL) as StockLocationKind[]
).map((kind) => ({ value: kind, label: STOCK_LOCATION_KIND_LABEL[kind] }))

// Error-key -> input id, in visual order, so a blocked submit focuses the first
// field that failed rather than jumping to whichever the object happened to list.
const FIELD_ORDER: Array<[string, string]> = [["name", "location-name"]]

// Shared create + edit form for a stock location. Inventory rows reference a
// location by id, so renaming one here renames it on every row at once.
export function LocationFormSheet({
  mode,
  location,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  mode: "create" | "edit"
  location?: StockLocation
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isEdit = mode === "edit" && !!location
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen

  const createLocation = useCreateLocation()
  const updateLocation = useUpdateLocation()
  const isSubmitting = createLocation.isPending || updateLocation.isPending

  const [kind, setKind] = useState<StockLocationKind>("warehouse")
  const [isActive, setIsActive] = useState(true)

  // Inline validation state, one message per field. Errors surface under the
  // control (FieldError) and set aria-invalid, and clear as soon as the field
  // is edited, so the form corrects itself rather than nagging.
  const [errors, setErrors] = useState<Record<string, string>>({})
  function clearError(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const resetInputs1 = [open, location] as const
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
      setKind(location?.kind ?? "warehouse")
      setIsActive(location?.isActive ?? true)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    const data = new FormData(event.currentTarget)
    const name = String(data.get("name") ?? "").trim()

    // Validate every field in one pass, so all problems show at once instead of
    // one toast per attempt.
    const nextErrors: Record<string, string> = {}
    if (!name) nextErrors.name = "Name is required."

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      const firstInvalid = FIELD_ORDER.find(([key]) => nextErrors[key])
      if (firstInvalid) document.getElementById(firstInvalid[1])?.focus()
      return
    }
    setErrors({})

    const address = String(data.get("address") ?? "").trim()

    if (isEdit) {
      updateLocation.mutate(
        { id: location.id, patch: { name, address, kind, isActive } },
        {
          onSuccess: () => {
            setOpen(false)
            toast.success("Location saved", { description: name })
          },
        }
      )
      return
    }

    createLocation.mutate(
      { name, address, kind, isActive },
      {
        onSuccess: (created) => {
          setOpen(false)
          toast.success("Location created", { description: created.name })
        },
      }
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent
        side="right"
        className="z-50 flex flex-col gap-0 overflow-hidden rounded-xl bg-popover p-0 outline-none data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:left-auto data-[side=right]:h-[calc(100svh-2rem)] data-[side=right]:w-[min(30rem,calc(100vw-2rem))] data-[side=right]:max-w-none data-[side=right]:sm:max-w-none"
      >
        <SheetHeader className="border-b px-5 py-4 sm:px-6">
          <SheetTitle>{isEdit ? "Edit location" : "New location"}</SheetTitle>
          <SheetDescription>
            Locations are where stock sits. Inventory rows point at one, so a
            rename here follows them.
          </SheetDescription>
        </SheetHeader>

        <form
          key={`${location?.id ?? "new"}-${open ? "open" : "closed"}`}
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="location-name">Name</FieldLabel>
              <Input
                id="location-name"
                name="name"
                defaultValue={location?.name}
                placeholder="e.g. Berlin DC"
                autoComplete="off"
                required
                aria-invalid={!!errors.name}
                onInput={() => clearError("name")}
              />
              {errors.name ? <FieldError>{errors.name}</FieldError> : null}
            </Field>

            <Field className="gap-1.5">
              <FieldLabel htmlFor="location-kind">Type</FieldLabel>
              <Select
                value={kind}
                onValueChange={(next) => next && setKind(next)}
                items={KIND_OPTIONS}
              >
                <SelectTrigger id="location-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {KIND_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field className="gap-1.5">
              <FieldLabel htmlFor="location-address">Address</FieldLabel>
              <Input
                id="location-address"
                name="address"
                defaultValue={location?.address}
                placeholder="e.g. 500 Logistics Park, Newark, NJ"
                autoComplete="off"
              />
            </Field>

            <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  Active
                </span>
                <span className="text-sm text-muted-foreground">
                  Inactive locations keep their stock but are not offered for
                  new rows.
                </span>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked === true)}
                aria-label="Location is active"
              />
            </div>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t px-5 py-4 sm:px-6">
            <SheetClose render={<Button type="button" variant="outline" />}>
              Cancel
            </SheetClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Spinner data-icon="inline-start" aria-hidden="true" />
              ) : null}
              {isEdit ? "Save changes" : "Create location"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
