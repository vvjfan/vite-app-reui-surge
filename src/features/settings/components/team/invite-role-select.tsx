import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type InviteRoleId = "member" | "contributor" | "reviewer" | "admin"

interface InviteRoleOption {
  value: InviteRoleId
  label: string
  description: string
}

const INVITE_ROLE_OPTIONS: InviteRoleOption[] = [
  {
    value: "member",
    label: "Member",
    description: "Default collaboration access.",
  },
  {
    value: "contributor",
    label: "Contributor",
    description: "Create and edit assigned work.",
  },
  {
    value: "reviewer",
    label: "Reviewer",
    description: "Comment and approve work.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Manage people and settings.",
  },
]

interface InviteRoleSelectProps {
  id: string
  value: InviteRoleId
  label: string
  onValueChange: (value: InviteRoleId) => void
}

export function InviteRoleSelect({
  id,
  value,
  label,
  onValueChange,
}: InviteRoleSelectProps) {
  const selectedRole =
    INVITE_ROLE_OPTIONS.find((role) => role.value === value) ??
    INVITE_ROLE_OPTIONS[0]

  return (
    <Select
      items={INVITE_ROLE_OPTIONS}
      value={selectedRole}
      onValueChange={(nextValue) => {
        if (nextValue !== null) {
          onValueChange(nextValue.value)
        }
      }}
    >
      <SelectTrigger id={id} className="w-full" aria-label={label}>
        <SelectValue>
          {(role: InviteRoleOption | null) => role?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        <SelectGroup>
          {INVITE_ROLE_OPTIONS.map((role) => (
            <SelectItem key={role.value} value={role}>
              <span className="flex flex-col items-start gap-px">
                <span className="font-medium">{role.label}</span>
                <small className="text-xs text-muted-foreground">
                  {role.description}
                </small>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
