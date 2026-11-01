// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { clearDemoData, getDb } from "@/lib/data/db"
import { destinationFor } from "@/lib/data/commerce"
import { validateOrderDraft } from "@/features/orders/order-draft"
import { CustomerFormSheet } from "./customer-form-sheet"

// The customer create form, exercised end to end into the in-memory demo
// store (jsdom provides the browser window it requires).
//
// The regression this file exists for: the form collected every field EXCEPT an
// address, and `Customer.location` is optional, so it wrote a customer nothing
// rejected - and the order editor then dropped that customer from its picker
// (it filtered on `c.location`) and said "No customers found." while the
// customer sat in /customers. With the store starting empty, that meant NO
// ORDER COULD BE CREATED AT ALL: every customer you could make was one you
// could not order from.
//
// So the assertion is not "the form submits". It is that what the form stores
// can be shipped to - checked against the real rules (validateOrderDraft,
// destinationFor), not against a toast.

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function renderForm() {
  return render(
    <QueryClientProvider client={client()}>
      <CustomerFormSheet mode="create" open onOpenChange={() => {}} />
    </QueryClientProvider>
  )
}

/** The sheet with its open state driven by the test, so it can be closed. */
function renderSheet() {
  const queryClient = client()
  function Harness({ open }: { open: boolean }) {
    return (
      <QueryClientProvider client={queryClient}>
        <CustomerFormSheet mode="create" open={open} onOpenChange={() => {}} />
      </QueryClientProvider>
    )
  }
  const view = render(<Harness open />)
  return {
    close: () => view.rerender(<Harness open={false} />),
    reopen: () => view.rerender(<Harness open />),
  }
}

/** Fill name + email; the rest of the form is left at its defaults. */
function fillIdentity(name: string, email: string) {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: name } })
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } })
}

/**
 * The Select commits on pointer events, not on a bare click: a `click` alone
 * opens the list and leaves the value untouched, which reads exactly like a
 * successful selection that stored nothing.
 */
async function chooseCity(city: string) {
  fireEvent.click(screen.getByLabelText("City"))
  const option = await screen.findByRole("option", { name: new RegExp(city) })
  fireEvent.pointerDown(option)
  fireEvent.pointerUp(option)
  fireEvent.click(option)
  await waitFor(() => {
    expect(screen.getByLabelText("City").textContent).toContain(city)
  })
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Create customer" }))
}

async function storedCustomer(id: string) {
  return getDb().customers.get(id)
}

beforeEach(async () => {
  // Start from the empty store the app now boots into, so this test sees what a
  // real first-run visitor sees rather than 56 seeded customers.
  await clearDemoData()
})

afterEach(() => {
  cleanup()
})

describe("customer create form: what it stores can be ordered from", () => {
  it("writes the chosen city onto the customer", async () => {
    renderForm()
    fillIdentity("Ada Lovelace", "ada@example.com")
    await chooseCity("London")
    submit()

    await waitFor(async () => {
      expect(await storedCustomer("ada-lovelace")).toBeDefined()
    })
    expect((await storedCustomer("ada-lovelace"))?.location).toEqual({
      city: "London",
      countryCode: "UK",
    })
  })

  it("stores a customer an order can actually ship to", async () => {
    // The end of the blocker, asserted against the rules the order editor runs
    // rather than against the shape of the record: a customer created here must
    // pass validateOrderDraft's customer rule and resolve to a destination.
    renderForm()
    fillIdentity("Ada Lovelace", "ada@example.com")
    await chooseCity("London")
    submit()

    await waitFor(async () => {
      expect(await storedCustomer("ada-lovelace")).toBeDefined()
    })
    const customer = (await storedCustomer("ada-lovelace"))!

    const errors = validateOrderDraft(
      {
        customerId: customer.id,
        lines: [],
        shippingMethod: "",
        locationId: "",
      },
      { customers: [customer], products: [], locations: [] }
    )
    // Only the customer rule is under test; the draft is otherwise blank, so its
    // other messages are expected and ignored.
    expect(errors.customerId).toBeUndefined()
    expect(() => destinationFor(customer)).not.toThrow()
  })

  it("refuses to create a customer with no city", async () => {
    // The form is this app's only way to set an address, so a customer it let
    // through without one could never be ordered from, and could never be fixed
    // except by editing them.
    //
    // Asserted against the store, not the toast: a handler that toasts and
    // writes nothing passes any test that trusts the toast, and a handler that
    // toasts an error and writes anyway would too.
    renderForm()
    fillIdentity("Grace Hopper", "grace@example.com")
    submit()

    // Give the mutation the same room the passing cases get, so this cannot
    // pass merely by reading the store before a write lands.
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(await storedCustomer("grace-hopper")).toBeUndefined()
    expect(await getDb().customers.count()).toBe(0)
  })

  it("forgets a city chosen for a customer who was never created", async () => {
    // Found in the browser: pick a city, close the sheet without submitting,
    // reopen. The city stayed selected, because the reset key was on the <form>
    // and reset only the DOM inputs - city lives in React state. The next
    // customer was then stored with an address nobody chose for them, and their
    // orders would have shipped to it.
    const sheet = renderSheet()
    await chooseCity("London")

    sheet.close()
    sheet.reopen()

    expect(screen.getByLabelText("City").textContent).toContain("Select city")
  })
})
