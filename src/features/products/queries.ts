import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import type { Product } from "@/lib/data/products"
import { productsRepository } from "@/lib/data/repositories"

// Query keys for products. `all` invalidates every product query at once.
export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  details: () => [...productKeys.all, "detail"] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
}

// No `initialData`: the UI reads only from the store (in-memory in the demo), never
// from the in-code seed. See src/features/orders/queries.ts for the full
// rationale (pending on server + first paint, loading state until the DB read
// settles, staleTime:0 to revalidate after mutations).
export const productsListQuery = () =>
  queryOptions({
    queryKey: productKeys.lists(),
    queryFn: () => productsRepository.list(),
    staleTime: 0,
  })

export const productDetailQuery = (id: string) =>
  queryOptions({
    queryKey: productKeys.detail(id),
    queryFn: () => productsRepository.get(id),
    staleTime: 0,
  })

// ── Mutations (optimistic where the result is known up front) ──

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    // The backend assigns the id (a unique handle in the demo), so there is no
    // optimistic insert; the list refetches on success.
    mutationFn: (input: Omit<Product, "id">) =>
      productsRepository.create(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => productsRepository.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: productKeys.lists() })
      queryClient.setQueryData<Product[]>(productKeys.lists(), (old) =>
        (old ?? []).filter((p) => p.id !== id)
      )
      queryClient.removeQueries({ queryKey: productKeys.detail(id) })
    },
    onError: () => {
      toast.error("Could not delete product", {
        description: "Please try again.",
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Product> }) =>
      productsRepository.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: productKeys.all })
      const previousProduct =
        queryClient
          .getQueryData<Product[]>(productKeys.lists())
          ?.find((p) => p.id === id) ?? null
      const previousDetail = queryClient.getQueryData<Product | null>(
        productKeys.detail(id)
      )
      queryClient.setQueryData<Product[]>(productKeys.lists(), (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p))
      )
      queryClient.setQueryData<Product | null>(productKeys.detail(id), (old) =>
        old ? { ...old, ...patch } : old
      )
      return { previousProduct, previousDetail, id }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        queryClient.setQueryData<Product[]>(productKeys.lists(), (old) =>
          old
            ? old.map((p) => (p.id === ctx.id ? (ctx.previousProduct ?? p) : p))
            : old
        )
        if (ctx.previousDetail !== undefined) {
          queryClient.setQueryData(
            productKeys.detail(ctx.id),
            ctx.previousDetail
          )
        }
      }
      toast.error("Could not update product")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}
