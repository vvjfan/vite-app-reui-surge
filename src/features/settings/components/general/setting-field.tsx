import { type ComponentProps, type ReactNode } from "react"
import { Badge } from "@/components/reui/badge"

import { cn } from "@/lib/utils"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldSeparator,
  FieldTitle,
} from "@/components/ui/field"

interface SettingFieldProps {
  title: string
  description: string
  badge?: {
    label: string
    variant: ComponentProps<typeof Badge>["variant"]
  }
  children: ReactNode
  last?: boolean
  labelFor?: string
  contentClassName?: string
}

// Row primitive relocated verbatim from the ReUI settings-3 block: a label +
// description on the left paired with its control on the right, divider below.
export function SettingField({
  title,
  description,
  badge,
  children,
  last,
  labelFor,
  contentClassName,
}: SettingFieldProps) {
  return (
    <>
      <Field orientation="responsive" className="gap-4 px-4 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 @md/field-group:max-w-sm">
          <div className="flex flex-wrap items-center gap-2">
            {labelFor ? (
              <FieldLabel htmlFor={labelFor}>{title}</FieldLabel>
            ) : (
              <FieldTitle>{title}</FieldTitle>
            )}

            {badge ? (
              <Badge variant={badge.variant}>{badge.label}</Badge>
            ) : null}
          </div>

          <FieldDescription>{description}</FieldDescription>
        </div>

        <FieldContent
          className={cn("min-w-0 @md/field-group:w-78", contentClassName)}
        >
          {children}
        </FieldContent>
      </Field>

      {!last ? <FieldSeparator /> : null}
    </>
  )
}
