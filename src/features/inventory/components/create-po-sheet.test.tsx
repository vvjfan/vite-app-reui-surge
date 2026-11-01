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

import { getDb, resetDemoData } from "@/lib/data/db"
import type { PoLine } from "@/features/purchase-orders/queries"
import { CreatePurchaseOrderSheet } from "./create-po-sheet"

// Drafting a purchase order is the one form in the app that can produce MORE
// THAN ONE record from a single submit: a PO belongs to one supplier, so a
// selection spanning several has to split. That split, and the per-line
// quantity rule that guards it, are what this pins - both against the store,
// since a toast proves nothing about what was written.

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function line(overrides: Partial<PoLine> & Pick<PoLine, "sku">): PoLine {
  return {
    productId: overrides.sku.toLowerCase(),
    name: `Product ${overrides.sku}`,
    thumbnail: null,
    quantity: 40,
    unitCost: 10,
    supplierId: "sup_atlas",
    supplierName: "Atlas Wholesale",
    ...overrides,
  }
}

function renderSheet(lines: PoLine[]) {
  render(
    <QueryClientProvider client={client()}>
      <CreatePurchaseOrderSheet lines={lines} open onOpenChange={() => {}} />
    </QueryClientProvider>
  )
}

const draftButton = () =>
  screen.getByRole("button", { name: /Create draft PO/ })

/**
 * Wait for the receiving location to default in. It comes from a query, and the
 * form refuses to draft without one, so submitting before it settles would fail
 * for a reason that has nothing to do with what each test is checking.
 */
async function locationReady() {
  await waitFor(() => {
    expect(screen.queryByText("Pick a location")).toBeNull()
  })
}

const setQty = (lineName: string, value: string) => {
  const field = screen.getByLabelText(`Order quantity for ${lineName}`)
  fireEvent.change(field, { target: { value } })
  fireEvent.input(field, { target: { value } })
}

async function storedOrders() {
  return getDb().purchaseOrders.toArray()
}

beforeEach(async () => {
  // Seeded, so the receiving-location select has real locations to offer; the
  // sample POs are filtered out of the assertions by created-at ordering.
  await resetDemoData()
})

afterEach(() => {
  cleanup()
})

describe("create purchase order sheet", () => {
  it("refuses a line ordering zero units", async () => {
    const before = (await storedOrders()).length
    renderSheet([line({ sku: "AC-1" })])

    setQty("Product AC-1", "0")
    fireEvent.click(draftButton())

    expect(await screen.findByText("Order at least 1 unit.")).toBeTruthy()
    await new Promise((r) => setTimeout(r, 250))
    expect(await storedOrders()).toHaveLength(before)
  })

  it("clears the line's error once the quantity is corrected", async () => {
    renderSheet([line({ sku: "AC-1" })])
    setQty("Product AC-1", "0")
    fireEvent.click(draftButton())
    expect(await screen.findByText("Order at least 1 unit.")).toBeTruthy()

    setQty("Product AC-1", "12")

    await waitFor(() => {
      expect(screen.queryByText("Order at least 1 unit.")).toBeNull()
    })
  })

  it("drafts one purchase order for a single-supplier selection", async () => {
    const before = (await storedOrders()).length
    renderSheet([line({ sku: "AC-1" }), line({ sku: "AC-2", quantity: 15 })])
    await locationReady()

    fireEvent.click(draftButton())

    await waitFor(async () => {
      expect(await storedOrders()).toHaveLength(before + 1)
    })
    const created = (await storedOrders()).find((po) =>
      po.lines.some((l) => l.sku === "AC-1")
    )
    expect(created?.supplierId).toBe("sup_atlas")
    expect(created?.status).toBe("draft")
    expect(created?.lines).toHaveLength(2)
  })

  it("splits a mixed-supplier selection into one order per supplier", async () => {
    const before = (await storedOrders()).length
    renderSheet([
      line({ sku: "AC-1" }),
      line({
        sku: "FT-9",
        supplierId: "sup_cedar",
        supplierName: "Cedar Logistics",
      }),
    ])
    await locationReady()

    fireEvent.click(draftButton())

    await waitFor(async () => {
      expect(await storedOrders()).toHaveLength(before + 2)
    })
    const mine = (await storedOrders()).filter((po) =>
      po.lines.some((l) => ["AC-1", "FT-9"].includes(l.sku))
    )
    expect(mine).toHaveLength(2)
    // Each order holds only its own supplier's line - no PO mixes suppliers.
    for (const po of mine) {
      expect(new Set(po.lines.map(() => po.supplierId)).size).toBe(1)
      expect(po.lines).toHaveLength(1)
    }
    expect(new Set(mine.map((po) => po.supplierId))).toEqual(
      new Set(["sup_atlas", "sup_cedar"])
    )
  })

  it("writes the edited quantity, not the suggested one", async () => {
    const before = (await storedOrders()).length
    renderSheet([line({ sku: "AC-1", quantity: 40 })])

    await locationReady()
    setQty("Product AC-1", "7")
    fireEvent.click(draftButton())

    await waitFor(async () => {
      expect(await storedOrders()).toHaveLength(before + 1)
    })
    const created = (await storedOrders()).find((po) =>
      po.lines.some((l) => l.sku === "AC-1")
    )
    expect(created?.lines[0].quantity).toBe(7)
  })
})
