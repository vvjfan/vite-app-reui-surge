import type { InvoicesRepository } from "../types"
import { notImplementedRepository } from "./not-implemented"

export const liveInvoicesRepository: InvoicesRepository =
  notImplementedRepository("invoices")
