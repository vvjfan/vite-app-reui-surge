import { cloneElement, type ReactElement } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * Data text clipped to whatever column or panel it lands in, with the full
 * string reachable on hover.
 *
 * Every data-driven `truncate` in the app goes through here, so a `truncate`
 * outside this wrapper is a violation you can grep for. Pass `render` when the
 * clipped text is itself a link; it inherits the truncation classes.
 */
export function TruncatedText({
  text,
  className,
  side = "top",
  render,
}: {
  text: string
  className?: string
  side?: "top" | "right" | "bottom" | "left"
  render?: ReactElement<{ className?: string }>
}) {
  const triggerClassName = cn("min-w-0 truncate", className)
  const trigger = render ? (
    cloneElement(render, {
      className: cn(triggerClassName, render.props.className),
    })
  ) : (
    <span className={triggerClassName} />
  )

  return (
    <Tooltip>
      <TooltipTrigger render={trigger}>{text}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-72">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}
