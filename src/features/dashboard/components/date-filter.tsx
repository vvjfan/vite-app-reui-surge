import { useState } from "react"
import { CalendarIcon } from "@phosphor-icons/react"

import {
  DateSelector,
  formatDateValue,
  type DateSelectorValue,
} from "@/components/reui/date-selector"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

// The trigger label only has to say which window is showing, and it sits in a header
// action row next to two other buttons. Numeric dates spell that out twice over
// ("06/22/2026 - 07/21/2026" is 23 characters for a range inside one year), so the year
// is printed only when the window does not sit wholly inside the current one - the case
// where dropping it would actually be ambiguous. The picker itself still reads and
// writes full MM/dd/yyyy; this is the button's format, not the value's.
function dayFormatFor(value: DateSelectorValue): string {
  if (value.period !== "day") return "MMM d, yyyy"
  const thisYear = new Date().getFullYear()
  const spansAnotherYear = [value.startDate, value.endDate].some(
    (date) => date !== undefined && date.getFullYear() !== thisYear
  )
  return spansAnotherYear ? "MMM d, yyyy" : "MMM d"
}

// Dashboard period filter: the ReUI date-selector (popover pattern, c-date-selector-2),
// wired with an apply/cancel commit. The committed window is surfaced via onChange, and
// the dashboard drives the data from it.
//
// CONTROLLED on the committed value: the dashboard owns it (and seeds it from the shared
// lastThirtyDays default), so this holds no copy of its own to drift from the figures on
// the page. `internalValue` is only the popover's uncommitted draft - Cancel discards it.
export function DashboardDateFilter({
  value,
  onChange,
}: {
  value?: DateSelectorValue
  onChange?: (value: DateSelectorValue) => void
}) {
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState<
    DateSelectorValue | undefined
  >(value)

  const formattedValue = value
    ? formatDateValue(value, undefined, dayFormatFor(value))
    : ""
  const displayText = formattedValue || "Select period"

  const resetInputs1 = [open, value] as const
  const [previousInputs1, setPreviousInputs1] = useState<
    typeof resetInputs1 | null
  >(null)
  if (
    previousInputs1 === null ||
    resetInputs1.some(
      (input, index) => !Object.is(input, previousInputs1[index])
    )
  ) {
    setPreviousInputs1(resetInputs1)

    if (open) {
      setInternalValue(value)
    }
  }

  const handleApply = () => {
    if (internalValue) onChange?.(internalValue)
    setOpen(false)
  }

  const handleCancel = () => {
    setInternalValue(value)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* The label is a whole date range, the widest thing in the header's
          action row, and every button in that row is shrink-0 by default. This
          one opts back in and truncates: the row is otherwise wider than a
          phone, which scrolls the whole page sideways. */}
      <PopoverTrigger
        render={
          <Button variant="outline" className="min-w-0 shrink! justify-start">
            <CalendarIcon
              data-icon="inline-start"
              className="size-4 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">{displayText}</span>
          </Button>
        }
      />
      <PopoverContent className="w-auto gap-3 p-0" align="end" sideOffset={4}>
        <div className="p-3">
          <DateSelector
            value={internalValue}
            onChange={setInternalValue}
            allowRange={true}
            label="Date range"
            inputHint="Try: 2025, Q4, 05/10/2025"
          />
        </div>
        <Separator className="p-0" />
        <div className="flex justify-end gap-2 p-3 pt-0">
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
