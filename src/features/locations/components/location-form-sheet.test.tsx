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
import { LocationFormSheet } from "./location-form-sheet"

// Stock locations. These matter more than the other name-only forms because
// inventory levels are keyed to a location id: a location stored under a bad
// name is one every stock row then points at.

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function renderSheet() {
  render(
    <QueryClientProvider client={client()}>
      <LocationFormSheet mode="create" open onOpenChange={() => {}} />
    </QueryClientProvider>
  )
}

const typeName = (value: string) => {
  const field = screen.getByLabelText("Name", { exact: false })
  fireEvent.change(field, { target: { value } })
  fireEvent.input(field, { target: { value } })
}

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Create location" }))

const locations = () => getDb().locations.toArray()

beforeEach(async () => {
  await clearDemoData()
})

afterEach(() => {
  cleanup()
})

describe("stock location form validation", () => {
  it("refuses an empty name and stores nothing", async () => {
    renderSheet()
    submit()

    expect(await screen.findByText("Name is required.")).toBeTruthy()
    await new Promise((r) => setTimeout(r, 250))
    expect(await locations()).toHaveLength(0)
  })

  it("clears the error once a name is typed", async () => {
    renderSheet()
    submit()
    expect(await screen.findByText("Name is required.")).toBeTruthy()

    typeName("West Hub")

    await waitFor(() => {
      expect(screen.queryByText("Name is required.")).toBeNull()
    })
  })

  it("stores the location so stock can be held against it", async () => {
    renderSheet()
    typeName("West Hub")
    submit()

    await waitFor(async () => {
      expect(await locations()).toHaveLength(1)
    })
    const [created] = await locations()
    expect(created.name).toBe("West Hub")
    expect(created.id).toBeTruthy()
  })
})
