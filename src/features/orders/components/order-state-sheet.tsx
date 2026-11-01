import { useCallback, type ReactNode } from "react"
import { useNavigate } from "@tanstack/react-router"

import { useRouteSheet } from "@/components/shared/use-route-sheet"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { XIcon } from "@phosphor-icons/react"

// Shared sheet shell for the order detail's non-success states (loading,
// not-found, error) so they overlay the persistent grid exactly like the
// detail does. Closing returns to /orders.
export function OrderStateSheet({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const handleClosed = useCallback(() => {
    navigate({ to: "/orders" })
  }, [navigate])
  const sheet = useRouteSheet(handleClosed)

  return (
    <Sheet {...sheet}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-xl p-0 outline-none data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:left-auto data-[side=right]:h-[calc(100svh-2rem)] data-[side=right]:w-[min(64rem,calc(100vw-2rem))] data-[side=right]:max-w-none data-[side=right]:sm:max-w-none"
      >
        <SheetHeader className="shrink-0 border-b px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="truncate">Order Details</SheetTitle>
            <SheetClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close sheet"
                  className="shrink-0"
                >
                  <XIcon aria-hidden="true" />
                </Button>
              }
            />
          </div>
          <SheetDescription className="sr-only">
            Order detail status
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
