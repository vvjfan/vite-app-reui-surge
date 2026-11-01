import { useCallback, useEffect, useMemo, useState } from "react"
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table"
import { toast } from "sonner"

import { DataGrid } from "@/components/reui/data-grid/data-grid"
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table"
import { Frame, FrameFooter, FramePanel } from "@/components/reui/frame"
import { PageHeader } from "@/components/shared/page-header"
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MagnifyingGlassIcon as SearchIcon } from "@phosphor-icons/react"
import { locationById, locationName } from "@/lib/data/locations"
import { useLocations } from "@/features/locations/queries"
import {
  purchaseOrderUnits,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from "@/lib/data/purchase-orders"
import {
  useCancelPurchaseOrder,
  usePurchaseOrders,
  useReceivePurchaseOrder,
} from "../queries"
import { createPurchaseOrderColumns } from "./purchase-orders-columns"
import { PurchaseOrderDetailSheet } from "./purchase-order-detail-sheet"

const STATUS_OPTIONS: { value: "all" | PurchaseOrderStatus; label: string }[] =
  [
    { value: "all", label: "All statuses" },
    { value: "draft", label: "Draft" },
    { value: "received", label: "Received" },
    { value: "cancelled", label: "Cancelled" },
  ]

// Purchase orders as a data grid, the same surface every other inventory list
// uses. Receiving a draft is a confirmed, stock-affecting write; cancelling
// closes it. Both come off the row action menu.
export function PurchaseOrdersGrid() {
  const query = usePurchaseOrders()
  const { data: locations = [] } = useLocations()
  const receive = useReceivePurchaseOrder()
  const cancel = useCancelPurchaseOrder()

  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<"all" | PurchaseOrderStatus>("all")
  const [activeOrder, setActiveOrder] = useState<PurchaseOrder | null>(null)
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 8,
  })
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null)

  const orders = useMemo(() => query.data ?? [], [query.data])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false
      if (q && !`${order.id} ${order.supplierName}`.toLowerCase().includes(q))
        return false
      return true
    })
  }, [orders, status, search])
  const locationsById = useMemo(() => locationById(locations), [locations])

  // Back to the first page whenever the filters narrow the set, so the view is
  // never stranded on a page that no longer exists.
  useEffect(() => {
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
    )
  }, [status, search])

  // Stable, so it can sit in the columns useMemo below without rebuilding the
  // grid every render (react-table treats new columns as a full reset).
  const handleCancel = useCallback(
    (order: PurchaseOrder) => {
      cancel.mutate(order.id, {
        onSuccess: () =>
          toast.message(`${order.id} cancelled`, {
            description: "The draft was closed without receiving stock.",
          }),
      })
    },
    [cancel]
  )

  const columns = useMemo(
    () =>
      createPurchaseOrderColumns({
        locationsById,
        onReceive: setReceiveTarget,
        onCancel: handleCancel,
      }),
    [locationsById, handleCancel]
  )

  const table = useReactTable({
    data: filtered,
    columns,
    getRowId: (row) => row.id,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const draftCount = useMemo(
    () => orders.filter((o) => o.status === "draft").length,
    [orders]
  )

  function confirmReceive() {
    const target = receiveTarget
    if (!target) return
    setReceiveTarget(null)
    receive.mutate(target.id, {
      onSuccess: () =>
        toast.success(`${target.id} received`, {
          description: `${purchaseOrderUnits(target).toLocaleString()} units added to ${locationName(locations, target.locationId)}.`,
        }),
    })
  }

  const emptyMessage =
    orders.length === 0
      ? "No purchase orders yet. Raise one from the reorder queue or the stock ledger."
      : "No purchase orders match your filters."

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        title="Purchase orders"
        count={draftCount > 0 ? `${draftCount} open` : undefined}
      />

      <DataGrid
        table={table}
        recordCount={filtered.length}
        isLoading={query.isPending}
        loadingMode="skeleton"
        onRowClick={(order: PurchaseOrder) => setActiveOrder(order)}
        emptyMessage={
          !query.isPending && filtered.length === 0 ? emptyMessage : undefined
        }
        tableLayout={{ headerSticky: false, dense: false }}
      >
        <Frame dense className="w-full">
          <FramePanel className="p-0! shadow-none!">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-(--frame-panel-header-px) py-(--frame-panel-header-py)">
              <div className="flex flex-wrap items-center gap-2">
                <InputGroup className="w-full min-w-52 sm:w-[240px]">
                  <InputGroupAddon align="inline-start">
                    <SearchIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search PO or supplier..."
                    aria-label="Search purchase orders"
                  />
                </InputGroup>

                <Select
                  value={status}
                  onValueChange={(value) => value && setStatus(value)}
                  items={STATUS_OPTIONS}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>

            <Separator />

            <FrameFooter>
              <DataGridPagination />
            </FrameFooter>
          </FramePanel>
        </Frame>
      </DataGrid>

      <AlertDialog
        open={receiveTarget !== null}
        onOpenChange={(open) => !open && setReceiveTarget(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Receive {receiveTarget?.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This adds{" "}
              {receiveTarget
                ? purchaseOrderUnits(receiveTarget).toLocaleString()
                : 0}{" "}
              units to{" "}
              {receiveTarget
                ? locationName(locations, receiveTarget.locationId)
                : ""}{" "}
              and records a restock on each SKU. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep as draft</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReceive}>
              Receive stock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PurchaseOrderDetailSheet
        order={activeOrder}
        locations={locations}
        open={activeOrder !== null}
        onOpenChange={(open) => {
          if (!open) setActiveOrder(null)
        }}
        onReceive={(order) => {
          setActiveOrder(null)
          setReceiveTarget(order)
        }}
        onCancel={(order) => {
          setActiveOrder(null)
          handleCancel(order)
        }}
      />
    </div>
  )
}
