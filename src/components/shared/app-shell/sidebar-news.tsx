import { useEffect, useRef, useState } from "react"
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react"

import { cn } from "@/lib/utils"

import type { NewsArticle } from "./data"

// ── Constants ──

const OFFSET_FACTOR = 4
const SCALE_FACTOR = 0.03
const OPACITY_FACTOR = 0.1
const COMPLETED_DISPLAY_MS = 2700

// ── News Card ──

function NewsCard({
  title,
  summary,
  image,
  onDismiss,
  hideContent,
  href,
  active,
}: {
  title: string
  summary: string
  image?: string
  onDismiss?: () => void
  hideContent?: boolean
  href?: string
  active?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    start: number
    delta: number
    startTime: number
    maxDelta: number
  }>({ start: 0, delta: 0, startTime: 0, maxDelta: 0 })
  const animation = useRef<Animation>(undefined)
  const [dragging, setDragging] = useState(false)

  const onDragMove = (e: globalThis.PointerEvent) => {
    if (!ref.current) return
    const dx = e.clientX - drag.current.start
    drag.current.delta = dx
    drag.current.maxDelta = Math.max(drag.current.maxDelta, Math.abs(dx))
    ref.current.style.setProperty("--dx", dx.toString())
  }

  const dismiss = () => {
    if (!ref.current) return
    const cardWidth = ref.current.getBoundingClientRect().width
    const translateX = Math.sign(drag.current.delta) * cardWidth

    animation.current = ref.current.animate(
      { opacity: 0, transform: `translateX(${translateX}px)` },
      { duration: 150, easing: "ease-in-out", fill: "forwards" }
    )
    animation.current.onfinish = () => onDismiss?.()
  }

  const stopDragging = (cancelled: boolean) => {
    unbindListeners()
    if (!ref.current) return
    setDragging(false)

    const dx = drag.current.delta
    if (Math.abs(dx) > ref.current.clientWidth / (cancelled ? 2 : 3)) {
      dismiss()
      return
    }

    animation.current = ref.current.animate(
      { transform: "translateX(0)" },
      { duration: 150, easing: "ease-in-out" }
    )
    animation.current.onfinish = () =>
      ref.current?.style.setProperty("--dx", "0")

    drag.current = { start: 0, delta: 0, startTime: 0, maxDelta: 0 }
  }

  const onDragEnd = () => stopDragging(false)
  const onDragCancel = () => stopDragging(true)

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!active || !ref.current || animation.current?.playState === "running")
      return

    bindListeners()
    setDragging(true)
    drag.current.start = e.clientX
    drag.current.startTime = e.timeStamp
    drag.current.delta = 0
    ref.current.style.setProperty("--w", ref.current.clientWidth.toString())
  }

  const onClick = (event: React.MouseEvent) => {
    if (!ref.current || !href) return
    if (
      drag.current.maxDelta < ref.current.clientWidth / 10 &&
      (!drag.current.startTime ||
        event.timeStamp - drag.current.startTime < 250)
    ) {
      window.open(href, "_blank", "noopener,noreferrer")
    }
  }

  const bindListeners = () => {
    document.addEventListener("pointermove", onDragMove)
    document.addEventListener("pointerup", onDragEnd)
    document.addEventListener("pointercancel", onDragCancel)
  }

  const unbindListeners = () => {
    document.removeEventListener("pointermove", onDragMove)
    document.removeEventListener("pointerup", onDragEnd)
    document.removeEventListener("pointercancel", onDragCancel)
  }

  return (
    <div
      ref={ref}
      className={cn(
        "relative cursor-grab border border-border bg-card p-3 text-[0.8125rem] shadow-xs select-none",
        "rounded-lg",
        "translate-x-[calc(var(--dx)*1px)] rotate-[calc(var(--dx)*0.05deg)] opacity-[calc(1-max(var(--dx),-1*var(--dx))/var(--w)/2)]",
        "transition-shadow data-[dragging=true]:cursor-grabbing data-[dragging=true]:shadow-md"
      )}
      style={{ "--dx": 0, "--w": 1 } as CSSProperties}
      data-dragging={dragging}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <div className={cn(hideContent && "invisible")}>
        <div className="flex flex-col gap-1">
          <span className="line-clamp-1 font-medium text-foreground">
            {title}
          </span>
          <p className="line-clamp-2 h-10 leading-5 text-muted-foreground">
            {summary}
          </p>
        </div>
        <div
          className={cn(
            "relative mt-3 aspect-video w-full shrink-0 overflow-hidden border border-border/40 bg-muted",
            "rounded-md"
          )}
        >
          {image && (
            <img
              src={image}
              alt=""
              className="size-full object-cover object-center"
              draggable={false}
            />
          )}
        </div>
        <div
          className={cn(
            "grid grid-rows-[0fr] overflow-hidden opacity-0 transition-[grid-template-rows,opacity] duration-200",
            "sm:group-has-[*[data-dragging=true]]:grid-rows-[1fr] sm:group-has-[*[data-dragging=true]]:opacity-100",
            "sm:group-hover:group-data-[active=true]:grid-rows-[1fr] sm:group-hover:group-data-[active=true]:opacity-100",
            "has-focus-visible:grid-rows-[1fr] has-focus-visible:opacity-100"
          )}
        >
          <div className="min-h-0">
            <div className="flex items-center justify-between pt-3 text-xs">
              <a
                href={href ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-muted-foreground transition-colors duration-75 hover:text-foreground"
              >
                Read more
              </a>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  dismiss()
                }}
                className="text-muted-foreground transition-colors duration-75 hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sidebar News ──

export function SidebarNews({ articles }: { articles: NewsArticle[] }) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  const cards = articles.filter(({ href }) => !dismissedIds.includes(href))
  const cardCount = cards.length
  const [showCompleted, setShowCompleted] = useState(cardCount > 0)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined
    if (cardCount === 0) {
      timeout = setTimeout(() => setShowCompleted(false), COMPLETED_DISPLAY_MS)
    }
    return () => clearTimeout(timeout)
  }, [cardCount])

  if (!cards.length && !showCompleted) return null

  return (
    <div
      className="group px-3 in-data-[state=collapsed]:hidden"
      data-active={cardCount !== 0}
    >
      <div className="relative size-full">
        {cards.toReversed().map(({ href, title, summary, image }, idx) => (
          <div
            key={idx}
            className={cn(
              "absolute top-0 left-0 size-full scale-(--scale) transition-[opacity,transform] duration-200",
              cardCount - idx > 3
                ? [
                    "opacity-0 sm:group-hover:translate-y-(--y) sm:group-hover:opacity-(--opacity)",
                    "sm:group-has-[*[data-dragging=true]]:translate-y-(--y) sm:group-has-[*[data-dragging=true]]:opacity-(--opacity)",
                  ]
                : "translate-y-(--y) opacity-(--opacity)"
            )}
            style={
              {
                "--y": `-${(cardCount - (idx + 1)) * OFFSET_FACTOR}%`,
                "--scale": 1 - (cardCount - (idx + 1)) * SCALE_FACTOR,
                "--opacity":
                  cardCount - (idx + 1) >= 6
                    ? 0
                    : 1 - (cardCount - (idx + 1)) * OPACITY_FACTOR,
              } as CSSProperties
            }
            aria-hidden={idx !== cardCount - 1}
            {...(idx !== cardCount - 1 ? { inert: true } : {})}
          >
            <NewsCard
              title={title}
              summary={summary}
              image={image}
              href={href}
              hideContent={cardCount - idx > 2}
              active={idx === cardCount - 1}
              onDismiss={() =>
                setDismissedIds([href, ...dismissedIds.slice(0, 50)])
              }
            />
          </div>
        ))}

        {/* Invisible spacer to hold layout height */}
        <div className="pointer-events-none invisible" aria-hidden="true">
          <NewsCard title="Title" summary="Description" />
        </div>

        {/* All-caught-up state */}
        {showCompleted && !cardCount && (
          <div className="absolute inset-0 flex size-full flex-col items-center justify-end gap-3 pb-4">
            <span className="text-xs font-medium text-muted-foreground">
              You&apos;re all caught up!
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
