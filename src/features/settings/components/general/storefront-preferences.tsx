import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"

import { STOREFRONT_PREFERENCES } from "./data"

// Storefront on/off toggles relocated from the ReUI settings-3 editor-preferences
// switch list. Controlled so the toggles are part of the persisted store profile.
export function StorefrontPreferences({
  values,
  onChange,
}: {
  values: Record<string, boolean>
  onChange: (values: Record<string, boolean>) => void
}) {
  return (
    <FieldSet className="w-full gap-3">
      <FieldLegend className="sr-only">Storefront preferences</FieldLegend>
      <FieldDescription className="sr-only">
        Configure storefront visibility and display options.
      </FieldDescription>

      <FieldGroup className="gap-3">
        {STOREFRONT_PREFERENCES.map((pref) => (
          <Field key={pref.id} orientation="horizontal" className="gap-3">
            <Switch
              id={`settings-general-${pref.id}`}
              checked={values[pref.id] ?? false}
              onCheckedChange={(value) =>
                onChange({ ...values, [pref.id]: value })
              }
              className="mt-0.5"
            />

            <FieldContent className="gap-0.5">
              <FieldLabel htmlFor={`settings-general-${pref.id}`}>
                {pref.label}
              </FieldLabel>
              <FieldDescription>{pref.description}</FieldDescription>
            </FieldContent>
          </Field>
        ))}
      </FieldGroup>
    </FieldSet>
  )
}
