import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import type { Category } from "@/lib/data/categories"
import { categoriesRepository } from "@/lib/data/repositories"

// Query keys for categories. `all` invalidates every category query at once.
export const categoryKeys = {
  all: ["categories"] as const,
  lists: () => [...categoryKeys.all, "list"] as const,
  details: () => [...categoryKeys.all, "detail"] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
}

// No `initialData`: the UI reads only from the store (in-memory in the demo), never
// from the in-code seed - matches src/features/products/queries.ts (loading
// state until the DB read settles, staleTime:0 to revalidate after mutations).
export const categoriesListQuery = () =>
  queryOptions({
    queryKey: categoryKeys.lists(),
    queryFn: () => categoriesRepository.list(),
    staleTime: 0,
  })

export const categoryDetailQuery = (id: string) =>
  queryOptions({
    queryKey: categoryKeys.detail(id),
    queryFn: () => categoriesRepository.get(id),
    staleTime: 0,
  })

// ── Mutations (optimistic where the result is known up front) ──

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<Category, "id">) =>
      categoriesRepository.create(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Category> }) =>
      categoriesRepository.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.all })
      const previousCategory =
        queryClient
          .getQueryData<Category[]>(categoryKeys.lists())
          ?.find((c) => c.id === id) ?? null
      const previousDetail = queryClient.getQueryData<Category | null>(
        categoryKeys.detail(id)
      )
      queryClient.setQueryData<Category[]>(categoryKeys.lists(), (old) =>
        (old ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c))
      )
      queryClient.setQueryData<Category | null>(
        categoryKeys.detail(id),
        (old) => (old ? { ...old, ...patch } : old)
      )
      return { previousCategory, previousDetail, id }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        queryClient.setQueryData<Category[]>(categoryKeys.lists(), (old) =>
          old
            ? old.map((c) =>
                c.id === ctx.id ? (ctx.previousCategory ?? c) : c
              )
            : old
        )
        if (ctx.previousDetail !== undefined) {
          queryClient.setQueryData(
            categoryKeys.detail(ctx.id),
            ctx.previousDetail
          )
        }
      }
      toast.error("Could not update category")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => categoriesRepository.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.lists() })
      queryClient.setQueryData<Category[]>(categoryKeys.lists(), (old) =>
        (old ?? []).filter((c) => c.id !== id)
      )
      queryClient.removeQueries({ queryKey: categoryKeys.detail(id) })
    },
    onError: () => {
      toast.error("Could not delete category", {
        description: "Please try again.",
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all })
    },
  })
}

// Reorder: takes one parent's children in their new order and rewrites every
// rank in the group. Rank is only meaningful among siblings, so a group is the
// smallest unit that can be written consistently.
export function useReorderCategories() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, rank) => categoriesRepository.update(id, { rank }))
      )
    },
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.lists() })
      const previous = queryClient.getQueryData<Category[]>(
        categoryKeys.lists()
      )
      const ranks = new Map(orderedIds.map((id, rank) => [id, rank]))
      queryClient.setQueryData<Category[]>(categoryKeys.lists(), (old) =>
        (old ?? []).map((c) => {
          const rank = ranks.get(c.id)
          return rank === undefined ? c : { ...c, rank }
        })
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(categoryKeys.lists(), ctx.previous)
      }
      toast.error("Could not reorder category")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all })
    },
  })
}
