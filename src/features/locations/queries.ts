import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import { locationsRepository } from "@/lib/data/repositories"
import type { StockLocation } from "@/lib/data/locations"

// Stock locations: a small CRUD collection managed in Settings and referenced by
// inventory rows (InventoryItem.locationId).

export const locationKeys = {
  all: ["locations"] as const,
  lists: () => [...locationKeys.all, "list"] as const,
}

// No `initialData`: the UI reads only from the store, so consumers hold a
// loading state until the first client read settles.
export const locationsListQuery = () =>
  queryOptions({
    queryKey: locationKeys.lists(),
    queryFn: () => locationsRepository.list(),
    staleTime: 0,
  })

export function useLocations() {
  return useQuery(locationsListQuery())
}

function useInvalidateLocations() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: locationKeys.all })
    // Inventory renders location names through this list, so refresh it too.
    queryClient.invalidateQueries({ queryKey: ["inventory"] })
  }
}

export function useCreateLocation() {
  const invalidate = useInvalidateLocations()
  return useMutation({
    mutationFn: (input: Omit<StockLocation, "id">) =>
      locationsRepository.create(input),
    onError: () => toast.error("Could not create the location"),
    onSettled: invalidate,
  })
}

export function useUpdateLocation() {
  const invalidate = useInvalidateLocations()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<StockLocation>
    }) => locationsRepository.update(id, patch),
    onError: () => toast.error("Could not save the location"),
    onSettled: invalidate,
  })
}

export function useDeleteLocation() {
  const invalidate = useInvalidateLocations()
  return useMutation({
    mutationFn: (id: string) => locationsRepository.remove(id),
    onError: () => toast.error("Could not delete the location"),
    onSettled: invalidate,
  })
}
