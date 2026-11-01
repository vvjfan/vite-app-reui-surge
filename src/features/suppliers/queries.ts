import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import { suppliersRepository } from "@/lib/data/repositories"
import type { Supplier } from "@/lib/data/suppliers"

// Suppliers: a small CRUD collection managed in Settings and referenced by
// inventory rows (InventoryItem.supplierId). Mirrors the locations feature.

export const supplierKeys = {
  all: ["suppliers"] as const,
  lists: () => [...supplierKeys.all, "list"] as const,
}

// No `initialData`: the UI reads only from the store, so consumers hold a
// loading state until the first client read settles.
export const suppliersListQuery = () =>
  queryOptions({
    queryKey: supplierKeys.lists(),
    queryFn: () => suppliersRepository.list(),
    staleTime: 0,
  })

export function useSuppliers() {
  return useQuery(suppliersListQuery())
}

function useInvalidateSuppliers() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: supplierKeys.all })
    // Inventory renders supplier names through this list, so refresh it too.
    queryClient.invalidateQueries({ queryKey: ["inventory"] })
  }
}

export function useCreateSupplier() {
  const invalidate = useInvalidateSuppliers()
  return useMutation({
    mutationFn: (input: Omit<Supplier, "id">) =>
      suppliersRepository.create(input),
    onError: () => toast.error("Could not create the supplier"),
    onSettled: invalidate,
  })
}

export function useUpdateSupplier() {
  const invalidate = useInvalidateSuppliers()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Supplier> }) =>
      suppliersRepository.update(id, patch),
    onError: () => toast.error("Could not save the supplier"),
    onSettled: invalidate,
  })
}

export function useDeleteSupplier() {
  const invalidate = useInvalidateSuppliers()
  return useMutation({
    mutationFn: (id: string) => suppliersRepository.remove(id),
    onError: () => toast.error("Could not delete the supplier"),
    onSettled: invalidate,
  })
}
