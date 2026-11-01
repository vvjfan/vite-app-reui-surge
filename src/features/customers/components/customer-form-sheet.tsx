import { useState, type FormEvent, type ReactElement } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@/components/reui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { CITIES } from "@/lib/data/commerce"
import type { Customer } from "@/lib/data/types"
import {
  customerGroupsListQuery,
  useCreateCustomer,
  useUpdateCustomer,
} from "../queries"

// Shared create + edit form for a customer. Optimistic through the repo seam;
// the id (handle) is derived from the name by the demo adapter, never entered.
//
// City is required here, though `Customer.location` is optional on the type.
// Those are not in conflict: the type has to tolerate a backend that holds a
// customer who never gave an address, while THIS form is the admin's own create
// path and a customer entered here is one you intend to ship to. It is also the
// only place an address can be set at all - there is no separate address book -
// so leaving it out is what made a created customer permanently unorderable:
// the order editor drops a customer with no location, so the picker offered
// nothing while the customer sat in the grid.
//
// The city is chosen from CITIES rather than typed, because an order's
// destination is that city's address template (see destinationFor). A typed city
// resolves to no template and the order cannot ship.

// Shared with the rest of the admin forms: a pragmatic email shape check (not
// RFC-complete, just enough to catch a typo before it is stored).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Error-key -> input id, in visual order, so a blocked submit focuses the first
// field that failed rather than jumping to whichever the object happened to list.
const FIELD_ORDER: Array<[string, string]> = [
  ["name", "customer-name"],
  ["email", "customer-email"],
  ["city", "customer-city"],
]

export function CustomerFormSheet({
  mode,
  customer,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onCreated,
}: {
  mode: "create" | "edit"
  customer?: Customer
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onCreated?: (customer: Customer) => void
}) {
  const isEdit = mode === "edit" && !!customer
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent
        side="right"
        className="z-50 flex flex-col gap-0 overflow-hidden rounded-xl bg-popover p-0 outline-none data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:left-auto data-[side=right]:h-[calc(100svh-2rem)] data-[side=right]:w-[min(30rem,calc(100vw-2rem))] data-[side=right]:max-w-none data-[side=right]:sm:max-w-none"
      >
        <SheetHeader className="border-b px-5 py-4 sm:px-6">
          <SheetTitle>{isEdit ? "Edit customer" : "New customer"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update contact details and group membership."
              : "Add a customer. The handle is derived from the name."}
          </SheetDescription>
        </SheetHeader>

        {/* The fields live in here, BELOW SheetContent, which unmounts when the
            sheet closes - so closing it discards the draft rather than leaving
            it for whoever opens next.

            That is the whole reason this is its own component. The state used to
            sit on CustomerFormSheet, which stays mounted, and the reset key sat
            on the <form>, where it reset the DOM inputs and nothing else. Fields
            held in React state - the city, the account toggle, the group
            checkboxes - survived a close: picking a city, cancelling, and
            reopening carried that city onto the next customer, who was then
            stored with an address nobody chose for them and would have had
            orders shipped to it. State that must not outlive the sheet has to
            sit inside the thing that unmounts with it.

            The key is for the OTHER reset: editing customer A and then customer
            B through one mounted sheet, where nothing unmounts in between. */}
        <CustomerForm
          key={customer?.id ?? "new"}
          isEdit={isEdit}
          customer={customer}
          onDone={() => setOpen(false)}
          onCreated={onCreated}
        />
      </SheetContent>
    </Sheet>
  )
}

function CustomerForm({
  isEdit,
  customer,
  onDone,
  onCreated,
}: {
  isEdit: boolean
  customer?: Customer
  onDone: () => void
  onCreated?: (customer: Customer) => void
}) {
  const groupsQuery = useQuery(customerGroupsListQuery())
  const groups = groupsQuery.data ?? []
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const isSubmitting = createCustomer.isPending || updateCustomer.isPending

  const [hasAccount, setHasAccount] = useState(customer?.hasAccount ?? true)
  const [selectedGroups, setSelectedGroups] = useState<string[]>(
    customer?.groups ?? []
  )
  const [city, setCity] = useState(customer?.location?.city ?? "")
  const selectedCity = CITIES.find((entry) => entry.city === city)

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

  function toggleGroup(id: string, checked: boolean) {
    setSelectedGroups((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((g) => g !== id)
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    const data = new FormData(event.currentTarget)
    const name = String(data.get("name") ?? "").trim()
    const email = String(data.get("email") ?? "").trim()
    const phone = String(data.get("phone") ?? "").trim() || undefined
    const company = String(data.get("company") ?? "").trim() || undefined

    // Validate every field in one pass, so all problems show at once instead of
    // one toast per attempt. City is resolved from CITIES, not trusted from
    // state: it has to carry a countryCode and an address template, and only the
    // list has those.
    const nextErrors: Record<string, string> = {}
    if (!name) nextErrors.name = "Name is required."
    if (!email) nextErrors.email = "Email is required."
    else if (!EMAIL_RE.test(email))
      nextErrors.email = "Enter a valid email address."
    if (!selectedCity) nextErrors.city = "Select a city so orders can ship."

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      const firstInvalid = FIELD_ORDER.find(([key]) => nextErrors[key])
      if (firstInvalid) document.getElementById(firstInvalid[1])?.focus()
      return
    }
    setErrors({})

    // Guaranteed by the city check above; narrowed here for the type system.
    if (!selectedCity) return
    const location = {
      city: selectedCity.city,
      countryCode: selectedCity.countryCode,
    }

    if (isEdit && customer) {
      updateCustomer.mutate(
        {
          id: customer.id,
          patch: {
            name,
            email,
            phone,
            company,
            hasAccount,
            groups: selectedGroups,
            location,
          },
        },
        {
          onSuccess: () => {
            onDone()
            toast.success("Customer saved", { description: name })
          },
        }
      )
      return
    }

    createCustomer.mutate(
      {
        name,
        email,
        phone,
        company,
        hasAccount,
        groups: selectedGroups,
        location,
        createdAt: new Date().toISOString(),
      },
      {
        onSuccess: (created) => {
          // No field resets here: closing the sheet remounts this component, so
          // the next open builds its state from scratch.
          onDone()
          toast.success("Customer created", { description: created.name })
          onCreated?.(created)
        },
      }
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="customer-name">Name</FieldLabel>
          <Input
            id="customer-name"
            name="name"
            defaultValue={customer?.name}
            placeholder="e.g. Avery Chen"
            autoComplete="off"
            required
            aria-invalid={!!errors.name}
            onInput={() => clearError("name")}
          />
          {errors.name ? <FieldError>{errors.name}</FieldError> : null}
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="customer-email">Email</FieldLabel>
          <Input
            id="customer-email"
            name="email"
            type="email"
            defaultValue={customer?.email}
            placeholder="name@example.com"
            autoComplete="off"
            required
            aria-invalid={!!errors.email}
            onInput={() => clearError("email")}
          />
          {errors.email ? <FieldError>{errors.email}</FieldError> : null}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field className="gap-1.5">
            <FieldLabel htmlFor="customer-phone">Phone</FieldLabel>
            <Input
              id="customer-phone"
              name="phone"
              defaultValue={customer?.phone}
              placeholder="Optional"
              autoComplete="off"
            />
          </Field>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="customer-company">Company</FieldLabel>
            <Input
              id="customer-company"
              name="company"
              defaultValue={customer?.company}
              placeholder="Optional"
              autoComplete="off"
            />
          </Field>
        </div>

        <Field className="gap-1.5">
          <FieldLabel htmlFor="customer-city">City</FieldLabel>
          {/* `null` is how the Select reports a cleared value; "" is this
                  form's unselected state, which `selectedCity` reads as unset. */}
          <Select
            value={city}
            onValueChange={(value) => {
              setCity(value ?? "")
              clearError("city")
            }}
          >
            <SelectTrigger
              id="customer-city"
              className="w-full"
              aria-invalid={!!errors.city}
            >
              {/* Prompt rendered here rather than through `placeholder`, so
                      the unselected state matches the order editor's pickers. */}
              <SelectValue
                className={cn(
                  "truncate",
                  !selectedCity && "text-muted-foreground"
                )}
              >
                {selectedCity
                  ? `${selectedCity.city}, ${selectedCity.countryCode}`
                  : "Select city"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="w-(--anchor-width)">
              <SelectGroup>
                {CITIES.map((entry) => (
                  <SelectItem key={entry.city} value={entry.city}>
                    {entry.city}, {entry.countryCode}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldDescription>
            Where orders to this customer ship. Required before they can be
            ordered from.
          </FieldDescription>
          {errors.city ? <FieldError>{errors.city}</FieldError> : null}
        </Field>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="customer-account" className="text-sm font-medium">
              Registered account
            </Label>
            <span className="text-sm text-muted-foreground">
              Off marks the customer as a guest.
            </span>
          </div>
          <Switch
            id="customer-account"
            checked={hasAccount}
            onCheckedChange={setHasAccount}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Groups</span>
          {groupsQuery.isPending ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            // Without this the label heads a blank gap. Groups are managed on
            // their own page, so say where to make one rather than offering
            // nothing to tick.
            <p className="text-sm text-muted-foreground">
              No groups yet. Create one on the Groups page to start segmenting
              customers.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {groups.map((group) => (
                <label
                  key={group.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={selectedGroups.includes(group.id)}
                    onCheckedChange={(checked) =>
                      toggleGroup(group.id, checked === true)
                    }
                  />
                  <Badge variant="secondary" className="shrink-0">
                    {group.name}
                  </Badge>
                  <span className="truncate text-sm text-muted-foreground">
                    {group.description}
                  </span>
                </label>
              ))}
            </div>
          )}
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
          {isEdit ? "Save changes" : "Create customer"}
        </Button>
      </SheetFooter>
    </form>
  )
}
