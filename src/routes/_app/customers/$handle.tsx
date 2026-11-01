import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  formatCurrency,
  formatOrderDate,
  initials,
} from "@/features/orders/lib/format"
import {
  FulfillmentBadge,
  PaymentBadge,
} from "@/features/orders/components/orders-columns"
import { AccountBadge } from "@/features/customers/components/customers-columns"
import { CustomerFormSheet } from "@/features/customers/components/customer-form-sheet"
import {
  customerAggregates,
  customerDetailQuery,
  customerGroupsListQuery,
  ordersForCustomer,
  useDeleteCustomer,
} from "@/features/customers/queries"
import { ordersListQuery } from "@/features/orders/queries"
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon as Trash2Icon,
  UserMinusIcon as UserXIcon,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_app/customers/$handle")({
  component: CustomerDetailPage,
})

function CustomerDetailPage() {
  const { handle } = Route.useParams()
  const navigate = useNavigate()
  const customerQuery = useQuery(customerDetailQuery(handle))
  const ordersQuery = useQuery(ordersListQuery())
  const orders = ordersQuery.data ?? []
  const { data: groups = [] } = useQuery(customerGroupsListQuery())
  const deleteCustomer = useDeleteCustomer()
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (customerQuery.isPending) {
    return (
      <div className="flex flex-col items-center gap-3 p-16 text-muted-foreground">
        <Spinner className="size-6" />
        <p className="text-sm">Loading customer</p>
      </div>
    )
  }

  const customer = customerQuery.data
  if (!customer) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 p-10 text-center">
        <UserXIcon
          className="size-10 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-foreground">
          Customer not found
        </p>
        <p className="text-sm text-muted-foreground">
          This customer doesn&apos;t exist or may have been removed.
        </p>
        <Link
          to="/customers"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to customers
        </Link>
      </div>
    )
  }

  const { ordersCount, totalSpent, lastOrderDate } = customerAggregates(
    customer.id,
    orders
  )
  const customerOrders = ordersForCustomer(orders, customer.id).sort((a, b) =>
    a.date < b.date ? 1 : -1
  )
  const groupsById = new Map(groups.map((g) => [g.id, g]))
  const memberGroups = customer.groups
    .map((id) => groupsById.get(id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g))

  const confirmDelete = () => {
    setDeleteOpen(false)
    deleteCustomer.mutate(customer.id, {
      onSuccess: () =>
        toast.success("Customer deleted", { description: customer.name }),
    })
    navigate({ to: "/customers" })
  }

  const stats: { label: string; value: string }[] = [
    { label: "Orders", value: String(ordersCount) },
    { label: "Total spent", value: formatCurrency(totalSpent) },
    {
      label: "Avg. order",
      value: ordersCount > 0 ? formatCurrency(totalSpent / ordersCount) : "-",
    },
    {
      label: "Last order",
      value: lastOrderDate ? formatOrderDate(lastOrderDate) : "-",
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={customer.name}
        description={customer.email}
        actions={
          <div className="flex items-center gap-2">
            {/* A real route up, not history.back(): the page is deep-linkable,
                so "back" has to mean the customer list rather than wherever the
                browser happened to come from. */}
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link to="/customers" />}
            >
              <ArrowLeftIcon
                data-icon="inline-start"
                className="size-4"
                aria-hidden="true"
              />
              Back
            </Button>
            <CustomerFormSheet
              mode="edit"
              customer={customer}
              trigger={
                <Button variant="outline">
                  <PencilIcon
                    data-icon="inline-start"
                    className="size-4"
                    aria-hidden="true"
                  />
                  Edit
                </Button>
              }
            />
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2Icon
                data-icon="inline-start"
                className="size-4"
                aria-hidden="true"
              />
              Delete
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Main */}
        <div className="flex min-w-0 flex-col gap-4">
          <Frame dense className="w-full">
            <FrameHeader>
              <FrameTitle>Overview</FrameTitle>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4 shadow-none!">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar className="size-12 shrink-0">
                  {customer.avatar ? (
                    <AvatarImage src={customer.avatar} alt="" />
                  ) : null}
                  <AvatarFallback>{initials(customer.name)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-base font-semibold text-foreground">
                    {customer.name}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <AccountBadge hasAccount={customer.hasAccount} />
                    <span className="text-xs text-muted-foreground">
                      Customer since {formatOrderDate(customer.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex min-w-0 flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      {stat.label}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground tabular-nums">
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </FramePanel>
          </Frame>

          <Frame dense className="w-full">
            <FrameHeader>
              <FrameTitle>Orders ({customerOrders.length})</FrameTitle>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-0 p-0! shadow-none!">
              {/* The order history derives from the orders read, so its empty
                  state may only speak once that read has settled. */}
              {ordersQuery.isPending ? (
                <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                  <Spinner className="size-4" /> Loading orders
                </div>
              ) : customerOrders.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No orders yet.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground">
                    <span className="w-24">Order</span>
                    <span className="flex-1">Placed</span>
                    <span className="w-28">Payment</span>
                    <span className="w-28">Fulfillment</span>
                    <span className="w-20 text-right">Total</span>
                  </div>
                  <Separator />
                  {customerOrders.map((order) => (
                    <Link
                      key={order.id}
                      to="/orders/$orderId"
                      params={{ orderId: order.id }}
                      className="flex items-center justify-between border-b px-4 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-muted/40"
                    >
                      <span className="w-24 font-mono text-sm font-medium text-foreground">
                        {order.number}
                      </span>
                      <span className="flex-1 text-muted-foreground">
                        {formatOrderDate(order.date)}
                      </span>
                      <span className="w-28">
                        <PaymentBadge payment={order.payment} />
                      </span>
                      <span className="w-28">
                        <FulfillmentBadge fulfillment={order.fulfillment} />
                      </span>
                      <span className="w-20 text-right font-semibold text-foreground tabular-nums">
                        {formatCurrency(order.totals.total)}
                      </span>
                    </Link>
                  ))}
                </>
              )}
            </FramePanel>
          </Frame>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <Frame dense className="w-full">
            <FrameHeader>
              <FrameTitle>Contact</FrameTitle>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3 shadow-none!">
              {[
                { label: "Email", value: customer.email },
                { label: "Phone", value: customer.phone ?? "-" },
                { label: "Company", value: customer.company ?? "-" },
                {
                  label: "Location",
                  value: customer.location
                    ? `${customer.location.city}, ${customer.location.countryCode}`
                    : "-",
                },
              ].map((row) => (
                <div key={row.label} className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">
                    {row.label}
                  </span>
                  <span className="truncate text-sm text-foreground">
                    {row.value}
                  </span>
                </div>
              ))}
            </FramePanel>
          </Frame>

          <Frame dense className="w-full">
            <FrameHeader>
              <FrameTitle>Groups</FrameTitle>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-2 shadow-none!">
              {memberGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not in any group. Use Edit to assign groups.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {memberGroups.map((group) => (
                    <Link
                      key={group.id}
                      to="/customers/groups/$groupId"
                      params={{ groupId: group.id }}
                    >
                      <Badge variant="secondary">{group.name}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </FramePanel>
          </Frame>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-foreground">
                {customer.name}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep customer</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
