import { useCallback } from "react"
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import type { Promotion, PromotionStatus } from "@/lib/data/promotions"
import {
  promotionsRepository,
  type PromotionInput,
} from "@/lib/data/repositories"

// Query keys for promotions. `all` invalidates every promotion query at once.
export const promotionKeys = {
  all: ["promotions"] as const,
  lists: () => [...promotionKeys.all, "list"] as const,
  details: () => [...promotionKeys.all, "detail"] as const,
  detail: (id: string) => [...promotionKeys.details(), id] as const,
}

// List query. No `initialData`: the UI reads only from the store (in-memory in the
// demo), never from the in-code seed, so nothing renders before the DB read
// resolves. The query is `pending` on the server and the first client paint
// (identical markup, no hydration mismatch), and consumers show a loading state
// until the client read settles. `staleTime: 0` revalidates after any mutation.
export const promotionsListQuery = () =>
  queryOptions({
    queryKey: promotionKeys.lists(),
    queryFn: () => promotionsRepository.list(),
    staleTime: 0,
  })

export function usePromotions() {
  return useQuery(promotionsListQuery())
}

// Detail query, same contract as the list: no `initialData`, `staleTime: 0`. The
// detail route branches on `isPending` before it branches on a missing record,
// so a slow store read shows a loading state rather than a false "not found".
export const promotionDetailQuery = (id: string) =>
  queryOptions({
    queryKey: promotionKeys.detail(id),
    queryFn: () => promotionsRepository.get(id),
    staleTime: 0,
  })

// ── Mutations ──

// Create. The id is assigned by the repo, so there is no optimistic
// insert - the list refetches once the write settles (same as products' create).
// `usedCount` defaults to 0 for a brand-new promotion, and an unranked one
// stacks last: it must not silently outrank promotions already tuned by hand.
export function useCreatePromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: PromotionInput) => {
      const existing = await promotionsRepository.list()
      const nextRank = existing.reduce((max, p) => Math.max(max, p.rank + 1), 0)
      return promotionsRepository.create({
        ...input,
        usedCount: input.usedCount ?? 0,
        rank: input.rank ?? nextRank,
      })
    },
    onError: () => {
      toast.error("Could not create promotion", {
        description: "Please try again.",
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: promotionKeys.all })
    },
  })
}

// Optimistic single-row update: the UI updates immediately, rolls back on error.
export function useUpdatePromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Promotion> }) =>
      promotionsRepository.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: promotionKeys.all })
      // Snapshot only THIS promotion (not the whole list) so a rollback restores
      // one row without clobbering concurrent bulk edits to other promotions.
      const previousPromotion =
        queryClient
          .getQueryData<Promotion[]>(promotionKeys.lists())
          ?.find((p) => p.id === id) ?? null
      const previousDetail = queryClient.getQueryData<Promotion | null>(
        promotionKeys.detail(id)
      )
      queryClient.setQueryData<Promotion[]>(promotionKeys.lists(), (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p))
      )
      queryClient.setQueryData<Promotion | null>(
        promotionKeys.detail(id),
        (old) => (old ? { ...old, ...patch } : old)
      )
      return { previousPromotion, previousDetail, id }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        // Restore only this promotion's row, leaving sibling optimistic edits.
        queryClient.setQueryData<Promotion[]>(promotionKeys.lists(), (old) =>
          old
            ? old.map((p) =>
                p.id === ctx.id ? (ctx.previousPromotion ?? p) : p
              )
            : old
        )
        if (ctx.previousDetail !== undefined) {
          queryClient.setQueryData(
            promotionKeys.detail(ctx.id),
            ctx.previousDetail
          )
        }
      }
      toast.error("Could not update promotion")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: promotionKeys.all })
    },
  })
}

// Optimistic remove: drop the row immediately, rely on onSettled's refetch to
// bring it back on failure (no whole-list rollback that could clobber siblings).
export function useDeletePromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => promotionsRepository.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: promotionKeys.lists() })
      queryClient.setQueryData<Promotion[]>(promotionKeys.lists(), (old) =>
        (old ?? []).filter((p) => p.id !== id)
      )
      queryClient.removeQueries({ queryKey: promotionKeys.detail(id) })
    },
    onError: () => {
      toast.error("Could not delete promotion", {
        description: "Please try again.",
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: promotionKeys.all })
    },
  })
}

// Reorder: takes every promotion in its new order and rewrites the whole block
// of ranks. Stacking is resolved across the entire list rather than within a
// group, so the list is the smallest unit that can be written consistently.
export function useReorderPromotions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, rank) => promotionsRepository.update(id, { rank }))
      )
    },
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: promotionKeys.lists() })
      const previous = queryClient.getQueryData<Promotion[]>(
        promotionKeys.lists()
      )
      const ranks = new Map(orderedIds.map((id, rank) => [id, rank]))
      queryClient.setQueryData<Promotion[]>(promotionKeys.lists(), (old) =>
        (old ?? []).map((p) => {
          const rank = ranks.get(p.id)
          return rank === undefined ? p : { ...p, rank }
        })
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(promotionKeys.lists(), ctx.previous)
      }
      toast.error("Could not reorder promotion")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: promotionKeys.all })
    },
  })
}

// Bulk enable/disable helper the grid uses: fire an optimistic status update per
// id, reusing the single-row update mutation (so each row rolls back on its own).
export function useSetPromotionStatus() {
  const updatePromotion = useUpdatePromotion()
  return useCallback(
    (ids: string[], status: PromotionStatus) => {
      ids.forEach((id) => updatePromotion.mutate({ id, patch: { status } }))
    },
    [updatePromotion]
  )
}
