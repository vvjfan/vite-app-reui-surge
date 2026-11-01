import { cn } from "@/lib/utils"
import { FieldLegend, FieldSet } from "@/components/ui/field"
import { BRAND_COLORS } from "./data"
import { CheckIcon } from "@phosphor-icons/react"

// Brand-color swatch picker relocated from the ReUI settings-3 color-picker.
// Controlled so the selection is part of the persisted store profile.
export function BrandColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <FieldSet className="gap-0">
      <FieldLegend className="sr-only">Brand color</FieldLegend>

      <div className="flex items-center gap-3">
        {BRAND_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            aria-label={color.name}
            onClick={() => onChange(color.value)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full transition-shadow",
              value === color.value &&
                "ring-2 ring-ring ring-offset-2 ring-offset-background"
            )}
            style={{ backgroundColor: color.value }}
          >
            {value === color.value ? (
              <CheckIcon className="size-3 text-white" aria-hidden="true" />
            ) : null}
          </button>
        ))}
      </div>
    </FieldSet>
  )
}
