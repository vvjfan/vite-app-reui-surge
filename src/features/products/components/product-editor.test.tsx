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

import { clearDemoData, getDb } from "@/lib/data/db"
import { ProductEditor } from "./product-editor"

// The product editor is a full PAGE, not a sheet: on success it navigates away
// instead of closing, so "did it work" has to be read from the store and from
// where it tried to go. Both are asserted here.
//
// Routing is mocked rather than mounted. A real router would need the whole
// route tree stood up to render one form, and the editor only reaches for two
// things from it - `useNavigate` and `Link`.

const navigate = vi.fn()

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children, ...rest }: { children?: ReactNode; to?: unknown }) => {
    // `to`/`params` are router props, not DOM attributes; dropping them keeps
    // React from warning about unknown attributes on <a>.
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
      <ProductEditor mode="create" />
    </QueryClientProvider>
  )
}

const typeTitle = (value: string) => {
  // Exact: a loose match also catches "Subtitle".
  const field = screen.getByLabelText("Title", { exact: true })
  fireEvent.change(field, { target: { value } })
  fireEvent.input(field, { target: { value } })
}

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Create product" }))

const products = () => getDb().products.toArray()

beforeEach(async () => {
  navigate.mockClear()
  await clearDemoData()
})

afterEach(() => {
  cleanup()
})

describe("product editor", () => {
  it("refuses a product with no title and stores nothing", async () => {
    renderEditor()
    save()

    expect(await screen.findByText("Product title is required.")).toBeTruthy()
    // Give a write the same room a passing case gets, so this cannot pass by
    // reading the store before the mutation lands.
    await new Promise((r) => setTimeout(r, 250))
    expect(await products()).toHaveLength(0)
  })

  it("stays on the page when the form is refused", async () => {
    // Navigating away on an invalid submit would strand the operator on the
    // catalog with no idea their product was never created.
    renderEditor()
    save()

    expect(await screen.findByText("Product title is required.")).toBeTruthy()
    expect(navigate).not.toHaveBeenCalled()
  })

  it("clears the title error as soon as a title is typed", async () => {
    renderEditor()
    save()
    expect(await screen.findByText("Product title is required.")).toBeTruthy()

    typeTitle("Alpine Down Vest")

    await waitFor(() => {
      expect(screen.queryByText("Product title is required.")).toBeNull()
    })
  })

  it("stores the product and leaves the editor", async () => {
    renderEditor()
    typeTitle("Alpine Down Vest")
    save()

    await waitFor(async () => {
      expect(await products()).toHaveLength(1)
    })
    const [created] = await products()
    expect(created.title).toBe("Alpine Down Vest")
    // A new product is a draft until someone publishes it deliberately.
    expect(created.status).toBe("draft")

    await waitFor(() => {
      expect(navigate).toHaveBeenCalled()
    })
  })

  it("does not create a second product from a double submit", async () => {
    // The save button disables while the mutation is in flight; this pins that
    // it actually prevents a duplicate rather than only looking disabled.
    renderEditor()
    typeTitle("Alpine Down Vest")
    save()
    save()

    await waitFor(async () => {
      expect((await products()).length).toBeGreaterThan(0)
    })
    await new Promise((r) => setTimeout(r, 300))
    expect(await products()).toHaveLength(1)
  })
})
