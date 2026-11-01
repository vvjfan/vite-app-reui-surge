import type { InventoryRepository } from "../types"
import { notImplementedRepository } from "./not-implemented"

export const liveInventoryRepository: InventoryRepository =
  notImplementedRepository("inventory")
