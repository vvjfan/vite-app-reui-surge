import { type ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { InfoIcon } from "@phosphor-icons/react"

// Form field helpers distilled from the ReUI form-12 block, shared by the
// promotion editor. The block's markup is preserved; only the option data and
// wiring change (same treatment product-form-fields.tsx gives the same block).

const dashedSeparatorClassName =
  "border-border bg-transparent data-horizontal:h-0 data-horizontal:border-t data-horizontal:border-dashed"

function DashedSeparator() {
  return <Separator className={dashedSeparatorClassName} />
}

export function InsetSeparator() {
  return (
    <div className="px-5 sm:px-6">
      <DashedSeparator />
    </div>
  )
}

function PromotionFormHint({
  label,
  children,
}: {
  label: string
  children: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={label}
          />
        }
      >
        <InfoIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60 leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  )
}

export function PromotionRow({
  title,
  description,
  hint,
  htmlFor,
  align = "center",
  children,
}: {
  title: string
  description: string
  hint?: string
  htmlFor?: string
  align?: "center" | "start"
  children: ReactNode
}) {
  return (
    <Field
      className={cn(
        "grid gap-3 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]",
        align === "start" ? "md:items-start" : "md:items-center"
      )}
    >
      <FieldContent className="gap-0.5 md:pt-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {htmlFor ? (
            <FieldLabel htmlFor={htmlFor}>{title}</FieldLabel>
          ) : (
            <FieldTitle>{title}</FieldTitle>
          )}
          {hint ? (
            <PromotionFormHint label={`${title} details`}>
              {hint}
            </PromotionFormHint>
          ) : null}
        </div>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <div className="min-w-0">{children}</div>
    </Field>
  )
}

// The shared PROMOTION_*_OPTIONS in lib/data are the source of truth for values
// and labels; the editor only layers on the per-option helper copy the block's
// Select renders under each label.
export interface PromotionSelectOption<TValue extends string> {
  value: TValue
  label: string
  description?: string
}

export function withDescriptions<TValue extends string>(
  options: { value: TValue; label: string }[],
  descriptions: Record<TValue, string>
): PromotionSelectOption<TValue>[] {
  return options.map((option) => ({
    ...option,
    description: descriptions[option.value],
  }))
}

function getOptionLabel<TValue extends string>(
  options: PromotionSelectOption<TValue>[],
  value: TValue
) {
  return options.find((option) => option.value === value)?.label ?? value
}

export function OptionSelect<TValue extends string>({
  id,
  value,
  options,
  onValueChange,
  disabled,
}: {
  id: string
  value: TValue
  options: PromotionSelectOption<TValue>[]
  onValueChange: (value: TValue) => void
  disabled?: boolean
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}
    >
      <SelectTrigger id={id} className="w-full [&_small]:hidden">
        <SelectValue>{getOptionLabel(options, value)}</SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex min-w-0 flex-col items-start gap-px">
                <span className="font-medium">{option.label}</span>
                {option.description ? (
                  <small className="line-clamp-1 text-xs text-muted-foreground">
                    {option.description}
                  </small>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
