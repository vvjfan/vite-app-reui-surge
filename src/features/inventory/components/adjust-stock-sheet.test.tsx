// @vitest-environment jsdom
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
import { buildStockRow } from "../queries"
import { AdjustStockSheet } from "./adjust-stock-sheet"

// The adjust sheet gates its submit on a valid quantity. The arithmetic itself
// is already covered by adjust.test.ts against applyStockAdjustment; what is
// pinned here is the WIRING - that the button leaves the disabled state once a
// quantity is typed, and that submitting actually moves the shelf rather than
// only reporting that it did.

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

async function firstItem() {
  const [item] = await getDb().inventory.toArray()
  return item
}

function renderSheet(item: Awaited<ReturnType<typeof firstItem>>) {
  const onOpenChange = vi.fn()
  render(
    <QueryClientProvider client={client()}>
      <AdjustStockSheet
        item={buildStockRow(item)}
        open
        onOpenChange={onOpenChange}
      />
    </QueryClientProvider>
  )
  return onOpenChange
}

const saveButton = () => screen.getByRole("button", { name: "Save adjustment" })

const typeQty = (value: string) => {
  const field = screen.getByLabelText(/Quantity|Units/i)
  fireEvent.change(field, { target: { value } })
  fireEvent.input(field, { target: { value } })
}

beforeEach(async () => {
  await resetDemoData()
})

afterEach(() => {
  cleanup()
})

describe("adjust stock sheet", () => {
  it("starts disabled with no quantity entered", async () => {
    renderSheet(await firstItem())
    expect(saveButton().hasAttribute("disabled")).toBe(true)
  })

  it("enables once a quantity is typed", async () => {
    renderSheet(await firstItem())
    typeQty("25")

    await waitFor(() => {
      expect(saveButton().hasAttribute("disabled")).toBe(false)
    })
  })

  it("goes back to disabled when the quantity is cleared", async () => {
    // The stuck-button check in reverse: the gate has to track the field both
    // ways, or a cleared form stays submittable.
    renderSheet(await firstItem())
    typeQty("25")
    await waitFor(() =>
      expect(saveButton().hasAttribute("disabled")).toBe(false)
    )

    typeQty("")
    await waitFor(() =>
      expect(saveButton().hasAttribute("disabled")).toBe(true)
    )
  })

  it("adds the counted units to the shelf and closes", async () => {
    const item = await firstItem()
    const level = item.levels.find(
      (l) => l.locationId === buildStockRow(item).primaryLocationId
    )
    const before = level?.onHand ?? 0

    const onOpenChange = renderSheet(item)
    typeQty("25")
    await waitFor(() =>
      expect(saveButton().hasAttribute("disabled")).toBe(false)
    )
    fireEvent.click(saveButton())

    await waitFor(async () => {
      const after = await getDb().inventory.get(item.id)
      const nextLevel = after?.levels.find(
        (l) => l.locationId === level?.locationId
      )
      expect(nextLevel?.onHand).toBe(before + 25)
    })
    // The sheet reports itself closed only after the write lands, so a failed
    // adjustment leaves the form up with the typed quantity intact.
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("records the adjustment as a movement on the item's ledger", async () => {
    const item = await firstItem()
    const movementsBefore = item.movements.length

    renderSheet(item)
    typeQty("10")
    await waitFor(() =>
      expect(saveButton().hasAttribute("disabled")).toBe(false)
    )
    fireEvent.click(saveButton())

    await waitFor(async () => {
      const after = await getDb().inventory.get(item.id)
      expect(after?.movements.length).toBe(movementsBefore + 1)
      expect(after?.movements[0].delta).toBe(10)
    })
  })
})
