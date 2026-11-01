import { CaretRightIcon as ChevronRightIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import type { AccountSecurity } from "@/lib/data/account"
import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { formatOrderDate } from "@/features/orders/lib/format"
import { SECURITY_SECTIONS, type SecurityRow } from "@/features/account/data"
import {
  useAccountSecurity,
  useUpdateAccountSecurity,
} from "@/features/account/queries"

function labelFor(
  options: { value: string; label: string }[],
  value: string
): string {
  return options.find((option) => option.value === value)?.label ?? value
}

// Two rows describe live state rather than a fixed sentence, so their copy is
// derived from the record instead of sitting in the static config.
function describe(row: SecurityRow, security: AccountSecurity): string {
  if (row.id === "password") {
    return `Last changed ${formatOrderDate(security.passwordChangedAt)}.`
  }
  if (row.id === "sessions") {
    const n = security.activeSessions
    return n <= 1
      ? "This device only."
      : `Signed in on ${n} devices, this one included.`
  }
  return row.description ?? ""
}

function SecurityItemRow({
  row,
  security,
  onPersist,
  onAction,
}: {
  row: SecurityRow
  security: AccountSecurity
  onPersist: (patch: Partial<AccountSecurity>) => void
  onAction: (action: "change-password" | "sign-out-others") => void
}) {
  // The second-step method is meaningless while two-factor is off, so it reads
  // as disabled rather than offering a choice that protects nothing.
  const disabled =
    row.control === "select" &&
    row.requiresTwoFactor === true &&
    !security.twoFactorEnabled

  return (
    <Item className="px-4">
      <ItemContent>
        <ItemTitle className="gap-2">
          {row.title}
          {row.badge ? (
            <Badge variant={row.badge.variant}>{row.badge.label}</Badge>
          ) : null}
        </ItemTitle>
        <ItemDescription>{describe(row, security)}</ItemDescription>
      </ItemContent>

      <ItemActions>
        {row.control === "switch" && (
          <Switch
            checked={security[row.key]}
            onCheckedChange={(checked) => onPersist({ [row.key]: checked })}
            aria-label={row.title}
          />
        )}

        {row.control === "select" && (
          <Select
            value={security[row.key]}
            disabled={disabled}
            onValueChange={(value) => value && onPersist({ [row.key]: value })}
          >
            <SelectTrigger className="w-40" aria-label={row.title}>
              <SelectValue>
                {labelFor(row.options, security[row.key])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {row.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}

        {row.control === "action" && (
          <Button
            variant="outline"
            disabled={
              row.action === "sign-out-others" && security.activeSessions <= 1
            }
            onClick={() => onAction(row.action)}
          >
            {row.actionLabel}
          </Button>
        )}
      </ItemActions>
    </Item>
  )
}

function SecuritySkeleton() {
  return (
    <div className="flex w-full flex-col gap-4">
      {[4, 2].map((rows, section) => (
        <Frame key={section} stacked dense spacing="sm">
          <FrameHeader className="px-4 py-2.5">
            <Skeleton className="h-4 w-24" />
          </FrameHeader>
          <FramePanel className="p-0!">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i}>
                {i > 0 ? <Separator /> : null}
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            ))}
          </FramePanel>
        </Frame>
      ))}
    </div>
  )
}

// Personal sign-in security, wired to the account-security singleton. Each
// switch and select persists on change (optimistic), matching the preferences
// page; the two action rows run a verb instead of writing a field.
//
// No secret is handled here. Changing a password is a credential flow that
// belongs to an auth provider, so this template surfaces the entry point and
// says so rather than collecting one.
export function SecuritySettings() {
  const securityQuery = useAccountSecurity()
  const security = securityQuery.data
  const updateSecurity = useUpdateAccountSecurity()

  if (securityQuery.isPending || !security) {
    return <SecuritySkeleton />
  }

  function persist(patch: Partial<AccountSecurity>) {
    if (!security) return
    updateSecurity.mutate({ ...security, ...patch })
  }

  function handleAction(action: "change-password" | "sign-out-others") {
    if (action === "change-password") {
      toast.info("Change password", {
        description: "Password changes run through your auth provider.",
      })
      return
    }
    // A real state change, not a toast-only gesture: the other sessions end, so
    // the row's own count has to come down with them.
    persist({ activeSessions: 1 })
    toast.success("Signed out other devices", {
      description: "Only this device is still signed in.",
    })
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {SECURITY_SECTIONS.map((section) => (
        <Frame key={section.id} stacked dense spacing="sm">
          <Collapsible defaultOpen>
            {/* Trigger rendered AS the FrameHeader, the same header-as-button
                the preferences page uses. */}
            <CollapsibleTrigger
              nativeButton={false}
              render={
                <FrameHeader className="flex w-full grow cursor-pointer flex-row items-center justify-between gap-2 px-4 py-2.5" />
              }
            >
              <FrameTitle>{section.title}</FrameTitle>
              <ChevronRightIcon
                className="mr-1 size-4 text-muted-foreground transition-transform in-data-open:rotate-90"
                aria-hidden="true"
              />
            </CollapsibleTrigger>

            <CollapsibleContent>
              <FramePanel className="p-0!">
                {section.items.map((row, index) => (
                  <div key={row.id}>
                    {index > 0 ? <Separator /> : null}
                    <SecurityItemRow
                      row={row}
                      security={security}
                      onPersist={persist}
                      onAction={handleAction}
                    />
                  </div>
                ))}
              </FramePanel>
            </CollapsibleContent>
          </Collapsible>
        </Frame>
      ))}
    </div>
  )
}
