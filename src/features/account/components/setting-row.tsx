import { type ReactNode } from "react"

import { cn } from "@/lib/utils"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldSeparator,
  FieldTitle,
} from "@/components/ui/field"

interface SettingRowProps {
  title: string
  description?: ReactNode
  children: ReactNode
  last?: boolean
  labelFor?: string
  contentClassName?: string
  titleAddon?: ReactNode
}

// Row primitive relocated from the ReUI profile-1 block: a label + description on
// the left paired with its right-aligned control, divider below. Kept as its own
// row rather than reusing the store-settings SettingField because it right-aligns
// the control and takes an arbitrary `titleAddon` (e.g. a Verified badge) instead
// of a typed badge slot.
export function SettingRow({
  title,
  description,
  children,
  last,
  labelFor,
  contentClassName,
  titleAddon,
}: SettingRowProps) {
  return (
    <>
      <Field orientation="responsive" className="gap-4 px-5 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 @md/field-group:max-w-sm">
          <div className="flex flex-wrap items-center gap-2">
            {labelFor ? (
              <FieldLabel htmlFor={labelFor}>{title}</FieldLabel>
            ) : (
              <FieldTitle>{title}</FieldTitle>
            )}
            {titleAddon}
          </div>

          {description ? (
            <FieldDescription className="text-sm">
              {description}
            </FieldDescription>
          ) : null}
        </div>

        <FieldContent
          className={cn(
            "w-full min-w-0 @md/field-group:max-w-[34rem] @md/field-group:flex-1",
            contentClassName
          )}
        >
          <div className="flex w-full justify-start @md/field-group:justify-end">
            {children}
          </div>
        </FieldContent>
      </Field>

      {!last ? <FieldSeparator /> : null}
    </>
  )
}
