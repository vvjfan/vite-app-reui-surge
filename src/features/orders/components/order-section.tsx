import { type ReactNode } from "react"
import { Badge, type BadgeProps } from "@/components/reui/badge"

import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { cn } from "@/lib/utils"

// The relocated form-3 section wrapper: title + description + badge, with an
// optional trailing action.
//
// form-3 shipped this as an <h2> inside a Card. This template's page surface
// is the dense Frame (Cards are for tiles and detail panels) - so the heading
// moves out into a real FrameHeader with FrameTitle / FrameDescription and the
// badge / action as the trailing element, exactly the move ffa0432 made for the
// analytics panels. The block's grouping and rhythm are unchanged; only the
// shell it sits in is the template's.
export function OrderSection({
  title,
  description,
  badge,
  badgeVariant = "secondary",
  action,
  className,
  panelClassName,
  children,
}: {
  title: string
  description?: string
  badge?: string
  badgeVariant?: BadgeProps["variant"]
  action?: ReactNode
  className?: string
  panelClassName?: string
  children: ReactNode
}) {
  return (
    <Frame dense className={cn("w-full", className)}>
      <FrameHeader className="flex-row items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <FrameTitle>{title}</FrameTitle>
            {badge ? <Badge variant={badgeVariant}>{badge}</Badge> : null}
          </div>
          {description ? (
            <FrameDescription>{description}</FrameDescription>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </FrameHeader>
      <FramePanel className={cn("shadow-none!", panelClassName)}>
        {children}
      </FramePanel>
    </Frame>
  )
}
