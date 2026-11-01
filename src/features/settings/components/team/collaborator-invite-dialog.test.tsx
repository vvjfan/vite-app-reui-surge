// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CollaboratorInviteDialog } from "./collaborator-invite-dialog"

// This dialog gates its submit button on the form being valid, rather than
// letting the submit run and reporting errors. That pattern has one failure
// mode worth pinning: a button that never re-enables, leaving a filled-in form
// the operator cannot send and no message saying why. So the assertions here
// are about the TRANSITION - disabled while empty or malformed, enabled the
// moment a real address is typed - not just the initial state.

function renderDialog(onInvite = vi.fn()) {
  render(
    <CollaboratorInviteDialog
      open
      onOpenChange={() => {}}
      onInvite={onInvite}
    />
  )
  return onInvite
}

const sendButton = () => screen.getByRole("button", { name: /Send invitation/ })

const typeEmail = (value: string) => {
  const field = screen.getByPlaceholderText("Enter user email")
  fireEvent.change(field, { target: { value } })
  fireEvent.input(field, { target: { value } })
}

afterEach(() => {
  cleanup()
})

describe("collaborator invite dialog", () => {
  it("starts disabled with no email to send to", () => {
    renderDialog()
    expect(sendButton().hasAttribute("disabled")).toBe(true)
  })

  it("enables as soon as a valid address is typed", async () => {
    renderDialog()
    typeEmail("newhire@acmecloud.com")

    await waitFor(() => {
      expect(sendButton().hasAttribute("disabled")).toBe(false)
    })
  })

  it("stays disabled for a malformed address", async () => {
    renderDialog()
    typeEmail("newhire@")

    await waitFor(() => {
      expect(sendButton().hasAttribute("disabled")).toBe(true)
    })
  })

  it("re-enables after a bad address is corrected", async () => {
    // The stuck-button failure mode: once the form has been invalid, typing a
    // good value must bring the button back.
    renderDialog()
    typeEmail("nope")
    await waitFor(() =>
      expect(sendButton().hasAttribute("disabled")).toBe(true)
    )

    typeEmail("newhire@acmecloud.com")
    await waitFor(() =>
      expect(sendButton().hasAttribute("disabled")).toBe(false)
    )
  })

  it("reports the invite to its owner on submit", async () => {
    const onInvite = renderDialog()
    typeEmail("newhire@acmecloud.com")
    await waitFor(() =>
      expect(sendButton().hasAttribute("disabled")).toBe(false)
    )

    fireEvent.click(sendButton())

    await waitFor(() => {
      expect(onInvite).toHaveBeenCalledTimes(1)
    })
    // Normalized on the way out: the store should not care how it was typed.
    expect(onInvite.mock.calls[0][0]).toEqual([
      { email: "newhire@acmecloud.com", roleId: expect.anything() },
    ])
  })

  it("does not report anything while the form is invalid", async () => {
    const onInvite = renderDialog()
    typeEmail("nope")
    await waitFor(() =>
      expect(sendButton().hasAttribute("disabled")).toBe(true)
    )

    fireEvent.click(sendButton())

    await new Promise((r) => setTimeout(r, 200))
    expect(onInvite).not.toHaveBeenCalled()
  })
})
