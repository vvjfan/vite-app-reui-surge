// @vitest-environment jsdom
import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getDb, resetDemoData } from "@/lib/data/db"
import { OrderEditor } from "./order-editor"

// The order editor's RULES already have unit coverage (order-draft.test.ts
// exercises validateOrderDraft and toOrderPayload directly). What that cannot
// show is whether those rules ever reach the screen: a validator whose messages
// are computed and then dropped passes every unit test while shipping a form
// that silently refuses to submit.
//
// So this file asserts the wiring - that a blank draft surfaces a message under
// each unfilled control, writes nothing, and stays put.
//
// Routing is mocked: the editor only reaches for `useNavigate` and `Link`, and
// mounting the real route tree to render one form buys nothing here.

const navigate = vi.fn()

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children, ...rest }: { children?: ReactNode; to?: unknown }) => {
    const domProps = { ...rest } as Record<string, unknown>
    delete domProps.to
    delete domProps.params
    return <a {...domProps}>{children}</a>
  },
}))

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function renderEditor() {
  render(
    <QueryClientProvider client={client()}>
      <OrderEditor />
    </QueryClientProvider>
  )
}

const createButton = () => screen.getByRole("button", { name: "Create order" })

/**
 * The pickers read from the store, and the button ignores clicks while those
 * reads are in flight (`isLoading`). Waiting for it to go live keeps these
 * tests about validation rather than about timing.
 */
async function editorReady() {
  await waitFor(() => {
    expect(createButton().hasAttribute("disabled")).toBe(false)
  })
}

const orders = () => getDb().orders.toArray()

beforeEach(async () => {
  navigate.mockClear()
  // Seeded: the customer, product and location pickers all need real options,
  // and an empty store would fail these for the wrong reason.
  await resetDemoData()
})

afterEach(() => {
  cleanup()
})

describe("order editor validation", () => {
  it("names every unfilled field instead of failing silently", async () => {
    renderEditor()
    await editorReady()

    fireEvent.click(createButton())

    // A blank draft is missing a customer, a product on its one line, and the
    // location it ships from. Each has to say so where the control is.
    expect(await screen.findByText(/Select a customer/i)).toBeTruthy()
    expect(await screen.findByText(/Select a product/i)).toBeTruthy()
    expect(await screen.findByText(/Choose a location/i)).toBeTruthy()
  })

  it("writes no order when the draft is invalid", async () => {
    const before = (await orders()).length
    renderEditor()
    await editorReady()

    fireEvent.click(createButton())

    await screen.findByText(/Select a customer/i)
    await new Promise((r) => setTimeout(r, 300))
    expect(await orders()).toHaveLength(before)
  })

  it("stays on the editor rather than navigating away", async () => {
    // Navigating on a refused submit would drop the operator back on the ledger
    // with no order and no explanation.
    renderEditor()
    await editorReady()

    fireEvent.click(createButton())

    await screen.findByText(/Select a customer/i)
    expect(navigate).not.toHaveBeenCalled()
  })

  it("marks the failed controls invalid for assistive tech", async () => {
    // The message alone is not enough: the control itself has to be flagged, or
    // a screen-reader user hears a form with no indication of which field failed.
    renderEditor()
    await editorReady()

    fireEvent.click(createButton())

    await waitFor(() => {
      expect(
        document.getElementById("order-customer")?.getAttribute("aria-invalid")
      ).toBe("true")
      expect(
        document.getElementById("order-location")?.getAttribute("aria-invalid")
      ).toBe("true")
    })
  })

  it("keeps reporting until the draft is actually filled in", async () => {
    // Clicking again must not "use up" the errors: an operator who submits
    // twice should see the same guidance, not an empty form that now submits.
    const before = (await orders()).length
    renderEditor()
    await editorReady()

    fireEvent.click(createButton())
    await screen.findByText(/Select a customer/i)
    fireEvent.click(createButton())

    expect(await screen.findByText(/Select a customer/i)).toBeTruthy()
    await new Promise((r) => setTimeout(r, 300))
    expect(await orders()).toHaveLength(before)
    expect(navigate).not.toHaveBeenCalled()
  })
})
