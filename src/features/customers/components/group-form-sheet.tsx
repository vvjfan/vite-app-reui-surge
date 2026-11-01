import { useState, type FormEvent, type ReactElement } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { CustomerGroup } from "@/lib/data/types"
import { useCreateGroup, useUpdateGroup } from "../queries"

// Error-key -> input id, in visual order, so a blocked submit focuses the first
// field that failed rather than jumping to whichever the object happened to list.
const FIELD_ORDER: Array<[string, string]> = [["name", "group-name"]]

// Shared create + edit form for a customer group (name + description).
export function GroupFormSheet({
  mode,
  group,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onCreated,
}: {
  mode: "create" | "edit"
  group?: CustomerGroup
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onCreated?: (group: CustomerGroup) => void
}) {
  const isEdit = mode === "edit" && !!group
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen

  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()
  const isSubmitting = createGroup.isPending || updateGroup.isPending

  // Inline validation state, one message per field. Errors surface under the
  // control (FieldError) and set aria-invalid, and clear as soon as the field
  // is edited, so the form corrects itself rather than nagging.
  const [errors, setErrors] = useState<Record<string, string>>({})
  function clearError(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    const data = new FormData(event.currentTarget)
    const name = String(data.get("name") ?? "").trim()
    const description =
      String(data.get("description") ?? "").trim() || undefined

    // Validate every field in one pass, so all problems show at once instead of
    // one toast per attempt.
    const nextErrors: Record<string, string> = {}
    if (!name) nextErrors.name = "Group name is required."

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      const firstInvalid = FIELD_ORDER.find(([key]) => nextErrors[key])
      if (firstInvalid) document.getElementById(firstInvalid[1])?.focus()
      return
    }
    setErrors({})

    if (isEdit) {
      updateGroup.mutate(
        { id: group.id, patch: { name, description } },
        {
          onSuccess: () => {
            setOpen(false)
            toast.success("Group saved", { description: name })
          },
        }
      )
      return
    }

    createGroup.mutate(
      { name, description, createdAt: new Date().toISOString() },
      {
        onSuccess: (created) => {
          setOpen(false)
          toast.success("Group created", { description: created.name })
          onCreated?.(created)
        },
      }
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Errors state sits on this (always-mounted) component, not on the
        // form that unmounts with SheetContent, so drop them on close to keep
        // a blocked submit from re-showing its message on the next open.
        if (!next) setErrors({})
        setOpen(next)
      }}
    >
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent
        side="right"
        className="z-50 flex flex-col gap-0 overflow-hidden rounded-xl bg-popover p-0 outline-none data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:left-auto data-[side=right]:h-[calc(100svh-2rem)] data-[side=right]:w-[min(30rem,calc(100vw-2rem))] data-[side=right]:max-w-none data-[side=right]:sm:max-w-none"
      >
        <SheetHeader className="border-b px-5 py-4 sm:px-6">
          <SheetTitle>{isEdit ? "Edit group" : "New group"}</SheetTitle>
          <SheetDescription>
            Groups segment customers for pricing, promotions, and campaigns.
          </SheetDescription>
        </SheetHeader>

        <form
          key={`${group?.id ?? "new"}-${open ? "open" : "closed"}`}
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="group-name">Name</FieldLabel>
              <Input
                id="group-name"
                name="name"
                defaultValue={group?.name}
                placeholder="e.g. VIP"
                autoComplete="off"
                required
                aria-invalid={!!errors.name}
                onInput={() => clearError("name")}
              />
              {errors.name ? <FieldError>{errors.name}</FieldError> : null}
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="group-description">Description</FieldLabel>
              <Textarea
                id="group-description"
                name="description"
                defaultValue={group?.description}
                placeholder="What defines this segment?"
                className="min-h-24"
              />
            </Field>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t px-5 py-4 sm:px-6">
            <SheetClose render={<Button type="button" variant="outline" />}>
              Cancel
            </SheetClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Spinner data-icon="inline-start" aria-hidden="true" />
              ) : null}
              {isEdit ? "Save changes" : "Create group"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
