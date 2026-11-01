"use client"

import { type Ref } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InviteRoleSelect, type InviteRoleId } from "./invite-role-select"
import { TrashIcon as Trash2Icon } from "@phosphor-icons/react"

export interface InviteRow {
  id: string
  email: string
  roleId: InviteRoleId
}

interface MemberInviteRowProps {
  row: InviteRow
  rowNumber: number
  canRemove: boolean
  isEmailInvalid: boolean
  emailInputRef?: Ref<HTMLInputElement>
  onEmailChange: (rowId: string, email: string) => void
  onRoleChange: (rowId: string, roleId: InviteRoleId) => void
  onRemove: (rowId: string) => void
}

export function MemberInviteRow({
  row,
  rowNumber,
  canRemove,
  isEmailInvalid,
  emailInputRef,
  onEmailChange,
  onRoleChange,
  onRemove,
}: MemberInviteRowProps) {
  const emailInputId = `${row.id}-email`
  const emailErrorId = `${row.id}-email-error`
  const roleSelectId = `${row.id}-role`

  return (
    <div
      className={cn(
        "grid gap-2 sm:items-start",
        canRemove
          ? "sm:grid-cols-[minmax(0,1fr)_15rem_2.5rem]"
          : "sm:grid-cols-[minmax(0,1fr)_15rem]"
      )}
    >
      <Field className="gap-1.5" data-invalid={isEmailInvalid || undefined}>
        <Input
          ref={emailInputRef}
          id={emailInputId}
          type="email"
          value={row.email}
          onChange={(event) => onEmailChange(row.id, event.target.value)}
          placeholder="Enter user email"
          autoComplete="email"
          aria-label={`Email address for invite ${rowNumber}`}
          aria-invalid={isEmailInvalid || undefined}
          aria-describedby={isEmailInvalid ? emailErrorId : undefined}
        />
        {isEmailInvalid ? (
          <FieldDescription id={emailErrorId}>
            Enter a valid email address.
          </FieldDescription>
        ) : null}
      </Field>

      <Field className="gap-1.5">
        <InviteRoleSelect
          id={roleSelectId}
          value={row.roleId}
          label={`Role for invite ${rowNumber}`}
          onValueChange={(roleId) => onRoleChange(row.id, roleId)}
        />
      </Field>

      {canRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="justify-self-start sm:justify-self-end"
          aria-label={`Remove invite row ${rowNumber}`}
          onClick={() => onRemove(row.id)}
        >
          <Trash2Icon aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  )
}
