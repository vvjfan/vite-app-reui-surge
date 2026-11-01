import type { Supplier } from "../../suppliers"
import type { SupplierInput, SuppliersRepository } from "../types"
import { notImplementedRepository } from "./not-implemented"

export const liveSuppliersRepository: SuppliersRepository =
  notImplementedRepository<Supplier, SupplierInput>("suppliers")
