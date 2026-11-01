import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  SHIPPING_METHODS,
  buildOrderLine,
  orderTotals,
} from "@/lib/data/commerce"
import { locationsListQuery } from "@/features/locations/queries"
import type { Product } from "@/lib/data/products"
import type { Customer, OrderLine } from "@/lib/data/types"
import { customersListQuery } from "@/features/customers/queries"
import { productsListQuery } from "@/features/products/queries"
import {
  emptyOrderDraft,
  emptyOrderDraftLine,
  hasOrderErrors,
  toOrderPayload,
  validateOrderDraft,
  type OrderDraft,
  type OrderDraftLine,
  type OrderErrors,
} from "../order-draft"
import { useCreateOrder } from "../queries"
import { formatCurrency } from "../lib/format"
import { OrderLineItems, type OrderLineRow } from "./order-line-items"
import { OrderSection } from "./order-section"
import { OrderSummary } from "./order-summary"
import { PlusIcon } from "@phosphor-icons/react"

// Full-page new-order editor: the relocated form-3 invoice creator, re-fielded
// for an order and wired to the store. The page structure (PageHeader with the
// primary / secondary actions, sectioned body, a sidebar) mirrors the promotion
// and product editors.
//
// Every rule lives in ../order-draft: the draft shape, the validator, and the
// draft -> payload mapping. This file is only the React surface - it does not
// decide what a valid order is, and it must not restate any rule from there.

// Error key -> the control's id, in visual order, so a blocked submit puts the
// cursor on the first field that failed rather than whichever key the errors
// object happened to list first (the customer-form-sheet's rule). The line-item
// errors (`lines`, `lineErrors`) are absent on purpose: those inputs live in the
// data grid and are reached by aria-label, not a page id, so they surface inline
// there and only block submit - there is nothing to focus.
const FIELD_ORDER: Array<[keyof OrderErrors, string]> = [
  ["customerId", "order-customer"],
  ["shippingMethod", "order-shipping-method"],
  ["locationId", "order-location"],
]

/**
 * The OrderLine a draft slot builds into, or null while it is still incomplete.
 *
 * This is NOT validation - it resolves ids and skips what cannot be priced yet.
 * `buildOrderLine`'s documented precondition is that the variant belongs to the
 * product, so a slot missing either has nothing to build. Quantity is coerced
 * the way the promotion editor coerces its value input: a half-typed or empty
 * qty parses to NaN, which would poison the totals rather than reading as 0.
 *
 * The id matches the one `toOrderPayload` mints for the same slot (`L-{index}`),
 * so a previewed line is the line that gets saved, field for field.
 */
function toPreviewLine(
  line: OrderDraftLine,
  index: number,
  products: Product[]
): OrderLine | null {
  const product = products.find((p) => p.id === line.productId)
  if (!product) return null
  const variant = product.variants.find((v) => v.id === line.variantId)
  if (!variant) return null
  return buildOrderLine(product, variant, Number(line.qty) || 0, `L-${index}`)
}

function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-9 w-full" />
    </div>
  )
}

export function OrderEditor() {
  const navigate = useNavigate()
  const createOrder = useCreateOrder()

  // Both pickers read from the store; neither renders a seed. `isPending` is
  // true on the server and the first client paint, so the form shows skeletons
  // until the reads settle rather than an empty picker that looks like an empty
  // catalog.
  const customersQuery = useQuery(customersListQuery())
  const productsQuery = useQuery(productsListQuery())
  // Locations are a CRUD collection: Settings can add one or re-address one, so
  // the picker, the rules, and the payload all read the STORE's list rather than
  // the seed. Reading the seed here would offer an operator-created location the
  // validator then rejected, and would snapshot a stale address after a
  // re-address.
  const locationsQuery = useQuery(locationsListQuery())
  const isLoading =
    customersQuery.isPending ||
    productsQuery.isPending ||
    locationsQuery.isPending

  // Every customer, including any that cannot be shipped to.
  //
  // This used to filter on `c.location`, on the reasoning that a customer with
  // no address cannot be shipped to (`destinationFor` throws rather than emit a
  // half-built destination, and toOrderPayload calls it) and that every seeded
  // customer had one anyway. Both halves stopped being true: the store starts
  // empty, and the create form did not collect an address - so every customer
  // you made was silently dropped here and the picker said "No customers found."
  // while the customer sat in /customers. No order could be placed at all.
  //
  // A rule this picker cannot state is a rule the operator cannot fix. The
  // address requirement now lives in validateOrderDraft with the other rules,
  // where it names the customer instead of hiding them.
  const customers = customersQuery.data ?? []
  const products = productsQuery.data ?? []
  const locations = locationsQuery.data ?? []
  const ctx = { customers, products, locations }

  const [draft, setDraft] = useState<OrderDraft>(emptyOrderDraft)
  const [errors, setErrors] = useState<OrderErrors>({})

  const isSubmitting = createOrder.isPending

  // Errors surface on submit, then clear live as they are fixed - the promotion
  // editor's rule. Both updates are computed from `next` rather than inside a
  // state updater, so nothing runs twice under StrictMode.
  function applyDraft(next: OrderDraft) {
    setDraft(next)
    if (hasOrderErrors(errors)) {
      setErrors(validateOrderDraft(next, ctx))
    }
  }

  function setField<TKey extends keyof OrderDraft>(
    key: TKey,
    value: OrderDraft[TKey]
  ) {
    applyDraft({ ...draft, [key]: value })
  }

  function setLine(index: number, patch: Partial<OrderDraftLine>) {
    applyDraft({
      ...draft,
      lines: draft.lines.map((line, i) =>
        i === index ? { ...line, ...patch } : line
      ),
    })
  }

  // Clearing the variant is not a validation rule, it is keeping the draft
  // coherent: a variant from the PREVIOUS product would otherwise ride along and
  // carry another product's price. validateOrderDraft rejects that join anyway;
  // this stops it being reachable.
  function handleProductChange(index: number, productId: string) {
    setLine(index, { productId, variantId: "" })
  }

  function handleAddLine() {
    applyDraft({ ...draft, lines: [...draft.lines, emptyOrderDraftLine()] })
  }

  function handleRemoveLine(index: number) {
    if (draft.lines.length === 1) return
    applyDraft({
      ...draft,
      lines: draft.lines.filter((_, i) => i !== index),
    })
  }

  function handleCreate() {
    if (isSubmitting || isLoading) return

    const nextErrors = validateOrderDraft(draft, ctx)
    setErrors(nextErrors)
    if (hasOrderErrors(nextErrors)) {
      // Messages are already rendered under each control (FieldError) with
      // aria-invalid set; move focus to the first failed field so the operator
      // lands on it instead of being told, by a toast, to go hunt for it.
      const firstInvalid = FIELD_ORDER.find(([key]) => nextErrors[key])
      if (firstInvalid) document.getElementById(firstInvalid[1])?.focus()
      return
    }

    createOrder.mutate(toOrderPayload(draft, ctx), {
      onSuccess: (created) => {
        toast.success("Order created", { description: created.number })
        navigate({ to: "/orders" })
      },
    })
  }

  // One derivation feeds both the table's read-only price / amount cells and the
  // summary, so a row and the total can never disagree.
  const rows: OrderLineRow[] = draft.lines.map((line, index) => ({
    line,
    built: toPreviewLine(line, index, products),
  }))
  const method = SHIPPING_METHODS.find((m) => m.method === draft.shippingMethod)
  // orderTotals + buildOrderLine are exactly what toOrderPayload uses to write
  // the saved order's totals, so this preview cannot drift from what is stored.
  const totals = orderTotals(
    rows.flatMap((row) => (row.built ? [row.built] : [])),
    method?.shipping ?? 0
  )

  const selectedCustomer =
    customers.find((c) => c.id === draft.customerId) ?? null
  // The trigger shows the location's name, so the id has to be resolved back to
  // one. A blank draft carries no origin, so this legitimately misses until the
  // operator picks; past that, a miss means an id no location answers to, which
  // the validator reports.
  const selectedLocation =
    locations.find((l) => l.id === draft.locationId) ?? null
  const lineCount = draft.lines.length

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New order"
        description={
          isLoading
            ? "Loading catalog"
            : `Total ${formatCurrency(totals.total)}`
        }
        actions={
          <>
            <Link
              to="/orders"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Cancel
            </Link>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? (
                <Spinner data-icon="inline-start" aria-hidden="true" />
              ) : null}
              Create order
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-4">
          <OrderSection
            title="Customer"
            description="Who this order ships to."
            badge="Required"
            badgeVariant="warning-light"
          >
            <FieldGroup className="grid gap-4">
              <Field>
                <FieldLabel htmlFor="order-customer">Customer</FieldLabel>
                {isLoading ? (
                  <EditorSkeleton />
                ) : (
                  <Combobox
                    items={customers}
                    value={selectedCustomer}
                    onValueChange={(customer: Customer | null) =>
                      setField("customerId", customer?.id ?? "")
                    }
                    itemToStringLabel={(customer: Customer) => customer.name}
                    itemToStringValue={(customer: Customer) => customer.name}
                    isItemEqualToValue={(a: Customer, b: Customer) =>
                      a.id === b.id
                    }
                  >
                    <ComboboxInput
                      id="order-customer"
                      placeholder="Find customer..."
                      className="w-full"
                      aria-invalid={Boolean(errors.customerId)}
                      showClear
                    />
                    <ComboboxContent className="w-(--anchor-width) min-w-(--anchor-width)">
                      <ComboboxEmpty>No customers found.</ComboboxEmpty>
                      <ComboboxList>
                        {(customer: Customer) => (
                          <ComboboxItem key={customer.id} value={customer}>
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate">{customer.name}</span>
                              <span className="truncate text-xs text-muted-foreground">
                                {customer.email}
                              </span>
                            </span>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                )}
                <FieldError>{errors.customerId}</FieldError>
              </Field>
            </FieldGroup>
          </OrderSection>

          <OrderSection
            title="Line items"
            description="Products, variants, and quantity."
            badge={`${lineCount} item${lineCount === 1 ? "" : "s"}`}
            badgeVariant="secondary"
            panelClassName="p-0!"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLine}
                disabled={isLoading}
              >
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                Add item
              </Button>
            }
          >
            <OrderLineItems
              rows={rows}
              products={products}
              lineErrors={errors.lineErrors}
              isLoading={isLoading}
              onProductChange={handleProductChange}
              onVariantChange={(index, variantId) =>
                setLine(index, { variantId })
              }
              onQtyChange={(index, qty) => setLine(index, { qty })}
              onRemoveLine={handleRemoveLine}
            />
            {/* The panel runs the grid full-bleed, so a message under it has to
                carry the panel's own padding back. */}
            {errors.lines ? (
              <div className="px-(--frame-panel-px) pb-(--frame-panel-py)">
                <FieldError>{errors.lines}</FieldError>
              </div>
            ) : null}
          </OrderSection>

          <OrderSection
            title="Summary"
            description="What this order will be charged."
          >
            <OrderSummary
              totals={totals}
              shippingMethod={method?.method ?? draft.shippingMethod}
            />
          </OrderSection>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <OrderSection
            title="Shipping"
            description="How and where this order ships from."
          >
            <FieldGroup className="grid gap-4">
              <Field>
                <FieldLabel htmlFor="order-shipping-method">Method</FieldLabel>
                <Select
                  value={draft.shippingMethod}
                  onValueChange={(value) =>
                    value && setField("shippingMethod", String(value))
                  }
                >
                  <SelectTrigger
                    id="order-shipping-method"
                    className="w-full"
                    aria-invalid={Boolean(errors.shippingMethod)}
                  >
                    <SelectValue>{draft.shippingMethod}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="w-(--anchor-width)">
                    <SelectGroup>
                      {SHIPPING_METHODS.map((option) => (
                        <SelectItem key={option.method} value={option.method}>
                          <span className="flex w-full items-center justify-between gap-3">
                            <span className="truncate">{option.method}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {formatCurrency(option.shipping)}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError>{errors.shippingMethod}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="order-location">Ships from</FieldLabel>
                <Select
                  value={draft.locationId}
                  onValueChange={(value) =>
                    value && setField("locationId", String(value))
                  }
                >
                  <SelectTrigger
                    id="order-location"
                    className="w-full"
                    aria-invalid={Boolean(errors.locationId)}
                  >
                    {/* An operator picks a place by NAME ("East DC"); the address
                        is a detail of that place, and the id is what is stored.
                        A blank draft has no origin (locations load from the
                        store), so the unselected state needs the same prompt the
                        line-item pickers use, not an empty trigger. */}
                    <SelectValue
                      className={cn(
                        "truncate",
                        !selectedLocation && "text-muted-foreground"
                      )}
                    >
                      {selectedLocation?.name ?? "Select location"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="w-(--anchor-width)">
                    <SelectGroup>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError>{errors.locationId}</FieldError>
              </Field>
            </FieldGroup>
          </OrderSection>
        </div>
      </div>
    </div>
  )
}
