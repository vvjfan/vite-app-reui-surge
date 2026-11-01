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
import { CategoryFormSheet } from "./category-form-sheet"

// The name-required contract shared by the create sheets, pinned on the
// category form because it is the one that also has to mint an id (a slug) from
// what was typed. Asserted against the store: a handler that reports an error
// and writes anyway would pass a toast-based test.

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function renderSheet() {
  render(
    <QueryClientProvider client={client()}>
      <CategoryFormSheet mode="create" open onOpenChange={() => {}} />
    </QueryClientProvider>
  )
}

const typeName = (value: string) => {
  const field = screen.getByLabelText("Name", { exact: false })
  fireEvent.change(field, { target: { value } })
  fireEvent.input(field, { target: { value } })
}

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Create category" }))

const categories = () => getDb().categories.toArray()

beforeEach(async () => {
  await clearDemoData()
})

afterEach(() => {
  cleanup()
})

describe("category form validation", () => {
  it("refuses an empty name and stores nothing", async () => {
    renderSheet()
    submit()

    expect(await screen.findByText("Category name is required.")).toBeTruthy()
    await new Promise((r) => setTimeout(r, 250))
    expect(await categories()).toHaveLength(0)
  })

  it("refuses a name that is only whitespace", async () => {
    // Trimmed before it is judged, or "   " would pass as a name and then slug
    // to an empty id.
    renderSheet()
    typeName("   ")
    submit()

    expect(await screen.findByText("Category name is required.")).toBeTruthy()
    await new Promise((r) => setTimeout(r, 250))
    expect(await categories()).toHaveLength(0)
  })

  it("clears the error once a name is typed", async () => {
    renderSheet()
    submit()
    expect(await screen.findByText("Category name is required.")).toBeTruthy()

    typeName("Outdoor Gear")

    await waitFor(() => {
      expect(screen.queryByText("Category name is required.")).toBeNull()
    })
  })

  it("stores the category with an id derived from the name", async () => {
    renderSheet()
    typeName("Outdoor Gear")
    submit()

    await waitFor(async () => {
      expect(await categories()).toHaveLength(1)
    })
    const [created] = await categories()
    expect(created.name).toBe("Outdoor Gear")
    expect(created.id).toBe("outdoor-gear")
  })
})
