import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxLabel,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox"
import { Field } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { ROLE_OPTIONS, TIMEZONE_GROUPS } from "../data"

// Controlled adaptations of the profile-1 block's Role select and Timezone
// combobox: the block shipped them uncontrolled (defaultValue); wired to the
// draft they take value/onChange, using the project's string-value Select idiom
// (see general-settings).

export function RoleSelectField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const selected = ROLE_OPTIONS.find((option) => option.value === value)

  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue>{selected?.label ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent className="w-(--anchor-width)">
        <SelectGroup>
          {ROLE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function TimezoneField({
  id,
  value,
  onChange,
  placeholder = "Select a timezone",
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <Field className="w-full">
      <Combobox
        items={TIMEZONE_GROUPS}
        value={value}
        onValueChange={(v: string | null) => v && onChange(v)}
      >
        <ComboboxInput id={id} placeholder={placeholder} className="w-full" />
        <ComboboxContent className="w-(--anchor-width) min-w-(--anchor-width)">
          <ComboboxEmpty>No timezones found.</ComboboxEmpty>
          <ComboboxList>
            {(group) => (
              <ComboboxGroup key={group.value} items={group.items}>
                <ComboboxLabel>{group.value}</ComboboxLabel>
                <ComboboxCollection>
                  {(item) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  )
}
