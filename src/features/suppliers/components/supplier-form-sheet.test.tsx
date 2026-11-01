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
import { SupplierFormSheet } from "./supplier-form-sheet"

// The supplier form's validation contract, asserted against the STORE rather
// than the toast. A handler that toasts an error and writes anyway would pass
// any test that trusts the toast, so every "refuses" case checks the table is
// still empty.
//
// This form carries the only FORMAT rule in the settings sheets (the contact
// email), which is why it is the one pinned here: a name-only form cannot
// prove that a bad-but-present value is rejected.

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function renderSheet() {
  return render(
    <QueryClientProvider client={client()}>
      <SupplierFormSheet mode="create" open onOpenChange={() => {}} />
    </QueryClientProvider>
  )
}

/**
 * Type into a field the way a person does. Real typing fires `input` and only
 * later `change` (on blur), and these fields clear their error on `input`, so a
 * `change`-only helper would set the value without ever clearing the error and
 * report a bug that does not exist in a browser.
 */
const type = (label: string, value: string) => {
  const field = screen.getByLabelText(label, { exact: false })
  fireEvent.change(field, { target: { value } })
  fireEvent.input(field, { target: { value } })
}

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Create supplier" }))

async function suppliers() {
  return getDb().suppliers.toArray()
}

beforeEach(async () => {
  await clearDemoData()
})

afterEach(() => {
  cleanup()
})

describe("supplier form validation", () => {
  it("refuses an empty name and says so in the field", async () => {
    renderSheet()
    submit()

    expect(await screen.findByText("Name is required.")).toBeTruthy()
    // Give a write the same room a passing case gets, so this cannot pass
    // merely by reading the store before the mutation lands.
    await new Promise((r) => setTimeout(r, 250))
    expect(await suppliers()).toHaveLength(0)
  })

  it("refuses a malformed contact email", async () => {
    renderSheet()
    type("Name", "Aurora Textiles")
    type("Contact email", "not-an-email")
    submit()

    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy()
    await new Promise((r) => setTimeout(r, 250))
    expect(await suppliers()).toHaveLength(0)
  })

  it("clears a field's error as soon as it is edited", async () => {
    renderSheet()
    submit()
    expect(await screen.findByText("Name is required.")).toBeTruthy()

    type("Name", "Aurora Textiles")

    await waitFor(() => {
      expect(screen.queryByText("Name is required.")).toBeNull()
    })
  })

  it("stores the supplier when the form is valid", async () => {
    renderSheet()
    type("Name", "Aurora Textiles")
    type("Contact email", "orders@aurora.example.com")
    submit()

    await waitFor(async () => {
      expect(await suppliers()).toHaveLength(1)
    })
    const [created] = await suppliers()
    expect(created.name).toBe("Aurora Textiles")
    expect(created.contactEmail).toBe("orders@aurora.example.com")
  })

  it("treats the contact email as optional when it is left blank", async () => {
    // Blank is not "malformed": the format rule only applies to a value that is
    // actually there, or the optional field would become required by accident.
    renderSheet()
    type("Name", "Cedar Logistics")
    submit()

    await waitFor(async () => {
      expect(await suppliers()).toHaveLength(1)
    })
    expect(screen.queryByText("Enter a valid email address.")).toBeNull()
  })
})
