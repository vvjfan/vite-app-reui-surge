import { Fragment, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import type { AccountProfile } from "@/lib/data/account"
import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { PhoneInput } from "@/components/reui/phone-input"
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

import {
  useAccountProfile,
  useUpdateAccountProfile,
} from "@/features/account/queries"
import { ImageUploadField } from "./image-upload-field"
import { RoleSelectField, TimezoneField } from "./profile-fields"
import { SettingRow } from "./setting-row"

// Placeholder held while the client reads the profile from the store, so the
// default is never rendered before the DB read settles. Mirrors the form's row
// geometry.
function ProfileSkeleton() {
  return (
    <Frame dense className="w-full">
      <FrameHeader>
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </FrameHeader>
      <FramePanel className="p-0!">
        <FieldGroup className="gap-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <Fragment key={i}>
              <Field orientation="responsive" className="gap-4 px-5 py-4">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 @md/field-group:max-w-sm">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <FieldContent className="min-w-0 @md/field-group:max-w-[34rem] @md/field-group:flex-1">
                  <Skeleton className="h-8 w-full" />
                </FieldContent>
              </Field>
              {i < 5 ? <FieldSeparator /> : null}
            </Fragment>
          ))}
        </FieldGroup>
      </FramePanel>
      <FrameFooter className="flex flex-row justify-end gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-28" />
      </FrameFooter>
    </Frame>
  )
}

// Personal profile, relocated from the ReUI profile-1 Profile panel and wired to
// the account-profile settings singleton: it loads the saved profile, edits a
// local draft, and persists on Save (the avatar as an inline data URI).
export function ProfileSettings() {
  const profileQuery = useAccountProfile()
  const saved = profileQuery.data
  const updateProfile = useUpdateAccountProfile()

  // Draft starts null and is populated from the first store read (never from the
  // in-code default). Later loads sync the draft only while it is not dirty, so
  // in-progress edits are not clobbered.
  const [draft, setDraft] = useState<AccountProfile | null>(null)
  const savedRef = useRef<AccountProfile | undefined>(undefined)
  useEffect(() => {
    if (saved === undefined) return
    const prevSaved = savedRef.current
    savedRef.current = saved
    setDraft((current) =>
      current === null || current === prevSaved ? saved : current
    )
  }, [saved])

  function set<TKey extends keyof AccountProfile>(
    key: TKey,
    value: AccountProfile[TKey]
  ) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function handleSave() {
    if (!draft) return
    updateProfile.mutate(draft, {
      onSuccess: () => toast.success("Profile updated"),
    })
  }

  if (profileQuery.isPending || draft === null) {
    return <ProfileSkeleton />
  }

  return (
    // Dense frame: the footer makes this a headed/footed surface, which the
    // template renders as a Frame, not a Card. No FrameHeader, so the dense
    // top-border pull fires and there is no doubled border. The PageHeader
    // names the page; the region label keeps the panel announced.
    <Frame dense aria-label="Profile details" role="region" className="w-full">
      <FrameHeader>
        <FrameTitle>Profile</FrameTitle>
        <FrameDescription>
          Manage your personal information and how you appear across the store.
        </FrameDescription>
      </FrameHeader>
      <FramePanel className="p-0!">
        <FieldGroup className="gap-0">
          {/* Profile photo */}
          <SettingRow
            title="Profile photo"
            description="Shown on comments, mentions, and the sign-in menu."
            labelFor="profile-photo"
          >
            <ImageUploadField
              ariaLabel="Upload profile photo"
              inputId="profile-photo"
              variant="avatar"
              defaultImage={draft.avatar}
              alt={draft.name}
              onImageChange={(url) => set("avatar", url ?? "")}
            />
          </SettingRow>

          {/* Full name */}
          <SettingRow
            title="Full name"
            description="Used across the admin."
            labelFor="profile-name"
          >
            <Input
              id="profile-name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </SettingRow>

          {/* Email address */}
          <SettingRow
            title="Email address"
            description="Primary sign-in email."
            labelFor="profile-email"
            titleAddon={<Badge variant="success-light">Verified</Badge>}
          >
            <Input
              id="profile-email"
              type="email"
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </SettingRow>

          {/* Phone number */}
          <SettingRow
            title="Phone number"
            description="For recovery and urgent order alerts."
            labelFor="profile-phone"
          >
            <PhoneInput
              id="profile-phone"
              className="w-full"
              variant="sm"
              placeholder="Enter phone number"
              defaultCountry="JP"
              value={draft.phone}
              onChange={(value) => set("phone", value || "")}
            />
          </SettingRow>

          {/* Username */}
          <SettingRow
            title="Username"
            description="Used in mentions and links."
            labelFor="profile-username"
          >
            <InputGroup className="w-full">
              <InputGroupAddon align="inline-start">
                <InputGroupText>@</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="profile-username"
                value={draft.username}
                onChange={(e) => set("username", e.target.value)}
              />
            </InputGroup>
          </SettingRow>

          {/* Public details */}
          <SettingRow
            title="Public details"
            description="Role, time zone, and website."
            contentClassName="@md/field-group:max-w-[32rem]"
          >
            <FieldSet className="w-full gap-3">
              <FieldLegend className="sr-only">Public details</FieldLegend>
              <FieldDescription className="sr-only">
                Role, time zone, and website.
              </FieldDescription>

              <FieldGroup className="gap-3">
                <Field>
                  <FieldLabel htmlFor="profile-role">Role</FieldLabel>
                  <RoleSelectField
                    id="profile-role"
                    value={draft.role}
                    onChange={(value) => set("role", value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="profile-timezone">Time zone</FieldLabel>
                  <TimezoneField
                    id="profile-timezone"
                    value={draft.timezone}
                    onChange={(value) => set("timezone", value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="profile-website">Website</FieldLabel>
                  <InputGroup className="w-full">
                    <InputGroupAddon align="inline-start">
                      <InputGroupText>https://</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="profile-website"
                      value={draft.website}
                      onChange={(e) => set("website", e.target.value)}
                    />
                  </InputGroup>
                </Field>
              </FieldGroup>
            </FieldSet>
          </SettingRow>

          {/* Bio */}
          <SettingRow
            title="Bio"
            description="A short profile summary."
            labelFor="profile-bio"
            contentClassName="@md/field-group:max-w-full"
            last
          >
            <Textarea
              id="profile-bio"
              value={draft.bio}
              onChange={(e) => set("bio", e.target.value)}
              className="min-h-24 w-full resize-none"
            />
          </SettingRow>
        </FieldGroup>
      </FramePanel>

      <FrameFooter className="flex flex-row justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setDraft(saved ?? draft)}
          disabled={updateProfile.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={updateProfile.isPending}
        >
          Save changes
        </Button>
      </FrameFooter>
    </Frame>
  )
}
