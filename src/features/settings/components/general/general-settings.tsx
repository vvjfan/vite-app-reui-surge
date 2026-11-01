import { Fragment, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useSetting, useUpdateSetting } from "@/features/settings/queries"
import { BrandColorPicker } from "./brand-color-picker"
import {
  CURRENCIES,
  DEFAULT_STORE_PROFILE,
  getOptionLabel,
  REGIONS,
  STORE_PROFILE_KEY,
  TIMEZONES,
  type StoreProfile,
} from "./data"
import { SettingField } from "./setting-field"
import { StorefrontPreferences } from "./storefront-preferences"
import {
  CurrencyCircleDollarIcon as CircleDollarSignIcon,
  GlobeIcon,
  LinkIcon,
  UploadSimpleIcon as UploadIcon,
} from "@phosphor-icons/react"

// Placeholder shown while the client reads the profile from the store, so the
// seed is never rendered before the DB read settles. Mirrors the form layout.
function GeneralSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader title="General" />
      <Frame dense className="w-full">
        <FrameHeader>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </FrameHeader>
        <FramePanel className="p-0">
          <FieldGroup className="gap-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <Fragment key={i}>
                {/* Same Field/FieldContent geometry as SettingField, so the
                    placeholder columns land where the real controls will. */}
                <Field orientation="responsive" className="gap-4 px-4 py-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 @md/field-group:max-w-sm">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <FieldContent className="min-w-0 @md/field-group:w-78">
                    <Skeleton className="h-8 w-full" />
                  </FieldContent>
                </Field>
                {i < 5 ? <FieldSeparator /> : null}
              </Fragment>
            ))}
          </FieldGroup>
        </FramePanel>
        <FrameFooter className="flex flex-row justify-end gap-3">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-28" />
        </FrameFooter>
      </Frame>
    </div>
  )
}

// Store profile (General) settings, relocated from the ReUI settings-3 block and
// wired to the settings singleton: it loads the saved profile, edits a
// local draft, and persists on Save (reflected in the shell store switcher).
export function GeneralSettings() {
  const profileQuery = useSetting<StoreProfile>(
    STORE_PROFILE_KEY,
    DEFAULT_STORE_PROFILE
  )
  const saved = profileQuery.data
  const updateProfile = useUpdateSetting<StoreProfile>(STORE_PROFILE_KEY)

  // Draft starts null and is populated from the first store read, so the seed is
  // never shown. Later loads/saves sync the draft only when it is not dirty -
  // otherwise in-progress edits get clobbered.
  const [draft, setDraft] = useState<StoreProfile | null>(null)
  const savedRef = useRef<StoreProfile | undefined>(undefined)
  useEffect(() => {
    if (saved === undefined) return
    const prevSaved = savedRef.current
    savedRef.current = saved
    setDraft((current) =>
      current === null || current === prevSaved ? saved : current
    )
  }, [saved])

  function set<TKey extends keyof StoreProfile>(
    key: TKey,
    value: StoreProfile[TKey]
  ) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function handleSave() {
    if (!draft) return
    updateProfile.mutate(draft, {
      onSuccess: () => toast.success("Store settings saved"),
    })
  }

  // Read only from the store: hold the form on a skeleton until the profile
  // loads and the draft is seeded from it (never from the in-code default).
  if (profileQuery.isPending || draft === null) {
    return <GeneralSkeleton />
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader title="General" />
      <Frame dense className="w-full">
        <FrameHeader>
          <FrameTitle>Store profile</FrameTitle>
          <FrameDescription>
            Name, domain, branding, and regional defaults.
          </FrameDescription>
        </FrameHeader>
        <FramePanel className="p-0">
          <FieldGroup className="gap-0">
            {/* Store name */}
            <SettingField
              title="Store name"
              description="The name customers see across your storefront and emails."
              labelFor="settings-general-store-name"
            >
              <Input
                id="settings-general-store-name"
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </SettingField>

            {/* Store URL */}
            <SettingField
              title="Store URL"
              description="Your primary storefront domain."
              labelFor="settings-general-store-url"
            >
              <InputGroup className="w-full">
                <InputGroupAddon align="inline-start">
                  <InputGroupText>https://</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="settings-general-store-url"
                  value={draft.url}
                  onChange={(e) => set("url", e.target.value)}
                />
              </InputGroup>
            </SettingField>

            {/* Timezone */}
            <SettingField
              title="Timezone"
              description="Used for order timestamps, reports, and scheduling."
              labelFor="settings-general-timezone"
            >
              <Select
                value={draft.timezone}
                onValueChange={(v) => v && set("timezone", v)}
              >
                <SelectTrigger
                  id="settings-general-timezone"
                  className="w-full"
                >
                  <SelectValue>
                    {getOptionLabel(TIMEZONES, draft.timezone)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </SettingField>

            {/* Store logo */}
            <SettingField
              title="Store logo"
              description="Shown in the storefront header, checkout, and emails."
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline">
                  <UploadIcon aria-hidden="true" />
                  Upload logo
                </Button>
                <Button variant="outline">
                  <LinkIcon aria-hidden="true" />
                  Import from URL
                </Button>
              </div>
            </SettingField>

            {/* Brand color */}
            <SettingField
              title="Brand color"
              description="Select a color to represent your store."
            >
              <BrandColorPicker
                value={draft.brandColor}
                onChange={(v) => set("brandColor", v)}
              />
            </SettingField>

            {/* Region & currency */}
            <SettingField
              title="Region & currency"
              description="Adjust your regional preferences and store currency."
              contentClassName="@md/field-group:w-[22rem]"
            >
              <FieldSet className="w-full gap-3">
                <FieldLegend className="sr-only">
                  Region and currency
                </FieldLegend>
                <FieldDescription className="sr-only">
                  Regional and financial formatting preferences.
                </FieldDescription>

                <FieldGroup className="gap-3">
                  <Field>
                    <FieldLabel htmlFor="settings-general-region">
                      Region
                    </FieldLabel>
                    <Select
                      value={draft.region}
                      onValueChange={(v) => v && set("region", v)}
                    >
                      <SelectTrigger
                        id="settings-general-region"
                        className="w-full"
                      >
                        <GlobeIcon aria-hidden="true" />
                        <SelectValue>
                          {getOptionLabel(REGIONS, draft.region)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {REGIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="settings-general-currency">
                      Currency
                    </FieldLabel>
                    <Select
                      value={draft.currency}
                      onValueChange={(v) => v && set("currency", v)}
                    >
                      <SelectTrigger
                        id="settings-general-currency"
                        className="w-full"
                      >
                        <CircleDollarSignIcon aria-hidden="true" />
                        <SelectValue>
                          {getOptionLabel(CURRENCIES, draft.currency)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
              </FieldSet>
            </SettingField>

            {/* Date format */}
            <SettingField
              title="Date display format"
              description="Choose how dates appear in the admin and on receipts."
            >
              <ToggleGroup
                multiple={false}
                value={[draft.dateFormat]}
                onValueChange={(value) => {
                  if (value.length > 0) set("dateFormat", value[0])
                }}
                variant="outline"
                size="sm"
                aria-label="Date display format"
              >
                <ToggleGroupItem value="mdy">MM/DD/YYYY</ToggleGroupItem>
                <ToggleGroupItem value="dmy">DD/MM/YYYY</ToggleGroupItem>
                <ToggleGroupItem value="ymd">YYYY/MM/DD</ToggleGroupItem>
              </ToggleGroup>
            </SettingField>

            {/* Storefront preferences */}
            <SettingField
              title="Storefront preferences"
              description="Control how prices and the storefront are displayed."
              last
              contentClassName="@md/field-group:w-[22rem]"
            >
              <StorefrontPreferences
                values={draft.prefs}
                onChange={(prefs) => set("prefs", prefs)}
              />
            </SettingField>
          </FieldGroup>
        </FramePanel>

        <FrameFooter className="flex flex-row justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => setDraft(saved ?? draft)}
            disabled={updateProfile.isPending}
          >
            Reset
          </Button>
          <Button onClick={handleSave} disabled={updateProfile.isPending}>
            Save changes
          </Button>
        </FrameFooter>
      </Frame>
    </div>
  )
}
