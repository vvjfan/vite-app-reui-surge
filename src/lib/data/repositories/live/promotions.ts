import type { Promotion } from "../../promotions"
import type { PromotionsRepository } from "../types"
import { notImplementedRepository } from "./not-implemented"

export const livePromotionsRepository: PromotionsRepository =
  notImplementedRepository<Promotion, Omit<Promotion, "id">>("promotions")
