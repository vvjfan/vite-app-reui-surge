import { type ReactNode } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TruncatedText } from "@/components/shared/truncated-text"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { cn } from "@/lib/utils"
import { useUpdateMembers } from "@/features/settings/queries"
import {
  AuthBadge,
  RoleBadge,
  StatusBadge,
  TeamTags,
  TwoFactorBadge,
  TwoFactorIcon,
} from "./columns"
import { BULK_ROLE_OPTIONS, type IMember, type MemberStatus } from "./data"
import {
  CheckIcon,
  CopyIcon,
  CrownIcon,
  EnvelopeIcon as MailIcon,
  XIcon,
} from "@phosphor-icons/react"

const mutedIconButtonClassName = "text-muted-foreground hover:text-foreground"

// The drawer stacks dense Frame cards, matching the Stock Detail and Order
// Details sheets. Panels drop their shadow: a card inside the sheet reads by
// its border, not a float of its own.
const FRAME_PANEL_RESET = "shadow-none!"

// The corner dot that marks whether the account is live, in the same status
// colors the row badges use. Semantic tokens only, so it tracks the theme.
const statusDotClass: Record<MemberStatus, string> = {
  Active: "bg-success",
  Invited: "bg-warning",
  Suspended: "bg-destructive",
  Deactivated: "bg-muted-foreground",
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
}

// SectionCard: one titled Frame card. Every block in the drawer is one of these,
// so the sheet keeps a single card rhythm top to bottom. The hero passes no
// label and reads as the first, headerless card.
function SectionCard({
  label,
  children,
}: {
  label?: string
  children: ReactNode
}) {
  return (
    <Frame dense spacing="sm" className="w-full">
      {label ? (
        <FrameHeader>
          <FrameTitle className="text-sm">{label}</FrameTitle>
        </FrameHeader>
      ) : null}
      <FramePanel className={FRAME_PANEL_RESET}>{children}</FramePanel>
    </Frame>
  )
}

// DField: one label/value fact on the shared two-column grid. The value is a
// node, so a badge, team tags, a tinted span, or mono text all sit on one grid.
function DField({
  label,
  mono,
  children,
}: {
  label: string
  mono?: boolean
  children: ReactNode
}) {
  return (
    <div className="contents">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-foreground",
          mono && "font-mono text-xs"
        )}
      >
        {children}
      </dd>
    </div>
  )
}

// CopyControl: copies a value and flips to a check while it holds. Rendered
// always (not on hover) so touch users get the affordance too.
function CopyControl({ value, label }: { value: string; label: string }) {
  const { isCopied, copyToClipboard } = useCopyToClipboard()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      className={cn("shrink-0", mutedIconButtonClassName)}
      onClick={() => {
        copyToClipboard(value)
        toast.success("Copied", { description: value })
      }}
    >
      {isCopied ? (
        <CheckIcon className="size-3.5 text-success" aria-hidden="true" />
      ) : (
        <CopyIcon className="size-3.5" aria-hidden="true" />
      )}
    </Button>
  )
}

// IdentityHero: who this is and whether the account is live. A dormant member
// (suspended or deactivated) reads dimmed and greyscaled, while the status
// badge and corner dot stay full color to name the reason at a glance.
function IdentityHero({ member }: { member: IMember }) {
  const dormant =
    member.status === "Suspended" || member.status === "Deactivated"
  return (
    <SectionCard>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <Avatar className={cn("size-16", dormant && "opacity-70")}>
              <AvatarImage
                src={member.avatar}
                alt=""
                className={cn(dormant && "grayscale")}
              />
              <AvatarFallback>{initials(member.name)}</AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-card",
                statusDotClass[member.status]
              )}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn(dormant && "opacity-70")}>
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-base font-semibold text-foreground">
                  {member.name}
                </span>
                {member.role === "Owner" ? (
                  <CrownIcon
                    className="size-4 shrink-0 text-warning"
                    aria-label="Owner"
                  />
                ) : null}
              </div>
              <div className="truncate text-sm text-muted-foreground">
                {member.title}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={member.status} />
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2",
            dormant && "opacity-70"
          )}
        >
          <MailIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <TruncatedText
            text={member.email}
            className="min-w-0 flex-1 text-sm text-foreground"
          />
          <CopyControl value={member.email} label="Copy email address" />
        </div>
      </div>
    </SectionCard>
  )
}

// The second factor as one dl value, so the Security card reads as a single
// list. An enrolled member shows the factor (the grid's badge). A missing factor
// is a warning only when the account is live: an invited or dormant account is
// not a risk worth alarming over, so it mutes rather than showing the grid's red.
function TwoFactorValue({ member }: { member: IMember }) {
  if (member.twoFactor) {
    return <TwoFactorBadge factor={member.twoFactor} />
  }
  if (member.status === "Active") {
    return (
      <Badge variant="warning-light">
        <TwoFactorIcon factor={null} />
        Not enrolled
      </Badge>
    )
  }
  return <Badge variant="secondary">Not enrolled</Badge>
}

// Role is the sheet's one editable field. It writes straight through, the way
// the members grid's bulk control does. An owner's role is not reassignable here
// (the assignable set omits Owner), so an owner reads as a static badge instead
// of a control that could only fail.
function RoleField({ member }: { member: IMember }) {
  const updateMembers = useUpdateMembers()

  if (member.role === "Owner") {
    return <RoleBadge role={member.role} />
  }

  return (
    <Select
      value={member.role}
      disabled={updateMembers.isPending}
      onValueChange={(role) => {
        if (!role || role === member.role) return
        updateMembers.mutate([{ id: member.id, patch: { role } }], {
          onSuccess: () =>
            toast.success("Role updated", {
              description: `${member.name} is now ${role}.`,
            }),
        })
      }}
      items={BULK_ROLE_OPTIONS}
    >
      <SelectTrigger className="h-8 w-40" aria-label="Member role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {BULK_ROLE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function MemberDetailSheet({
  member,
  open,
  onOpenChange,
}: {
  member: IMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const seatMuted =
    member?.seatLabel === "Pending seat" ||
    member?.seatLabel === "Seat released"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-xl p-0 outline-none data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:left-auto data-[side=right]:h-[calc(100svh-2rem)] data-[side=right]:w-[min(30rem,calc(100vw-2rem))] data-[side=right]:max-w-none data-[side=right]:sm:max-w-none"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 border-b px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="min-w-0 truncate">Member Profile</SheetTitle>
            <SheetClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close sheet"
                  className={mutedIconButtonClassName}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              }
            />
          </div>
          <SheetDescription className="sr-only">
            Review role, teams, and authentication for this member.
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            {member ? (
              <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
                <IdentityHero member={member} />

                <SectionCard label="Access">
                  <dl className="grid grid-cols-[7.5rem_1fr] items-center gap-x-4 gap-y-2.5">
                    <DField label="Role">
                      <RoleField member={member} />
                    </DField>
                    <DField label="Permission scope">
                      <span
                        className={cn(
                          member.scope === "None" && "text-muted-foreground"
                        )}
                      >
                        {member.scope}
                      </span>
                    </DField>
                    <DField label="Teams">
                      {member.teams.length ? (
                        <TeamTags teams={member.teams} />
                      ) : (
                        <span className="text-muted-foreground">No teams</span>
                      )}
                    </DField>
                  </dl>
                </SectionCard>

                <SectionCard label="Security">
                  <dl className="grid grid-cols-[7.5rem_1fr] items-center gap-x-4 gap-y-2.5">
                    <DField label="Two-factor">
                      <TwoFactorValue member={member} />
                    </DField>
                    <DField label="Sign-in method">
                      <AuthBadge
                        auth={member.auth}
                        ssoProvider={member.ssoProvider}
                      />
                    </DField>
                    <DField label="Provisioning">{member.provisioning}</DField>
                  </dl>
                </SectionCard>

                <SectionCard label="Account">
                  <dl className="grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-2.5">
                    <DField label="Seat">
                      <span
                        className={cn(seatMuted && "text-muted-foreground")}
                      >
                        {member.seatLabel}
                      </span>
                    </DField>
                    <DField label="Last active">
                      <span className="text-muted-foreground">
                        {member.lastActive}
                      </span>
                    </DField>
                    <DField label="Member ID" mono>
                      <span className="truncate">{member.id}</span>
                      <CopyControl value={member.id} label="Copy member ID" />
                    </DField>
                  </dl>
                </SectionCard>
              </div>
            ) : null}
          </ScrollArea>
        </div>

        {/* Footer */}
        <SheetFooter className="shrink-0 border-t bg-background px-5 py-4 sm:px-6">
          <SheetClose
            render={
              <Button type="button" variant="outline" className="w-full">
                Close
              </Button>
            }
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
