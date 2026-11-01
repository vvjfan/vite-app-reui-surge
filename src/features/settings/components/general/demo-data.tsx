import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { clearDemoData, loadDemoData, resetDemoData } from "@/lib/data/db"
import {
  DatabaseIcon,
  ArrowCounterClockwiseIcon as RotateCcwIcon,
  TrashIcon as Trash2Icon,
} from "@phosphor-icons/react"

// The demo dataset controls. The store seeds itself on the first read (see
// lib/data/db.ts); these are the on-hand controls for the same dataset - load
// fills any empty tables, reset restores the samples exactly, and clear empties
// the store for the session (a reload reseeds).
//
// Rendered only in demo mode, by the route. It is an affordance of the demo
// store, not a feature of the product: against a real backend there is no sample
// dataset to load and getDb() would throw.

type DemoAction = "load" | "clear" | "reset"

const RUN: Record<DemoAction, () => Promise<void>> = {
  load: loadDemoData,
  clear: clearDemoData,
  reset: resetDemoData,
}

const DONE: Record<DemoAction, string> = {
  load: "Demo data loaded",
  clear: "Store cleared",
  reset: "Demo data reset",
}

export function DemoDataCard() {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState<"clear" | "reset" | null>(null)

  const run = useMutation({
    mutationFn: async (action: DemoAction) => {
      await RUN[action]()
      return action
    },
    onSuccess: async (action) => {
      // Every page in the app reads from the store and this just rewrote all of
      // it, so nothing that is cached is still true. Invalidating the whole
      // cache rather than naming keys is deliberate: a new entity would
      // otherwise be loaded into the store and keep rendering the old rows until
      // someone remembered to add its key here.
      await queryClient.invalidateQueries()
      toast.success(DONE[action])
    },
    onError: (error: Error) => {
      toast.error(`Could not update the store: ${error.message}`)
    },
  })

  const busy = run.isPending

  return (
    <>
      <Frame dense>
        <FrameHeader>
          <FrameTitle>Demo data</FrameTitle>
          <FrameDescription>
            Sample data, held for this session
          </FrameDescription>
        </FrameHeader>
        <FramePanel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Loading keeps anything you have created yourself: it fills only the
            sections that are still empty.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => run.mutate("load")}
            >
              <DatabaseIcon />
              Load demo data
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setConfirming("reset")}
            >
              <RotateCcwIcon />
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setConfirming("clear")}
            >
              <Trash2Icon />
              Clear
            </Button>
          </div>
        </FramePanel>
      </Frame>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === "clear"
                ? "Clear the whole store?"
                : "Reset to the sample data?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === "clear"
                ? "Every product, order, customer and stock row in this session is removed, including anything you created. The store stays empty until you reload."
                : "Every section goes back to the sample data exactly as it ships. Anything you created or edited is discarded."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my data</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirming) run.mutate(confirming)
                setConfirming(null)
              }}
            >
              {confirming === "clear" ? "Clear store" : "Reset store"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
