import type { PaymentProvider } from "../../payments"
import { makeDemoCollection } from "./make-collection"

export const demoPaymentProvidersRepository =
  makeDemoCollection<PaymentProvider>((db) => db.paymentProviders)
