import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { purchaseOrdersRepository } from "@/lib/data/repositories"
import { USER } from "@/components/shared/app-shell/data"
import { inventoryKeys } from "@/features/inventory/queries"
import type {
  PurchaseOrder,
  PurchaseOrderLine,
} from "@/lib/data/purchase-orders"

// A SKU as the Create-PO sheet holds it before drafting: everything a stored
// line needs, plus the supplier it belongs to (a PO is single-supplier, so a
// mixed-supplier selection splits into one PO each). Shared by the sheet and by
// the reorder / ledger callers that build it.
export interface PoLine {
  productId: string
  sku: string
  name: string
  thumbnail?: string | null
  quantity: number
  unitCost: number
  supplierId: string
  supplierName: string
}

export interface CreatePurchaseOrdersInput {
  lines: PoLine[]
  /** Where every drafted PO receives its stock. */
  locationId: string
  expectedDate?: string
  note?: string
}

export const purchaseOrderKeys = {
  all: ["purchaseOrders"] as const,
  list: () => [...purchaseOrderKeys.all, "list"] as const,
}

export function purchaseOrdersListQuery() {
  return {
    queryKey: purchaseOrderKeys.list(),
    queryFn: () => purchaseOrdersRepository.list(),
  }
}

export function usePurchaseOrders() {
  return useQuery(purchaseOrdersListQuery())
}

function toStoredLine(line: PoLine): PurchaseOrderLine {
  return {
    productId: line.productId,
    sku: line.sku,
    name: line.name,
    thumbnail: line.thumbnail ?? null,
    quantity: line.quantity,
    unitCost: line.unitCost,
  }
}

/**
 * Draft one PO per supplier from a set of lines. A PO is raised for a single
 * supplier, so a selection spanning several splits into several drafts.
 *
 * The creates run in sequence, not in parallel: each mints its id from the
 * highest already in the store, so two concurrent creates would read the same
 * max and collide on the number.
 */
export function useCreatePurchaseOrders() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreatePurchaseOrdersInput) => {
      const bySupplier = new Map<string, PoLine[]>()
      for (const line of input.lines) {
        const group = bySupplier.get(line.supplierId) ?? []
        group.push(line)
        bySupplier.set(line.supplierId, group)
      }

      const created: PurchaseOrder[] = []
      for (const group of bySupplier.values()) {
        const po = await purchaseOrdersRepository.create({
          supplierId: group[0].supplierId,
          supplierName: group[0].supplierName,
          locationId: input.locationId,
          lines: group.map(toStoredLine),
          expectedDate: input.expectedDate || undefined,
          note: input.note?.trim() || undefined,
        })
        created.push(po)
      }
      return created
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all })
    },
  })
}

/**
 * Receive a draft PO: the store adds each line's units to the shelf and records
 * a restock, so both the PO list and every inventory view have to refetch.
 */
export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => purchaseOrdersRepository.receive(id, USER),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
    },
  })
}

export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => purchaseOrdersRepository.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all })
    },
  })
}
