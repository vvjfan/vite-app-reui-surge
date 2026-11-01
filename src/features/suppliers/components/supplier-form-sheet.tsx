import { useState, type FormEvent, type ReactElement } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import type { Supplier } from "@/lib/data/suppliers"
import { useCreateSupplier, useUpdateSupplier } from "../queries"

// Shared with the rest of the admin forms: a pragmatic email shape check (not
// RFC-complete, just enough to catch a typo before it is stored).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Error-key -> input id, in visual order, so a blocked submit focuses the first
// field that failed rather than jumping to whichever the object happened to list.
const FIELD_ORDER: Array<[string, string]> = [
  ["name", "supplier-name"],
  ["contactEmail", "supplier-email"],
]

// Shared create + edit form for a supplier. Inventory rows reference a supplier
// by id, so renaming one here renames it on every row at once.
export function SupplierFormSheet({
  mode,
  supplier,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  mode: "create" | "edit"
  supplier?: Supplier
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isEdit = mode === "edit" && !!supplier
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen

  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()
  const isSubmitting = createSupplier.isPending || updateSupplier.isPending

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

  const resetInputs1 = [open, supplier] as const
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
      setIsActive(supplier?.isActive ?? true)
      // Drop any messages from a prior open: this component stays mounted, so
      // stale errors would otherwise greet the next opener.
      setErrors({})
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    const data = new FormData(event.currentTarget)
    const name = String(data.get("name") ?? "").trim()
    const contactEmail = String(data.get("contactEmail") ?? "").trim()

    // Validate every field in one pass, so all problems show at once instead of
    // one toast per attempt. The contact email is optional, so it is only shape-
    // checked when the field carries a value.
    const nextErrors: Record<string, string> = {}
    if (!name) nextErrors.name = "Name is required."
    if (contactEmail && !EMAIL_RE.test(contactEmail))
      nextErrors.contactEmail = "Enter a valid email address."

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      const firstInvalid = FIELD_ORDER.find(([key]) => nextErrors[key])
      if (firstInvalid) document.getElementById(firstInvalid[1])?.focus()
      return
    }
    setErrors({})

    if (isEdit) {
      updateSupplier.mutate(
        { id: supplier.id, patch: { name, contactEmail, isActive } },
        {
          onSuccess: () => {
            setOpen(false)
            toast.success("Supplier saved", { description: name })
          },
        }
      )
      return
    }

    createSupplier.mutate(
      { name, contactEmail, isActive },
      {
        onSuccess: (created) => {
          setOpen(false)
          toast.success("Supplier created", { description: created.name })
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
          <SheetTitle>{isEdit ? "Edit supplier" : "New supplier"}</SheetTitle>
          <SheetDescription>
            Suppliers are who you buy stock from. Inventory rows point at one,
            so a rename here follows them.
          </SheetDescription>
        </SheetHeader>

        <form
          key={`${supplier?.id ?? "new"}-${open ? "open" : "closed"}`}
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="supplier-name">Name</FieldLabel>
              <Input
                id="supplier-name"
                name="name"
                defaultValue={supplier?.name}
                placeholder="e.g. Meridian Distribution"
                autoComplete="off"
                required
                aria-invalid={!!errors.name}
                onInput={() => clearError("name")}
              />
              {errors.name ? <FieldError>{errors.name}</FieldError> : null}
            </Field>

            <Field className="gap-1.5">
              <FieldLabel htmlFor="supplier-email">Contact email</FieldLabel>
              <Input
                id="supplier-email"
                name="contactEmail"
                type="email"
                defaultValue={supplier?.contactEmail}
                placeholder="e.g. orders@meridian-dist.example.com"
                autoComplete="off"
                aria-invalid={!!errors.contactEmail}
                onInput={() => clearError("contactEmail")}
              />
              {errors.contactEmail ? (
                <FieldError>{errors.contactEmail}</FieldError>
              ) : null}
            </Field>

            <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  Active
                </span>
                <span className="text-sm text-muted-foreground">
                  Inactive suppliers keep the rows they source but are not
                  offered for new stock.
                </span>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked === true)}
                aria-label="Supplier is active"
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
              {isEdit ? "Save changes" : "Create supplier"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
