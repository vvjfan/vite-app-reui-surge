"use client"

import { memo, useState } from "react"
import { Badge } from "@/components/reui/badge"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import {
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@/components/reui/data-grid/data-grid-table"
import type { ColumnDef, Row } from "@tanstack/react-table"
import { toast } from "sonner"

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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useRemoveMember, useUpdateMembers } from "@/features/settings/queries"
import {
  BULK_ROLE_OPTIONS,
  type AuthMethod,
  type IMember,
  type MemberRole,
  type MemberStatus,
  type SsoProvider,
  type TeamLabel,
  type TwoFactor,
} from "./data"
import {
  ShieldCheckIcon,
  LockIcon,
  WarningIcon as TriangleAlertIcon,
  KeyIcon as KeyRoundIcon,
  DotsThreeIcon as MoreHorizontalIcon,
  EyeIcon,
  PencilIcon,
  PaperPlaneTiltIcon as SendIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  TrashIcon as Trash2Icon,
} from "@phosphor-icons/react"

// ── Team tags ──

export const TeamTags = memo(function TeamTags({
  teams,
}: {
  teams: TeamLabel[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {teams.map((team) => (
        <Badge key={team} variant="secondary">
          {team}
        </Badge>
      ))}
    </div>
  )
})

// ── Status badge ──

const statusBadgeVariant: Record<
  MemberStatus,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  Active: "success-light",
  Invited: "warning-light",
  Suspended: "destructive-light",
  Deactivated: "secondary",
}

export function StatusBadge({ status }: { status: MemberStatus }) {
  return <Badge variant={statusBadgeVariant[status]}>{status}</Badge>
}

// ── Role badge ──

export function RoleBadge({ role }: { role: MemberRole }) {
  return <Badge variant="secondary">{role}</Badge>
}

// ── Member cell (same layout as the donor ContactCell) ──

const MemberCell = memo(function MemberCell({ row }: { row: Row<IMember> }) {
  const o = row.original

  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={o.avatar} alt="" />
        <AvatarFallback>
          {o.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="line-clamp-1 font-medium text-foreground">{o.name}</div>
        <div
          className="line-clamp-1 text-xs text-muted-foreground"
          title={o.email}
        >
          {o.email}
        </div>
      </div>
    </div>
  )
})

// ── Auth cell (SSO / 2FA badges) ──

export const authBadgeVariant: Record<
  AuthMethod,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  SSO: "success-light",
  Password: "warning-light",
}

export const twoFactorBadgeVariant: Record<
  TwoFactor,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  Authenticator: "info-light",
  Passkey: "success-light",
  "Security key": "success-light",
  SMS: "warning-light",
}

export function AuthMethodIcon({ auth }: { auth: AuthMethod }) {
  if (auth === "SSO") {
    return <ShieldCheckIcon aria-hidden="true" />
  }

  return <LockIcon aria-hidden="true" />
}

export function TwoFactorIcon({ factor }: { factor: TwoFactor | null }) {
  if (!factor) {
    return <TriangleAlertIcon aria-hidden="true" />
  }

  return <KeyRoundIcon aria-hidden="true" />
}

// The sign-in badge: the method with its icon, naming the SSO provider when
// there is one. Shared with the member profile sheet so both read identically.
export function AuthBadge({
  auth,
  ssoProvider,
}: {
  auth: AuthMethod
  ssoProvider: SsoProvider | null
}) {
  return (
    <Badge variant={authBadgeVariant[auth]}>
      <AuthMethodIcon auth={auth} />
      {auth === "SSO" ? (ssoProvider ?? "SSO") : "Password"}
    </Badge>
  )
}

// The second-factor badge. A member with no factor reads destructive here, the
// grid's convention; the profile sheet softens the same fact to a warning in
// its own editorial layer without changing this.
export function TwoFactorBadge({ factor }: { factor: TwoFactor | null }) {
  return (
    <Badge
      variant={factor ? twoFactorBadgeVariant[factor] : "destructive-light"}
    >
      <TwoFactorIcon factor={factor} />
      {factor ?? "No 2FA"}
    </Badge>
  )
}

function AuthCell({ row }: { row: Row<IMember> }) {
  const { auth, ssoProvider, twoFactor } = row.original

  return (
    <div className="flex flex-wrap items-center gap-1">
      <AuthBadge auth={auth} ssoProvider={ssoProvider} />
      <TwoFactorBadge factor={twoFactor} />
    </div>
  )
}

// ── Actions cell ──

export function ActionsCell({
  row,
  onView,
}: {
  row: Row<IMember>
  onView: (member: IMember) => void
}) {
  const [removeOpen, setRemoveOpen] = useState(false)
  const member = row.original
  const removeMember = useRemoveMember()
  const updateMembers = useUpdateMembers()

  // Suspend is a toggle against Member.status: a suspended member is reinstated
  // to Active. Both write through the same mutation the bulk bar uses, so the
  // status badge re-renders from the optimistic cache and the toast agrees with
  // the row. Owners are exempt: suspending or removing the last owner would lock
  // the store out of its own settings.
  const isSuspended = member.status === "Suspended"
  const isOwner = member.role === "Owner"

  const setStatus = (status: MemberStatus, message: string) =>
    updateMembers.mutate([{ id: member.id, patch: { status } }], {
      onSuccess: () => toast.message(message, { description: member.name }),
    })

  const setRole = (role: MemberRole) => {
    if (role === member.role) return
    updateMembers.mutate([{ id: member.id, patch: { role } }], {
      onSuccess: () =>
        toast.success("Role updated", {
          description: `${member.name} is now ${role}.`,
        }),
    })
  }

  const handleRemoveConfirm = () => {
    setRemoveOpen(false)
    removeMember.mutate(member.id, {
      onSuccess: () =>
        toast.success("Member removed", {
          description: `${member.name} loses access immediately.`,
        }),
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="icon-sm" variant="ghost" aria-label="Row actions" />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onView(member)}>
              <EyeIcon className="size-4" aria-hidden="true" />
              View Profile
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={isOwner}>
                <PencilIcon className="size-4" aria-hidden="true" />
                Edit Role
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40">
                <DropdownMenuRadioGroup
                  value={member.role}
                  onValueChange={(value) => setRole(value as MemberRole)}
                >
                  {BULK_ROLE_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Only an outstanding invite can be resent. There is no mail
                backend, so the toast is the honest end of this flow. */}
            {member.status === "Invited" ? (
              <DropdownMenuItem
                onClick={() =>
                  toast.info("Invite resent", {
                    description: `New link sent to ${member.email}. Expires in 7 days.`,
                  })
                }
              >
                <SendIcon className="size-4" aria-hidden="true" />
                Resend Invite
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuItem
              disabled={isOwner || updateMembers.isPending}
              onClick={() =>
                isSuspended
                  ? setStatus("Active", "Member reinstated")
                  : setStatus("Suspended", "Member suspended")
              }
            >
              {isSuspended ? (
                <PlayCircleIcon className="size-4" aria-hidden="true" />
              ) : (
                <PauseCircleIcon className="size-4" aria-hidden="true" />
              )}
              {isSuspended ? "Reinstate" : "Suspend"}
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={isOwner}
              onClick={() => setRemoveOpen(true)}
            >
              <Trash2Icon className="size-4" aria-hidden="true" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              This revokes access for{" "}
              <span className="font-medium text-foreground">{member.name}</span>{" "}
              and frees their seat. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeMember.isPending}
              onClick={handleRemoveConfirm}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Column definitions ──

interface ColumnHandlers {
  onView: (member: IMember) => void
}

export function createMemberColumns({
  onView,
}: ColumnHandlers): ColumnDef<IMember>[] {
  return [
    {
      id: "select",
      header: () => <DataGridTableRowSelectAll />,
      cell: ({ row }) => <DataGridTableRowSelect row={row} />,
      enableSorting: false,
      size: 40,
      enableResizing: false,
      enableHiding: false,
      meta: {
        skeleton: <Skeleton className="mx-auto size-5" />,
        headerClassName: "ps-(--frame-panel-px)",
        cellClassName: "ps-(--frame-panel-px)",
      },
    },
    {
      accessorKey: "name",
      id: "name",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Member"
          visibility={true}
          column={column}
        />
      ),
      cell: ({ row }) => <MemberCell row={row} />,
      enableSorting: true,
      enableHiding: false,
      enableResizing: true,
      minSize: 220,
      // No `meta.autoSize` here: the data grid grows an auto-size column by
      // writing column sizing from a ResizeObserver, and this grid does not
      // control column sizing, so that write and the observer chase each other
      // every frame and stall the first paint. The column takes minSize instead.
      meta: {
        headerTitle: "Member",
        skeleton: (
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ),
      },
    },
    {
      accessorKey: "role",
      id: "role",
      header: ({ column }) => (
        <DataGridColumnHeader title="Role" visibility={true} column={column} />
      ),
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
      size: 120,
      enableSorting: true,
      enableHiding: true,
      enableResizing: true,
      meta: {
        headerTitle: "Role",
        skeleton: <Skeleton className="h-5 w-16 rounded-sm" />,
      },
    },
    {
      accessorKey: "teams",
      id: "teams",
      header: ({ column }) => (
        <DataGridColumnHeader title="Teams" visibility={true} column={column} />
      ),
      cell: ({ row }) => <TeamTags teams={row.original.teams} />,
      size: 200,
      enableSorting: false,
      enableHiding: true,
      enableResizing: true,
      meta: {
        headerTitle: "Teams",
        skeleton: (
          <div className="flex flex-wrap items-center gap-1">
            <Skeleton className="h-5 w-20 rounded-sm" />
            <Skeleton className="h-5 w-16 rounded-sm" />
          </div>
        ),
      },
    },
    {
      accessorKey: "status",
      id: "status",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Status"
          visibility={true}
          column={column}
        />
      ),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      size: 120,
      enableSorting: true,
      enableHiding: true,
      enableResizing: true,
      meta: {
        headerTitle: "Status",
        skeleton: <Skeleton className="h-5 w-20 rounded-sm" />,
      },
    },
    {
      accessorKey: "auth",
      id: "auth",
      header: ({ column }) => (
        <DataGridColumnHeader title="Auth" visibility={true} column={column} />
      ),
      cell: ({ row }) => <AuthCell row={row} />,
      size: 220,
      enableSorting: false,
      enableHiding: true,
      enableResizing: true,
      meta: {
        headerTitle: "Auth",
        skeleton: (
          <div className="flex items-center gap-1">
            <Skeleton className="h-5 w-20 rounded-sm" />
            <Skeleton className="h-5 w-24 rounded-sm" />
          </div>
        ),
      },
    },
    {
      accessorKey: "lastActiveIso",
      id: "lastActive",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Last Active"
          visibility={true}
          column={column}
        />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.lastActive}
        </span>
      ),
      size: 130,
      enableSorting: true,
      enableHiding: true,
      enableResizing: true,
      meta: {
        headerTitle: "Last Active",
        skeleton: <Skeleton className="h-4 w-28" />,
      },
    },
    {
      accessorKey: "seatLabel",
      id: "seat",
      header: ({ column }) => (
        <DataGridColumnHeader title="Seat" visibility={true} column={column} />
      ),
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {row.original.seatLabel}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {row.original.provisioning}
          </div>
        </div>
      ),
      size: 140,
      enableSorting: true,
      enableHiding: true,
      enableResizing: true,
      meta: {
        headerTitle: "Seat",
        skeleton: (
          <div className="flex min-w-0 flex-col gap-0.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ),
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => <ActionsCell row={row} onView={onView} />,
      size: 60,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: {
        skeleton: <Skeleton className="mx-auto size-7 rounded-md" />,
        headerClassName:
          "[--data-grid-header-cell-pe:var(--frame-panel-header-px)]",
        cellClassName: "[--data-grid-body-cell-pe:var(--frame-panel-px)]",
      },
    },
  ]
}
