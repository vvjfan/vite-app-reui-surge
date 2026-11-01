import { useMemo } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/reui/badge"
import { DataGrid } from "@/components/reui/data-grid/data-grid"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table"
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { IconTile } from "@/components/shared/icon-tile"
import { PageHeader } from "@/components/shared/page-header"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useBilling,
  useInvoices,
  useOrdersCount,
  useTeamMembers,
} from "@/features/settings/queries"
import { DEFAULT_BILLING } from "@/lib/data/billing"
import { createInvoiceColumns } from "./columns"
import { CreditCardIcon } from "@phosphor-icons/react"

// Placeholder shown while the client reads plan / usage from the store, so no
// seed is rendered before the DB reads settle. Mirrors the layout. Invoices are
// not covered here: that grid carries its own skeleton.
function BillingSkeleton() {
  return (
    <>
      <Frame dense>
        <FrameHeader className="flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3.5 w-48" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </FramePanel>
        <FrameFooter className="flex flex-row justify-end gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </FrameFooter>
      </Frame>

      <Frame dense>
        <FrameHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3.5 w-56" />
        </FrameHeader>
        <FramePanel>
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-7 w-20" />
          </div>
        </FramePanel>
      </Frame>
    </>
  )
}

function InvoicesGrid() {
  const invoicesQuery = useInvoices()
  // The store returns invoices by primary key, which is oldest first. Ids are
  // `INV-<year>-<month>`, so sorting them descending is the billing period
  // descending, and the most recent invoice leads.
  const invoices = useMemo(
    () =>
      [...(invoicesQuery.data ?? [])].sort((a, b) => b.id.localeCompare(a.id)),
    [invoicesQuery.data]
  )
  const columns = useMemo(() => createInvoiceColumns(), [])

  const table = useReactTable({
    columns,
    data: invoices,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    // The grid does not paginate; pageSize only sizes the loading skeleton, and
    // a billing history is a handful of rows. Left at the default the skeleton
    // would stand up ten rows and then collapse.
    initialState: { pagination: { pageIndex: 0, pageSize: 4 } },
  })

  return (
    <DataGrid
      table={table}
      isLoading={invoicesQuery.isPending}
      loadingMode="skeleton"
      recordCount={invoices.length}
      // Nothing here bills a customer, so the empty case says where invoices
      // come from instead of reading as a fault.
      emptyMessage="No invoices yet. They appear after your first billing cycle."
      tableLayout={{ width: "auto" }}
      // Cell edges follow the FrameHeader's inline padding, so the Date and
      // Receipt columns line up with the title above them.
      tableClassNames={{
        edgeCell:
          "first:ps-(--frame-panel-header-px) last:pe-(--frame-panel-header-px)",
      }}
    >
      <Frame dense>
        <FrameHeader>
          <FrameTitle>Invoices</FrameTitle>
          <FrameDescription>Receipts for your records</FrameDescription>
        </FrameHeader>
        <FramePanel className="p-0">
          <DataGridScrollArea orientation="horizontal">
            <DataGridTable />
          </DataGridScrollArea>
        </FramePanel>
      </Frame>
    </DataGrid>
  )
}

// Billing & plan settings, composed from finished ReUI surfaces on the dense
// Frame surface. Invoices + plan config are seeded into the demo store and queried; the
// usage meters are derived from live data (order count, staff-member count).
export function BillingSettings() {
  const billingQuery = useBilling()
  const ordersCountQuery = useOrdersCount()
  const membersQuery = useTeamMembers()

  // Read only from the store. The three reads behind the meters settle together
  // or not at all: a meter filled from one of them alone would show a ratio that
  // was never true.
  const isPending =
    billingQuery.isPending ||
    ordersCountQuery.isPending ||
    membersQuery.isPending

  const billing = billingQuery.data ?? DEFAULT_BILLING
  const ordersUsed = ordersCountQuery.data ?? 0
  const seatsUsed = membersQuery.data?.length ?? 0

  const usage = [
    {
      id: "orders",
      label: "Orders this month",
      used: ordersUsed,
      limit: billing.limits.orders,
      unit: "",
    },
    {
      id: "seats",
      label: "Staff seats",
      used: seatsUsed,
      limit: billing.limits.seats,
      unit: "",
    },
    {
      id: "storage",
      label: "Media storage",
      used: billing.storageUsedGb,
      limit: billing.limits.storageGb,
      unit: " GB",
    },
  ]

  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader title="Billing" />
      {isPending ? (
        <BillingSkeleton />
      ) : (
        <>
          {/* Current plan */}
          <Frame dense>
            <FrameHeader className="flex-row items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <FrameTitle>{billing.planName}</FrameTitle>
                <FrameDescription>
                  {billing.price} · {billing.renews}
                </FrameDescription>
              </div>
              <Badge variant="success-light">Active</Badge>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">
              {usage.map((u) => (
                <div key={u.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{u.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {u.used}
                      {u.unit} / {u.limit}
                      {u.unit}
                    </span>
                  </div>
                  <Progress
                    value={
                      u.limit ? Math.min(100, (u.used / u.limit) * 100) : 0
                    }
                  />
                </div>
              ))}
            </FramePanel>
            <FrameFooter className="flex flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  toast.message("Cancel subscription", {
                    description:
                      "The cancellation flow is a demo in this template.",
                  })
                }
              >
                Cancel plan
              </Button>
              <Button
                onClick={() =>
                  toast.info("Change plan", {
                    description: "The plan picker is a demo in this template.",
                  })
                }
              >
                Change plan
              </Button>
            </FrameFooter>
          </Frame>

          {/* Payment method */}
          <Frame dense>
            <FrameHeader>
              <FrameTitle>Payment method</FrameTitle>
              <FrameDescription>Charged each billing cycle</FrameDescription>
            </FrameHeader>
            <FramePanel>
              {/* The panel already supplies its padding; the item only clears
                  its own so it does not stack a second inset on top. */}
              <Item className="p-0">
                <ItemMedia className="translate-y-0! self-center!">
                  <IconTile>
                    <CreditCardIcon aria-hidden="true" />
                  </IconTile>
                </ItemMedia>
                <ItemContent className="gap-0.5">
                  <ItemTitle>
                    {billing.paymentBrand} ending {billing.paymentLast4}
                  </ItemTitle>
                  <ItemDescription>
                    Expires {billing.paymentExpiry}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toast.info("Update card", {
                        description:
                          "The card form is a demo in this template.",
                      })
                    }
                  >
                    Update
                  </Button>
                </ItemActions>
              </Item>
            </FramePanel>
          </Frame>
        </>
      )}

      {/* Invoices */}
      <InvoicesGrid />
    </div>
  )
}
