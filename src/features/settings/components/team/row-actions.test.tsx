// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Row } from "@tanstack/react-table"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { getDb, resetDemoData } from "@/lib/data/db"
import { TEAM_MEMBERS, type Member } from "@/lib/data/team"
import { ActionsCell } from "./columns"

// The team row actions exercised end to end: a click on the menu runs the real
// mutation through the repository into the in-memory demo store (jsdom
// provides the browser window it requires).
//
// This is the regression guard for a defect this file shipped with: Remove and
// Suspend used to fire a success toast and write nothing, so the row claimed a
// state change that never happened. Asserting against the DB (not the toast) is
// the whole point - a toast-only handler passes any test that trusts the toast.

const OWNER = "usr_a1b2c3d4" // Mira Stone, the only Owner
const DAVID = "usr_f6a7b8c9" // Member, Active
const KENJI = "usr_e1f2a3b4" // Guest, already Suspended

function memberFromSeed(id: string): Member {
  const member = TEAM_MEMBERS.find((m) => m.id === id)
  if (!member) throw new Error(`seed has no member ${id}`)
  return member
}

/** ActionsCell only reads row.original, so a minimal stand-in is enough. */
function rowFor(member: Member) {
  return { original: member } as Row<Member>
}

function renderCell(member: Member) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <ActionsCell row={rowFor(member)} onView={() => {}} />
    </QueryClientProvider>
  )
}

/** Open the row menu and wait for it to render. */
async function openMenu() {
  fireEvent.click(screen.getByLabelText("Row actions"))
  await screen.findByText("View Profile")
}

async function readMember(id: string) {
  return getDb().teamMembers.get(id)
}

beforeEach(async () => {
  await resetDemoData()
})

afterEach(() => {
  cleanup()
})

describe("team row actions: writes reach the store", () => {
  it("Remove deletes the member from the store", async () => {
    expect(await readMember(DAVID)).toBeDefined()

    renderCell(memberFromSeed(DAVID))
    await openMenu()
    fireEvent.click(screen.getByText("Remove"))

    // Confirm in the destructive dialog: removing must not be one click.
    const confirm = await screen.findByRole("button", { name: "Remove" })
    fireEvent.click(confirm)

    await waitFor(async () => expect(await readMember(DAVID)).toBeUndefined())
  })

  it("Suspend writes status Suspended", async () => {
    renderCell(memberFromSeed(DAVID))
    await openMenu()
    fireEvent.click(screen.getByText("Suspend"))

    await waitFor(async () =>
      expect((await readMember(DAVID))?.status).toBe("Suspended")
    )
  })

  it("offers Reinstate for a suspended member and writes status Active", async () => {
    renderCell(memberFromSeed(KENJI))
    await openMenu()
    expect(screen.queryByText("Suspend")).toBeNull()
    fireEvent.click(screen.getByText("Reinstate"))

    await waitFor(async () =>
      expect((await readMember(KENJI))?.status).toBe("Active")
    )
  })

  it("Edit Role writes the chosen role", async () => {
    renderCell(memberFromSeed(DAVID))
    await openMenu()
    fireEvent.click(screen.getByText("Edit Role"))
    fireEvent.click(await screen.findByText("Admin"))

    await waitFor(async () =>
      expect((await readMember(DAVID))?.role).toBe("Admin")
    )
  })
})

describe("team row actions: guards", () => {
  it("does not offer Resend Invite to a member who has no outstanding invite", async () => {
    renderCell(memberFromSeed(DAVID)) // Active, joined long ago
    await openMenu()
    expect(screen.queryByText("Resend Invite")).toBeNull()
  })

  it("offers Resend Invite only while the invite is outstanding", async () => {
    renderCell(memberFromSeed("usr_c9d0e1f2")) // Emma Wilson, Invited
    await openMenu()
    expect(screen.getByText("Resend Invite")).toBeDefined()
  })

  it("locks Remove and Suspend for the owner", async () => {
    renderCell(memberFromSeed(OWNER))
    await openMenu()

    // Both are present but inert: an owner who could remove themselves would
    // lock the store out of its own settings.
    for (const label of ["Remove", "Suspend"]) {
      const item = screen.getByText(label).closest("[role='menuitem']")
      expect(item?.getAttribute("data-disabled")).not.toBeNull()
    }

    fireEvent.click(screen.getByText("Suspend"))
    await new Promise((r) => setTimeout(r, 50))
    expect((await readMember(OWNER))?.status).toBe("Active")
  })
})
