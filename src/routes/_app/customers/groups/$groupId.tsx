import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { cn } from "@/lib/utils"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { initials } from "@/features/orders/lib/format"
import { GroupFormSheet } from "@/features/customers/components/group-form-sheet"
import {
  customerGroupDetailQuery,
  customersInGroup,
  customersListQuery,
  useDeleteGroup,
  useSetCustomerGroups,
} from "@/features/customers/queries"
import type { Customer } from "@/lib/data/types"
import {
  ArrowLeftIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon as Trash2Icon,
  UsersIcon,
  XIcon,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_app/customers/groups/$groupId")({
  component: GroupDetailPage,
})

function AddMembersDialog({
  groupId,
  candidates,
  open,
  onOpenChange,
}: {
  groupId: string
  candidates: Customer[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const setGroups = useSetCustomerGroups()
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)
    )

  const add = () => {
    const updates = selected.map((id) => {
      const customer = candidates.find((c) => c.id === id)
      return {
        id,
        groups: [...new Set([...(customer?.groups ?? []), groupId])],
      }
    })
    setGroups.mutate(updates, {
      onSuccess: () => {
        onOpenChange(false)
        setSelected([])
        toast.success(`${updates.length} added to the group`)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Add members</DialogTitle>
          <DialogDescription>
            Select customers to add to this group.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-80">
          <div className="flex flex-col gap-1 p-3">
            {candidates.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Every customer is already in this group.
              </p>
            ) : (
              candidates.map((customer) => (
                <label
                  key={customer.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={selected.includes(customer.id)}
                    onCheckedChange={(checked) =>
                      toggle(customer.id, checked === true)
                    }
                  />
                  <Avatar className="size-8 shrink-0">
                    {customer.avatar ? (
                      <AvatarImage src={customer.avatar} alt="" />
                    ) : null}
                    <AvatarFallback className="text-xs">
                      {initials(customer.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-foreground">
                      {customer.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {customer.email}
                    </span>
                  </div>
                </label>
              ))
            )}
          </div>
        </ScrollArea>
        {/* The footer primitive's negative margins counter the popup's default
            padding; this dialog is p-0, so they are zeroed or the bar juts
            past the rounded corners. */}
        <DialogFooter className="mx-0 mb-0 px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={add}
            disabled={selected.length === 0 || setGroups.isPending}
          >
            Add{selected.length > 0 ? ` ${selected.length}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GroupDetailPage() {
  const { groupId } = Route.useParams()
  const navigate = useNavigate()
  const groupQuery = useQuery(customerGroupDetailQuery(groupId))
  const customersQuery = useQuery(customersListQuery())
  const customers = customersQuery.data ?? []
  const deleteGroup = useDeleteGroup()
  const setGroups = useSetCustomerGroups()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  if (groupQuery.isPending) {
    return (
      <div className="flex flex-col items-center gap-3 p-16 text-muted-foreground">
        <Spinner className="size-6" />
        <p className="text-sm">Loading group</p>
      </div>
    )
  }

  const group = groupQuery.data
  if (!group) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 p-10 text-center">
        <UsersIcon
          className="size-10 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-foreground">Group not found</p>
        <Link
          to="/customers/groups"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to groups
        </Link>
      </div>
    )
  }

  const members = customersInGroup(customers, group.id)
  const candidates = customers.filter((c) => !c.groups.includes(group.id))

  const removeMember = (customer: Customer) => {
    setGroups.mutate(
      [
        {
          id: customer.id,
          groups: customer.groups.filter((g) => g !== group.id),
        },
      ],
      {
        onSuccess: () =>
          toast.message("Removed from group", { description: customer.name }),
      }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={group.name}
        description={
          group.description ??
          `${members.length} ${members.length === 1 ? "customer" : "customers"}`
        }
        actions={
          <div className="flex items-center gap-2">
            {/* A real route up, not history.back(): the page is deep-linkable,
                so "back" has to mean the groups list rather than wherever the
                browser happened to come from. */}
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link to="/customers/groups" />}
            >
              <ArrowLeftIcon
                data-icon="inline-start"
                className="size-4"
                aria-hidden="true"
              />
              Back
            </Button>
            <GroupFormSheet
              mode="edit"
              group={group}
              trigger={
                <Button variant="outline">
                  <PencilIcon
                    data-icon="inline-start"
                    className="size-4"
                    aria-hidden="true"
                  />
                  Edit
                </Button>
              }
            />
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2Icon
                data-icon="inline-start"
                className="size-4"
                aria-hidden="true"
              />
              Delete
            </Button>
          </div>
        }
      />

      <Frame dense className="w-full">
        <FrameHeader className="flex-row items-center justify-between gap-3">
          <FrameTitle>Members ({members.length})</FrameTitle>
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <PlusIcon
              data-icon="inline-start"
              className="size-4"
              aria-hidden="true"
            />
            Add members
          </Button>
        </FrameHeader>
        <FramePanel className="flex flex-col gap-0 p-0! shadow-none!">
          {/* The member list derives from the customers read, so its empty
              state may only speak once that read has settled. */}
          {customersQuery.isPending ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <Spinner className="size-4" /> Loading members
            </div>
          ) : members.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No members yet. Add customers to this group.
            </p>
          ) : (
            members.map((customer) => (
              <div
                key={customer.id}
                className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0"
              >
                <Avatar className="size-8 shrink-0">
                  {customer.avatar ? (
                    <AvatarImage src={customer.avatar} alt="" />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {initials(customer.name)}
                  </AvatarFallback>
                </Avatar>
                <Link
                  to="/customers/$handle"
                  params={{ handle: customer.id }}
                  className="flex min-w-0 flex-1 flex-col gap-0.5"
                >
                  <span className="truncate text-sm font-medium text-foreground hover:text-primary">
                    {customer.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {customer.email}
                  </span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${customer.name}`}
                  onClick={() => removeMember(customer)}
                >
                  <XIcon className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))
          )}
        </FramePanel>
      </Frame>

      <AddMembersDialog
        groupId={group.id}
        candidates={candidates}
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this group?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the{" "}
              <span className="font-medium text-foreground">{group.name}</span>{" "}
              group. Members keep their records; they just leave this segment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep group</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDeleteOpen(false)
                deleteGroup.mutate(group.id, {
                  onSuccess: () =>
                    toast.success("Group deleted", { description: group.name }),
                })
                navigate({ to: "/customers/groups" })
              }}
            >
              Delete group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
