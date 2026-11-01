import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useRouter } from "@tanstack/react-router"

/**
 * Global navigation progress bar (YouTube / GitHub style).
 *
 * Two signals drive it, because neither one alone is both early and complete:
 *
 *   START  a capture-phase document click listener, so the ramp begins on the
 *          user's click - before the router has even been told to navigate and
 *          before any route chunk or loader request goes out. The router's own
 *          `onBeforeNavigate` also starts it, which is what covers back/forward
 *          (popstate) and programmatic navigate() calls that never touch an <a>.
 *   DONE   the router's `onResolved`, which fires from a layout effect once
 *          loading, the React transition, and every pending match have all
 *          settled - i.e. the new route is committed, not merely fetched.
 *
 * The click listener is deliberately the optimistic one: it can fire for a
 * navigation that never happens, so a confirmation watchdog closes the bar if
 * `onBeforeNavigate` does not follow shortly after.
 */

/** Asymptote the ramp approaches while waiting. Never reached on its own. */
const CAP = 90
/** Time constant of the ease-out ramp, in ms. Larger = slower creep. */
const TAU = 1100
/** A flash shorter than this reads as a glitch, so hold the bar at least this long. */
const MIN_VISIBLE_MS = 400
/** Glide from wherever the ramp got to out to 100%. */
const GLIDE_MS = 350
/** Fade the finished bar away. */
const FADE_MS = 350
/** Backstop so a navigation that never resolves cannot strand the bar. */
const SAFETY_MS = 12_000
/** How long a click-started ramp waits for the router to confirm a real navigation. */
const CONFIRM_MS = 1200

const GLIDE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

/**
 * Should this click start the bar? Everything that is not an in-app page
 * navigation has to fall through, or the bar fires on downloads, new tabs and
 * links that go nowhere.
 */
export function isInternalPageNavigation(event: MouseEvent): boolean {
  // Something upstream already handled it (a capture listener before ours).
  if (event.defaultPrevented) return false
  // Left button only: middle/right click opens a tab or a menu, not this page.
  if (event.button !== 0) return false
  // Modifier clicks open elsewhere (new tab, new window, download).
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false
  }

  const target = event.target
  const anchor = target instanceof Element ? target.closest("a") : null
  // SVGAElement also matches "a"; only the HTML one carries a usable href.
  if (!(anchor instanceof HTMLAnchorElement)) return false

  if (anchor.hasAttribute("download")) return false
  if (anchor.target && anchor.target !== "_self") return false
  if (anchor.rel.split(/\s+/).includes("external")) return false

  const href = anchor.getAttribute("href")
  // No href is not a link, and a bare hash never leaves the page.
  if (!href || href.startsWith("#")) return false

  const url = new URL(anchor.href, window.location.href)
  // mailto:, tel:, blob:, javascript: - none of them render a page here.
  if (url.protocol !== "http:" && url.protocol !== "https:") return false
  if (url.origin !== window.location.origin) return false
  // A file extension in the last segment means a static asset, not a route.
  if ((url.pathname.split("/").pop() ?? "").includes(".")) return false
  // Same path is a no-op as far as the bar is concerned. Deliberately NOT
  // comparing the query: this app keeps list state in the query string, so a
  // query-only change is in-page filtering, not a page load. See
  // isRealNavigation for the other half of the same rule.
  if (url.pathname === window.location.pathname) return false

  return true
}

/**
 * Does this router event represent a page actually changing?
 *
 * Path only, on purpose. /home writes its task filter to the query string on
 * every keystroke (routes/_app/home.tsx: navigate({ search, replace: true })),
 * and the router emits a full navigation event for each one. Counting those as
 * navigations flashed the bar on every character typed. Re-navigating to the
 * location we are already on, and the initial load, are both excluded too.
 */
export function isRealNavigation(event: {
  fromLocation?: { pathname: string }
  toLocation: { pathname: string }
}): boolean {
  const from = event.fromLocation
  if (!from) return false // nothing to navigate from: this is the first load
  return from.pathname !== event.toLocation.pathname
}

type Phase = "idle" | "ramp" | "closing"

type Engine = ReturnType<typeof createEngine>

export function createEngine(setActive: (value: boolean) => void) {
  let node: HTMLDivElement | null = null
  let phase: Phase = "idle"
  let startedAt = 0
  let confirmed = false
  let closeScheduled = false
  let raf: number | null = null
  const timers = new Set<ReturnType<typeof setTimeout>>()

  function after(ms: number, fn: () => void) {
    const id = setTimeout(() => {
      timers.delete(id)
      fn()
    }, ms)
    timers.add(id)
  }

  function clearTimers() {
    for (const id of timers) clearTimeout(id)
    timers.clear()
  }

  function cancelRaf() {
    if (raf !== null) {
      cancelAnimationFrame(raf)
      raf = null
    }
  }

  function paint(percent: number) {
    if (node) node.style.width = `${percent}%`
  }

  /**
   * Recomputed every frame rather than handed to one long CSS transition, so
   * the finish can take over from wherever the ramp actually is.
   */
  function ramp() {
    raf = requestAnimationFrame(() => {
      if (phase !== "ramp") return
      paint(CAP * (1 - Math.exp(-(performance.now() - startedAt) / TAU)))
      ramp()
    })
  }

  function beginRamp() {
    if (!node) return
    node.style.opacity = "1"
    // Width stays a *transitioned* property at zero duration: the finish only
    // has to swap the duration in, and the handoff eases instead of snapping.
    node.style.transitionProperty = "width"
    node.style.transitionDuration = "0ms"
    node.style.transitionTimingFunction = "linear"

    if (prefersReducedMotion()) {
      paint(CAP)
      return
    }
    paint(CAP * (1 - Math.exp(-(performance.now() - startedAt) / TAU)))
    ramp()
  }

  function beginClose() {
    phase = "closing"
    cancelRaf()
    if (!node) {
      phase = "idle"
      setActive(false)
      return
    }

    if (prefersReducedMotion()) {
      paint(100)
      after(0, () => {
        phase = "idle"
        setActive(false)
      })
      return
    }

    node.style.transitionDuration = `${GLIDE_MS}ms`
    node.style.transitionTimingFunction = GLIDE_EASING
    paint(100)
    after(GLIDE_MS, () => {
      if (node) {
        node.style.transitionProperty = "opacity"
        node.style.transitionDuration = `${FADE_MS}ms`
        node.style.transitionTimingFunction = "ease-out"
        node.style.opacity = "0"
      }
      after(FADE_MS, () => {
        phase = "idle"
        setActive(false)
      })
    })
  }

  /**
   * Is a ramp still running for a navigation that has not resolved yet? Once
   * the close is scheduled that navigation is finished, even though the bar is
   * still on screen for another second or so of hold, glide and fade.
   */
  function rampingLive() {
    return phase === "ramp" && !closeScheduled
  }

  /** Begin a ramp, cancelling any close still playing out from the last one. */
  function restart() {
    clearTimers()
    cancelRaf()
    phase = "ramp"
    confirmed = false
    closeScheduled = false
    startedAt = performance.now()
    after(SAFETY_MS, finish)
    after(CONFIRM_MS, () => {
      if (!confirmed) finish()
    })
    // When the bar is already mounted, setActive(true) is a no-op and React
    // will not re-render, so the layout effect never re-attaches. Reset the
    // existing node here instead: beginRamp puts the duration back to 0ms
    // before repainting, so an in-flight glide snaps back rather than easing.
    if (node) beginRamp()
    setActive(true)
  }

  function finish() {
    if (!rampingLive()) return
    closeScheduled = true
    clearTimers()
    // Stay on the ramp through the hold so the bar keeps creeping rather
    // than freezing for the remainder of the minimum.
    const hold = Math.max(0, MIN_VISIBLE_MS - (performance.now() - startedAt))
    if (hold === 0) beginClose()
    else after(hold, beginClose)
  }

  return {
    /** Called on mount with the bar node, and again with null on unmount. */
    attach(next: HTMLDivElement | null) {
      node = next
      if (!node) cancelRaf()
      else if (phase === "ramp") beginRamp()
    },

    start() {
      // One ramp per navigation: extra signals for the SAME navigation must not
      // restart the curve from zero. A navigation arriving during the close is
      // a different navigation though, and gets its own ramp rather than being
      // swallowed for the ~1.1s the close takes.
      if (rampingLive()) return
      restart()
    },

    /** The router really is navigating: start if a click did not already. */
    confirm() {
      if (!rampingLive()) restart()
      confirmed = true
    },

    finish,

    destroy() {
      clearTimers()
      cancelRaf()
      node = null
      phase = "idle"
      // Also clear the mounted flag. On a real unmount React ignores this; when
      // the effect is merely re-running (a new router identity), it stops a
      // detached, zero-width bar from being left on screen.
      setActive(false)
    },
  }
}

export function RouteProgress() {
  const router = useRouter()
  const [active, setActive] = useState(false)
  const nodeRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Engine | null>(null)
  if (engineRef.current === null) engineRef.current = createEngine(setActive)

  // Hand the node over as soon as it commits; the ramp's clock started back at
  // the click, so a frame spent mounting does not shift the curve.
  useLayoutEffect(() => {
    engineRef.current?.attach(active ? nodeRef.current : null)
  }, [active])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return

    function onClickCapture(event: MouseEvent) {
      if (isInternalPageNavigation(event)) engine?.start()
    }

    // Capture phase: this runs before the router's own click handler, which is
    // the whole point - the bar is up before the navigation is even requested.
    document.addEventListener("click", onClickCapture, true)
    // Also the sole start signal for navigations with no click behind them:
    // browser back/forward (popstate) and programmatic navigate() calls.
    //
    // onBeforeLoad rather than the more obvious onBeforeNavigate: router-core
    // emits onBeforeNavigate behind `if (!this.stores.redirect.get())` and
    // never clears that store again, so a single `throw redirect(...)` kills
    // the event for the rest of the session. This app redirects on /, /tasks,
    // /reports and the auth guard, so that happened within seconds and left
    // back/forward with no bar at all. onBeforeLoad is emitted unconditionally
    // on the very next line of router.load(), with the identical payload.
    const unsubscribeStart = router.subscribe("onBeforeLoad", (event) => {
      if (isRealNavigation(event)) engine.confirm()
    })
    const unsubscribeDone = router.subscribe("onResolved", () =>
      engine.finish()
    )

    return () => {
      document.removeEventListener("click", onClickCapture, true)
      unsubscribeStart()
      unsubscribeDone()
      engine.destroy()
    }
  }, [router])

  if (!active) return null

  // z-200 clears the whole app ladder in one go: the header sits at 20, sheets
  // and dialogs at 50, the task date pickers at 70, and the gantt drag overlay
  // at 100. Sonner's toaster stays above, which is where it belongs.
  //
  return (
    <div
      data-slot="route-progress"
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[2px]"
    >
      <div
        ref={nodeRef}
        data-slot="route-progress-bar"
        className="h-full w-0 bg-primary"
        style={{ willChange: "width, opacity" }}
      />
    </div>
  )
}
