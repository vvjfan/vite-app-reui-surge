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
import type { Supplier } from "@/lib/data/suppliers"
import { useDeleteSupplier, useSuppliers } from "../queries"
import { SupplierFormSheet } from "./supplier-form-sheet"
import {
  DotsThreeIcon as MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  TruckIcon,
  TrashIcon as Trash2Icon,
} from "@phosphor-icons/react"

function SupplierRow({
  supplier,
  suppliedSkus,
}: {
  supplier: Supplier
  suppliedSkus: number
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteSupplier = useDeleteSupplier()

  // Inventory rows reference this supplier by id, so deleting one that still
  // sources stock would leave those rows pointing at nothing. Block it and say so.
  const inUse = suppliedSkus > 0

  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <IconTile>
        <TruckIcon aria-hidden="true" />
      </IconTile>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {supplier.name}
          </span>
          {!supplier.isActive ? (
            <Badge variant="secondary">Inactive</Badge>
          ) : null}
        </div>
        <span className="truncate text-sm text-muted-foreground">
          {supplier.contactEmail}
        </span>
      </div>

      <Badge variant="secondary" className="shrink-0 tabular-nums">
        {suppliedSkus} {suppliedSkus === 1 ? "SKU" : "SKUs"}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              className="shrink-0"
              aria-label={`Actions for ${supplier.name}`}
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

      <SupplierFormSheet
        mode="edit"
        supplier={supplier}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {inUse ? "Supplier still sources stock" : "Delete this supplier?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {inUse ? (
                <>
                  <span className="font-medium text-foreground">
                    {supplier.name}
                  </span>{" "}
                  is referenced by {suppliedSkus}{" "}
                  {suppliedSkus === 1 ? "SKU" : "SKUs"}. Move those to another
                  supplier first, or mark this one inactive to stop offering it
                  for new stock.
                </>
              ) : (
                <>
                  This removes{" "}
                  <span className="font-medium text-foreground">
                    {supplier.name}
                  </span>
                  . No stock is sourced from it.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {inUse ? "Close" : "Keep supplier"}
            </AlertDialogCancel>
            {inUse ? null : (
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  setDeleteOpen(false)
                  deleteSupplier.mutate(supplier.id, {
                    onSuccess: () =>
                      toast.success("Supplier deleted", {
                        description: supplier.name,
                      }),
                  })
                }}
              >
                Delete supplier
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SupplierRowSkeleton() {
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

export function SuppliersPanel() {
  const suppliersQuery = useSuppliers()
  const { data: items = [] } = useInventoryItems()
  const suppliers = suppliersQuery.data

  // How many SKUs each supplier sources, joined at read time (never stored).
  // One supplier per item, unlike locations, where a SKU can sit in several.
  const skusBySupplier = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      counts.set(item.supplierId, (counts.get(item.supplierId) ?? 0) + 1)
    }
    return counts
  }, [items])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Suppliers"
        actions={
          <SupplierFormSheet
            mode="create"
            trigger={
              <Button className="shrink-0">
                <PlusIcon
                  data-icon="inline-start"
                  className="size-4"
                  aria-hidden="true"
                />
                New supplier
              </Button>
            }
          />
        }
      />
      <Frame dense className="w-full">
        <FramePanel className="flex flex-col gap-0 p-0! shadow-none!">
          <div className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-muted-foreground">
            <span className="flex-1">Supplier</span>
            <span className="shrink-0">Sourced</span>
            <span className="w-7 shrink-0" />
          </div>
          <Separator />
          {suppliersQuery.isPending || !suppliers ? (
            Array.from({ length: 3 }).map((_, index) => (
              <SupplierRowSkeleton key={index} />
            ))
          ) : suppliers.length > 0 ? (
            suppliers.map((supplier) => (
              <SupplierRow
                key={supplier.id}
                supplier={supplier}
                suppliedSkus={skusBySupplier.get(supplier.id) ?? 0}
              />
            ))
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No suppliers yet. Create one to start sourcing stock.
            </p>
          )}
        </FramePanel>
      </Frame>
    </div>
  )
}
