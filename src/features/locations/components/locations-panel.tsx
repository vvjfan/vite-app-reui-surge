import { useMemo, useState } from "react"
import { toast } from "sonner"

import { IconTile } from "@/components/shared/icon-tile"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/reui/badge"
import { Frame, FramePanel } from "@/components/reui/frame"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useInventoryItems } from "@/features/inventory/queries"
import {
  STOCK_LOCATION_KIND_LABEL,
  type StockLocation,
} from "@/lib/data/locations"
import { useDeleteLocation, useLocations } from "../queries"
import { LocationFormSheet } from "./location-form-sheet"
import {
  MapPinIcon,
  DotsThreeIcon as MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon as Trash2Icon,
} from "@phosphor-icons/react"

function LocationRow({
  location,
  stockedSkus,
}: {
  location: StockLocation
  stockedSkus: number
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteLocation = useDeleteLocation()

  // Inventory rows reference this location by id, so deleting one that still
  // holds stock would leave those rows pointing at nothing. Block it and say so.
  const inUse = stockedSkus > 0

  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <IconTile>
        <MapPinIcon aria-hidden="true" />
      </IconTile>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {location.name}
          </span>
          {!location.isActive ? (
            <Badge variant="secondary">Inactive</Badge>
          ) : null}
        </div>
        <span className="truncate text-sm text-muted-foreground">
          {STOCK_LOCATION_KIND_LABEL[location.kind]}
          {location.address ? ` · ${location.address}` : ""}
        </span>
      </div>

      <Badge variant="secondary" className="shrink-0 tabular-nums">
        {stockedSkus} {stockedSkus === 1 ? "SKU" : "SKUs"}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              className="shrink-0"
              aria-label={`Actions for ${location.name}`}
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <PencilIcon className="size-4" aria-hidden="true" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon className="size-4" aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LocationFormSheet
        mode="edit"
        location={location}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {inUse ? "Location still holds stock" : "Delete this location?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {inUse ? (
                <>
                  <span className="font-medium text-foreground">
                    {location.name}
                  </span>{" "}
                  is referenced by {stockedSkus}{" "}
                  {stockedSkus === 1 ? "SKU" : "SKUs"}. Move that stock to
                  another location first, or mark this one inactive to stop
                  offering it for new rows.
                </>
              ) : (
                <>
                  This removes{" "}
                  <span className="font-medium text-foreground">
                    {location.name}
                  </span>
                  . No stock references it.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {inUse ? "Close" : "Keep location"}
            </AlertDialogCancel>
            {inUse ? null : (
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  setDeleteOpen(false)
                  deleteLocation.mutate(location.id, {
                    onSuccess: () =>
                      toast.success("Location deleted", {
                        description: location.name,
                      }),
                  })
                }}
              >
                Delete location
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function LocationRowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <Skeleton className="size-8 shrink-0 rounded-lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-56" />
      </div>
      <Skeleton className="h-5 w-14 shrink-0 rounded-md" />
      <Skeleton className="size-7 shrink-0 rounded-md" />
    </div>
  )
}

export function LocationsPanel() {
  const locationsQuery = useLocations()
  const { data: items = [] } = useInventoryItems()
  const locations = locationsQuery.data

  // How many SKUs sit in each location, joined at read time (never stored). A SKU
  // holds a level per location it stocks at, so it counts once for each of them:
  // the delete guard has to see every location a level still points at, not just
  // the one holding the most.
  const skusByLocation = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      for (const level of item.levels) {
        counts.set(level.locationId, (counts.get(level.locationId) ?? 0) + 1)
      }
    }
    return counts
  }, [items])

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        title="Locations"
        actions={
          <LocationFormSheet
            mode="create"
            trigger={
              <Button className="shrink-0">
                <PlusIcon
                  data-icon="inline-start"
                  className="size-4"
                  aria-hidden="true"
                />
                New location
              </Button>
            }
          />
        }
      />
      <Frame dense className="w-full">
        <FramePanel className="flex flex-col gap-0 p-0! shadow-none!">
          <div className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-muted-foreground">
            <span className="flex-1">Location</span>
            <span className="shrink-0">Stock</span>
            <span className="w-7 shrink-0" />
          </div>
          <Separator />
          {locationsQuery.isPending || !locations ? (
            Array.from({ length: 3 }).map((_, index) => (
              <LocationRowSkeleton key={index} />
            ))
          ) : locations.length > 0 ? (
            locations.map((location) => (
              <LocationRow
                key={location.id}
                location={location}
                stockedSkus={skusByLocation.get(location.id) ?? 0}
              />
            ))
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No locations yet. Create one to start placing stock.
            </p>
          )}
        </FramePanel>
      </Frame>
    </div>
  )
}
