import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import {
  applyTransition,
  checkDelete,
  type OrderTransition,
  type TransitionCheck,
  type TransitionResult,
} from "@/lib/data/order-lifecycle"
import { ordersRepository } from "@/lib/data/repositories"
import type { OrderInput } from "@/lib/data/repositories"
import type { Order } from "@/lib/data/types"

// Query keys for orders. `all` invalidates every order query at once.
export const orderKeys = {
  all: ["orders"] as const,
  lists: () => [...orderKeys.all, "list"] as const,
  details: () => [...orderKeys.all, "detail"] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
}

// List query. No `initialData`: the UI reads only from the store (in-memory in the
// demo), never from the in-code seed, so nothing renders before the DB read
// resolves. The query is `pending` on the server and the first client paint
// (identical markup, no hydration mismatch), and consumers show a loading state
// until the client read settles. `staleTime: 0` revalidates after any mutation.
export const ordersListQuery = () =>
  queryOptions({
    queryKey: orderKeys.lists(),
    queryFn: () => ordersRepository.list(),
    staleTime: 0,
  })

export const orderDetailQuery = (id: string) =>
  queryOptions({
    queryKey: orderKeys.detail(id),
    queryFn: () => ordersRepository.get(id),
    staleTime: 0,
  })

// ── Mutations (optimistic where the result is known up front) ──

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    // The store mints the id AND the number (one sequence, two faces - see
    // OrderInput), so the new row cannot be built here: no optimistic insert,
    // the list refetches on success.
    mutationFn: (input: OrderInput) => ordersRepository.create(input),
    onSettled: () => {
      // Only orderKeys.all. The dashboard and the customers pages DERIVE from
      // orders (revenue, order counts, last-order dates) and hold their own
      // query keys, but they all run staleTime: 0, so they refetch on mount -
      // and neither is mounted while an order is being created (the form owns
      // the screen). Invalidating them from here would couple this mutation to
      // every feature that ever joins against orders.
      queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
  })
}

/**
 * Delete an order, if it no longer carries money.
 *
 * Same shape as useOrderTransition and for the same reason: the guard runs
 * before onMutate strips the row out of the list, so a refused delete never
 * makes the row disappear and come back.
 */
export function useDeleteOrder() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (id: string) => ordersRepository.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: orderKeys.lists() })
      // Remove just this order from the list (leaving any concurrent optimistic
      // edits to other orders intact), and drop its detail cache so revisiting
      // the deleted order shows "not found" rather than a stale copy.
      queryClient.setQueryData<Order[]>(orderKeys.lists(), (old) =>
        (old ?? []).filter((o) => o.id !== id)
      )
      queryClient.removeQueries({ queryKey: orderKeys.detail(id) })
    },
    onError: () => {
      // onSettled invalidates and refetches from the store, so a failed delete
      // reappears on its own; no whole-list rollback that could clobber sibling
      // optimistic edits.
      toast.error("Could not delete order", {
        description: "Please try again.",
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
  })

  return {
    run: (order: Order): TransitionCheck => {
      const current =
        queryClient
          .getQueryData<Order[]>(orderKeys.lists())
          ?.find((o) => o.id === order.id) ?? order
      const check = checkDelete(current)
      if (check.ok) mutation.mutate(order.id)
      return check
    },
    isPending: mutation.isPending,
  }
}

/**
 * Move an order along its lifecycle.
 *
 * `run` is SYNCHRONOUS and guards before it starts the mutation, so an illegal
 * transition never reaches the cache. That ordering is the whole reason the
 * guard lives here rather than only in the store: TanStack Query runs onMutate
 * BEFORE mutationFn, so a repository rejection would land after the optimistic
 * patch had already been merged into the list and the detail - the UI would
 * flash the illegal state and roll back. It also hands the reason straight to
 * the caller, which is what `disabled=` and the bulk toast need.
 *
 * There is deliberately no `mutate` on the returned object. Exposing one would
 * leave the ungated door open next to the gated one, which is how the three call
 * sites this replaced each came to write their own patch literal.
 */
export function useOrderTransition() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: OrderTransition }) =>
      ordersRepository.transition(id, action),
    onMutate: async ({ id, action }) => {
      await queryClient.cancelQueries({ queryKey: orderKeys.all })
      // Snapshot only THIS order (not the whole list) so a rollback restores one
      // row without clobbering concurrent bulk edits to other orders.
      const previousOrder =
        queryClient
          .getQueryData<Order[]>(orderKeys.lists())
          ?.find((o) => o.id === id) ?? null
      const previousDetail = queryClient.getQueryData<Order | null>(
        orderKeys.detail(id)
      )
      // The patch is derived from the cached order rather than passed in, so the
      // optimistic write and the store's write are the same function of the same
      // record. `run` has already refused an illegal action; if the cache has no
      // copy to apply it to, skip the optimistic step and let the refetch settle it.
      const current = previousOrder ?? previousDetail ?? null
      const result = current ? applyTransition(current, action) : null
      if (result?.ok) {
        // A shallow merge, which is safe because a transition patch carries only
        // TOP-LEVEL SCALARS (status / payment / fulfillment). A patch carrying a
        // nested object - `shipping` - would silently replace it whole. This is
        // exactly the trap that made storing `shipping.steps` worth deleting
        // rather than keeping in sync.
        const patch = result.patch
        queryClient.setQueryData<Order[]>(orderKeys.lists(), (old) =>
          (old ?? []).map((o) => (o.id === id ? { ...o, ...patch } : o))
        )
        queryClient.setQueryData<Order | null>(orderKeys.detail(id), (old) =>
          old ? { ...old, ...patch } : old
        )
      }
      return { previousOrder, previousDetail, id }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        // Restore only this order's row, leaving sibling optimistic edits intact.
        queryClient.setQueryData<Order[]>(orderKeys.lists(), (old) =>
          old
            ? old.map((o) => (o.id === ctx.id ? (ctx.previousOrder ?? o) : o))
            : old
        )
        if (ctx.previousDetail !== undefined) {
          queryClient.setQueryData(orderKeys.detail(ctx.id), ctx.previousDetail)
        }
      }
      toast.error("Could not update order")
    },
    onSettled: () => {
      // Only orderKeys, even though a fulfil MOVES STOCK and every transition
      // changes what the ledger reads as allocated. /inventory runs staleTime: 0
      // and is never on screen at the same time as /orders, so it refetches on
      // mount and sees both - same reasoning as useCreateOrder above, and the
      // reason this mutation does not have to know who joins against orders.
      queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
  })

  return {
    /**
     * Guard, then run. Returns the verdict so the caller can report the reason
     * it refused; the mutation only starts on `{ ok: true }`.
     */
    run: (order: Order, action: OrderTransition): TransitionResult => {
      // Guard against the CACHE's copy, not the caller's prop, which may be a
      // render behind - so a double-clicked Cancel refuses the second time.
      const current =
        queryClient
          .getQueryData<Order[]>(orderKeys.lists())
          ?.find((o) => o.id === order.id) ??
        queryClient.getQueryData<Order>(orderKeys.detail(order.id)) ??
        order
      const result = applyTransition(current, action)
      if (result.ok) mutation.mutate({ id: order.id, action })
      return result
    },
    isPending: mutation.isPending,
  }
}
