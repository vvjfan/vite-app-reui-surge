import { useTheme } from "@/components/theme-provider"
import { CaretRightIcon as ChevronRightIcon } from "@phosphor-icons/react"

import type { AccountPreferences } from "@/lib/data/account"
import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
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

import {
  PREFERENCE_SECTIONS,
  type PreferenceItem,
  type SelectOption,
} from "@/features/account/data"
import {
  useAccountPreferences,
  useUpdateAccountPreferences,
} from "@/features/account/queries"

function labelFor(options: SelectOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}

function PreferenceRow({
  item,
  prefs,
  themeValue,
  onPersist,
  onTheme,
}: {
  item: PreferenceItem
  prefs: AccountPreferences
  themeValue: string
  onPersist: (patch: Partial<AccountPreferences>) => void
  onTheme: (value: string) => void
}) {
  return (
    <Item className="px-4">
      <ItemContent>
        <ItemTitle className="gap-2">
          {item.title}
          {item.badge ? (
            <Badge variant={item.badge.variant}>{item.badge.label}</Badge>
          ) : null}
        </ItemTitle>
        <ItemDescription>{item.description}</ItemDescription>
      </ItemContent>

      <ItemActions>
        {item.control === "select" && (
          <Select
            value={prefs[item.key]}
            onValueChange={(value) => value && onPersist({ [item.key]: value })}
          >
            <SelectTrigger className="w-40" aria-label={item.title}>
              <SelectValue>
                {labelFor(item.options, prefs[item.key])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {item.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}

        {item.control === "theme" && (
          <Select
            value={themeValue}
            onValueChange={(value) => value && onTheme(value)}
          >
            <SelectTrigger className="w-40" aria-label={item.title}>
              <SelectValue>{labelFor(item.options, themeValue)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {item.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}

        {item.control === "switch" && (
          <Switch
            checked={prefs[item.key]}
            onCheckedChange={(checked) => onPersist({ [item.key]: checked })}
            aria-label={item.title}
          />
        )}
      </ItemActions>
    </Item>
  )
}

function PreferencesSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4">
      {[3, 3].map((rows, s) => (
        <Frame key={s} stacked dense spacing="sm">
          <FrameHeader className="px-4 py-2.5">
            <Skeleton className="h-4 w-24" />
          </FrameHeader>
          <FramePanel className="p-0!">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i}>
                {i > 0 ? <Separator /> : null}
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-52" />
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

// Personal preferences, relocated from the ReUI settings-9 block and wired to the
// account-preferences singleton. Each control persists on change (optimistic),
// matching the block's no-save-button design. The color theme is the exception:
// it is owned by ThemeProvider so it stays in sync with the sidebar avatar toggle.
export function PreferencesSettings() {
  const prefsQuery = useAccountPreferences()
  const prefs = prefsQuery.data
  const updatePrefs = useUpdateAccountPreferences()

  const { theme, setTheme } = useTheme()
  if (prefsQuery.isPending || !prefs) {
    return <PreferencesSkeleton />
  }

  const themeValue = theme

  function persist(patch: Partial<AccountPreferences>) {
    if (!prefs) return
    updatePrefs.mutate({ ...prefs, ...patch })
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {PREFERENCE_SECTIONS.map((section) => (
        <Frame key={section.id} stacked dense spacing="sm">
          <Collapsible defaultOpen>
            {/* Render the trigger AS the FrameHeader so we get a semantic
                header-as-button, not an invalid <button><header> nesting.
                nativeButton={false} lets base-ui apply the ARIA button pattern
                to the non-button element (keyboard + role) without warning. */}
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
                {section.items.map((item, index) => (
                  <div key={item.id}>
                    {index > 0 ? <Separator /> : null}
                    <PreferenceRow
                      item={item}
                      prefs={prefs}
                      themeValue={themeValue}
                      onPersist={persist}
                      onTheme={(value) => {
                        if (
                          value === "light" ||
                          value === "dark" ||
                          value === "system"
                        )
                          setTheme(value)
                      }}
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
