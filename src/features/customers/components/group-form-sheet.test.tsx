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
import { GroupFormSheet } from "./group-form-sheet"

// Customer groups: name required, description genuinely optional. The optional
// case is worth its own test, because the cheapest way to break an optional
// field is to start validating it alongside the required one.

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function renderSheet() {
  render(
    <QueryClientProvider client={client()}>
      <GroupFormSheet mode="create" open onOpenChange={() => {}} />
    </QueryClientProvider>
  )
}

const typeName = (value: string) => {
  const field = screen.getByLabelText("Name", { exact: false })
  fireEvent.change(field, { target: { value } })
  fireEvent.input(field, { target: { value } })
}

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Create group" }))

const groups = () => getDb().customerGroups.toArray()

beforeEach(async () => {
  await clearDemoData()
})

afterEach(() => {
  cleanup()
})

describe("customer group form validation", () => {
  it("refuses an empty name and stores nothing", async () => {
    renderSheet()
    submit()

    expect(await screen.findByText("Group name is required.")).toBeTruthy()
    await new Promise((r) => setTimeout(r, 250))
    expect(await groups()).toHaveLength(0)
  })

  it("clears the error once a name is typed", async () => {
    renderSheet()
    submit()
    expect(await screen.findByText("Group name is required.")).toBeTruthy()

    typeName("Loyalty Tier 1")

    await waitFor(() => {
      expect(screen.queryByText("Group name is required.")).toBeNull()
    })
  })

  it("stores the group with only a name, leaving the description blank", async () => {
    renderSheet()
    typeName("Loyalty Tier 1")
    submit()

    await waitFor(async () => {
      expect(await groups()).toHaveLength(1)
    })
    const [created] = await groups()
    expect(created.name).toBe("Loyalty Tier 1")
  })
})
