import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import {
  customerGroupsRepository,
  customersRepository,
  type CustomerGroupInput,
  type CustomerInput,
} from "@/lib/data/repositories"
import {
  orderNetTotal,
  type Customer,
  type CustomerGroup,
  type Order,
} from "@/lib/data/types"

// ── Query keys ──

export const customerKeys = {
  all: ["customers"] as const,
  lists: () => [...customerKeys.all, "list"] as const,
  details: () => [...customerKeys.all, "detail"] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
}

export const customerGroupKeys = {
  all: ["customer-groups"] as const,
  lists: () => [...customerGroupKeys.all, "list"] as const,
  details: () => [...customerGroupKeys.all, "detail"] as const,
  detail: (id: string) => [...customerGroupKeys.details(), id] as const,
}

// No initialData: read only from the store (in-memory in the demo), pending on the
// server + first paint, revalidate after mutations. Mirrors features/orders.

export const customersListQuery = () =>
  queryOptions({
    queryKey: customerKeys.lists(),
    queryFn: () => customersRepository.list(),
    staleTime: 0,
  })

export const customerDetailQuery = (id: string) =>
  queryOptions({
    queryKey: customerKeys.detail(id),
    queryFn: () => customersRepository.get(id),
    staleTime: 0,
  })

export const customerGroupsListQuery = () =>
  queryOptions({
    queryKey: customerGroupKeys.lists(),
    queryFn: () => customerGroupsRepository.list(),
    staleTime: 0,
  })

export const customerGroupDetailQuery = (id: string) =>
  queryOptions({
    queryKey: customerGroupKeys.detail(id),
    queryFn: () => customerGroupsRepository.get(id),
    staleTime: 0,
  })

// ── Derived view-model + join helpers (computed at read time, never stored) ──

export interface CustomerRow extends Customer {
  ordersCount: number
  totalSpent: number
  lastOrderDate: string | null
}

export function customerAggregates(customerId: string, orders: Order[]) {
  let ordersCount = 0
  let totalSpent = 0
  let lastOrderDate: string | null = null
  for (const order of orders) {
    if (order.customer.handle !== customerId) continue
    ordersCount += 1
    // orderNetTotal, not an inline `status !== "cancelled"`. Restating the money
    // rule here is what isSale's doc comment says it exists to prevent, and it
    // bit exactly as described: when the rule learned about refunds, /analytics
    // and /dashboard picked it up and this page alone kept its own older answer.
    totalSpent += orderNetTotal(order)
    if (!lastOrderDate || order.date > lastOrderDate) lastOrderDate = order.date
  }
  return { ordersCount, totalSpent, lastOrderDate }
}

/** Merge customers with their order aggregates. Pass both query results. */
export function buildCustomerRows(
  customers: Customer[],
  orders: Order[]
): CustomerRow[] {
  return customers.map((customer) => ({
    ...customer,
    ...customerAggregates(customer.id, orders),
  }))
}

export function ordersForCustomer(
  orders: Order[],
  customerId: string
): Order[] {
  return orders.filter((order) => order.customer.handle === customerId)
}

export function customersInGroup(
  customers: Customer[],
  groupId: string
): Customer[] {
  return customers.filter((customer) => customer.groups.includes(groupId))
}

export function groupMemberCount(
  customers: Customer[],
  groupId: string
): number {
  return customers.reduce(
    (count, customer) => count + (customer.groups.includes(groupId) ? 1 : 0),
    0
  )
}

// ── Customer mutations (optimistic, targeted rollback like features/orders) ──

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerInput) => customersRepository.create(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all })
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Customer> }) =>
      customersRepository.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: customerKeys.all })
      const previousCustomer =
        queryClient
          .getQueryData<Customer[]>(customerKeys.lists())
          ?.find((c) => c.id === id) ?? null
      const previousDetail = queryClient.getQueryData<Customer | null>(
        customerKeys.detail(id)
      )
      queryClient.setQueryData<Customer[]>(customerKeys.lists(), (old) =>
        (old ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c))
      )
      queryClient.setQueryData<Customer | null>(
        customerKeys.detail(id),
        (old) => (old ? { ...old, ...patch } : old)
      )
      return { previousCustomer, previousDetail, id }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        queryClient.setQueryData<Customer[]>(customerKeys.lists(), (old) =>
          old
            ? old.map((c) =>
                c.id === ctx.id ? (ctx.previousCustomer ?? c) : c
              )
            : old
        )
        if (ctx.previousDetail !== undefined) {
          queryClient.setQueryData(
            customerKeys.detail(ctx.id),
            ctx.previousDetail
          )
        }
      }
      toast.error("Could not update customer")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all })
    },
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => customersRepository.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: customerKeys.lists() })
      queryClient.setQueryData<Customer[]>(customerKeys.lists(), (old) =>
        (old ?? []).filter((c) => c.id !== id)
      )
      queryClient.removeQueries({ queryKey: customerKeys.detail(id) })
    },
    onError: () => {
      toast.error("Could not delete customer", {
        description: "Please try again.",
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all })
    },
  })
}

// ── Customer group mutations ──

export function useCreateGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerGroupInput) =>
      customerGroupsRepository.create(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerGroupKeys.all })
    },
  })
}

export function useUpdateGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<CustomerGroup>
    }) => customerGroupsRepository.update(id, patch),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerGroupKeys.all })
    },
  })
}

export function useDeleteGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => customerGroupsRepository.remove(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerGroupKeys.all })
    },
  })
}

// Membership: adding/removing a customer to/from a group is a patch to the
// customer's `groups` array. Accepts several customers so the group detail can
// batch. Invalidates customers (membership) + groups (member counts).
export function useSetCustomerGroups() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (updates: { id: string; groups: string[] }[]) => {
      for (const { id, groups } of updates) {
        await customersRepository.update(id, { groups })
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all })
      queryClient.invalidateQueries({ queryKey: customerGroupKeys.all })
    },
  })
}
