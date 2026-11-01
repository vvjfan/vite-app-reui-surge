"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type InviteRoleId } from "./invite-role-select"
import { MemberInviteRow, type InviteRow } from "./member-invite-row"
import { PlusIcon, PaperPlaneTiltIcon as SendIcon } from "@phosphor-icons/react"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_INVITE_ROLE_ID: InviteRoleId = "member"
const INITIAL_INVITE_ROWS: InviteRow[] = [
  {
    id: "invite-row-1",
    email: "",
    roleId: DEFAULT_INVITE_ROLE_ID,
  },
]

function isValidInviteEmail(email: string) {
  return EMAIL_PATTERN.test(email.trim())
}

function getReadyInviteCount(rows: InviteRow[]) {
  const emails = new Set<string>()

  for (const row of rows) {
    const normalizedEmail = row.email.trim().toLowerCase()

    if (isValidInviteEmail(normalizedEmail)) {
      emails.add(normalizedEmail)
    }
  }

  return emails.size
}

function hasInvalidInviteEmail(rows: InviteRow[]) {
  return rows.some((row) => {
    const email = row.email.trim()

    return email.length > 0 && !isValidInviteEmail(email)
  })
}

export function CollaboratorInviteDialog({
  open,
  onOpenChange,
  onInvite,
  isSending = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvite?: (invites: { email: string; roleId: InviteRoleId }[]) => void
  isSending?: boolean
}) {
  const [inviteRows, setInviteRows] = useState<InviteRow[]>(INITIAL_INVITE_ROWS)
  const nextInviteIndexRef = useRef(INITIAL_INVITE_ROWS.length + 1)
  const firstEmailInputRef = useRef<HTMLInputElement | null>(null)

  // Start from a blank row each time the dialog opens. Submitting no longer
  // resets, so that a failed send keeps what was typed.
  const [previousOpen, setPreviousOpen] = useState(open)
  if (previousOpen !== open) {
    setPreviousOpen(open)
    if (open) setInviteRows(INITIAL_INVITE_ROWS)
  }
  useEffect(() => {
    if (open) nextInviteIndexRef.current = INITIAL_INVITE_ROWS.length + 1
  }, [open])

  const readyInviteCount = getReadyInviteCount(inviteRows)
  const hasInvalidEmail = hasInvalidInviteEmail(inviteRows)
  const canSendInvites = readyInviteCount > 0 && !hasInvalidEmail && !isSending
  const submitLabel =
    readyInviteCount === 1 ? "Send invitation" : "Send invitations"

  const handleEmailChange = (rowId: string, email: string) => {
    setInviteRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, email } : row))
    )
  }

  const handleRoleChange = (rowId: string, roleId: InviteRoleId) => {
    setInviteRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, roleId } : row))
    )
  }

  const handleRemoveRow = (rowId: string) => {
    setInviteRows((currentRows) => {
      if (currentRows.length === 1) {
        return currentRows
      }

      return currentRows.filter((row) => row.id !== rowId)
    })
  }

  const handleAddRow = () => {
    const nextInviteIndex = nextInviteIndexRef.current
    nextInviteIndexRef.current += 1

    setInviteRows((currentRows) => [
      ...currentRows,
      {
        id: `invite-row-${nextInviteIndex}`,
        email: "",
        roleId: DEFAULT_INVITE_ROLE_ID,
      },
    ])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" initialFocus={firstEmailInputRef}>
        <DialogHeader>
          <DialogTitle>Invite Collaborators</DialogTitle>
          <DialogDescription>
            Add each person with the access they need.
          </DialogDescription>
        </DialogHeader>

        <form
          className="contents py-3"
          onSubmit={(event) => {
            event.preventDefault()

            if (canSendInvites) {
              const invites = inviteRows
                .filter((row) => isValidInviteEmail(row.email))
                .map((row) => ({
                  email: row.email.trim().toLowerCase(),
                  roleId: row.roleId,
                }))
              // Report the intent and stop. The owner of the mutation closes
              // this dialog and reports success, so a failed write leaves the
              // dialog open with the typed emails intact instead of claiming
              // the invites were sent.
              onInvite?.(invites)
            }
          }}
        >
          <div className="flex flex-col gap-2">
            {inviteRows.map((row, index) => {
              const hasEmail = row.email.trim().length > 0
              const isEmailInvalid = hasEmail && !isValidInviteEmail(row.email)

              return (
                <MemberInviteRow
                  key={row.id}
                  row={row}
                  rowNumber={index + 1}
                  canRemove={inviteRows.length > 1}
                  isEmailInvalid={isEmailInvalid}
                  emailInputRef={index === 0 ? firstEmailInputRef : undefined}
                  onEmailChange={handleEmailChange}
                  onRoleChange={handleRoleChange}
                  onRemove={handleRemoveRow}
                />
              )
            })}
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={handleAddRow}>
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Add new member
            </Button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSendInvites}>
              <SendIcon data-icon="inline-start" aria-hidden="true" />
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
