import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import type { Review } from "@/lib/data/reviews"
import { reviewsRepository } from "@/lib/data/repositories"

// Query keys for reviews. `all` invalidates every review query at once.
// There is no detail query: the moderation sheet reads its row out of the list
// cache, so it stays live while a status is being updated.
export const reviewKeys = {
  all: ["reviews"] as const,
  lists: () => [...reviewKeys.all, "list"] as const,
}

// No `initialData`: the UI reads only from the store (in-memory in the demo), never
// from the in-code seed - loading state until the DB read settles, staleTime:0
// to revalidate after moderation.
export const reviewsListQuery = () =>
  queryOptions({
    queryKey: reviewKeys.lists(),
    queryFn: () => reviewsRepository.list(),
    staleTime: 0,
  })

// ── Mutations (optimistic: the result is known up front) ──

/**
 * The moderation write. A backend typically exposes this as a bulk
 * POST /admin/reviews/status { ids, status }; here the grid loops this per id,
 * matching how the orders and products grids do bulk status changes.
 */
export function useUpdateReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Review> }) =>
      reviewsRepository.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: reviewKeys.all })
      const previousReview =
        queryClient
          .getQueryData<Review[]>(reviewKeys.lists())
          ?.find((review) => review.id === id) ?? null
      queryClient.setQueryData<Review[]>(reviewKeys.lists(), (old) =>
        (old ?? []).map((review) =>
          review.id === id ? { ...review, ...patch } : review
        )
      )
      return { previousReview, id }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        queryClient.setQueryData<Review[]>(reviewKeys.lists(), (old) =>
          old
            ? old.map((review) =>
                review.id === ctx.id ? (ctx.previousReview ?? review) : review
              )
            : old
        )
      }
      toast.error("Could not update review")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all })
    },
  })
}

export function useDeleteReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reviewsRepository.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: reviewKeys.lists() })
      queryClient.setQueryData<Review[]>(reviewKeys.lists(), (old) =>
        (old ?? []).filter((review) => review.id !== id)
      )
    },
    onError: () => {
      toast.error("Could not delete review", {
        description: "Please try again.",
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all })
    },
  })
}
