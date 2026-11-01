import type { PaymentProvidersRepository } from "../types"
import { notImplementedRepository } from "./not-implemented"

export const livePaymentProvidersRepository: PaymentProvidersRepository =
  notImplementedRepository("payment providers")
