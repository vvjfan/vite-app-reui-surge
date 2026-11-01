// Payment providers: the catalog + connection status, seeded into the demo
// `paymentProviders` store and reached through paymentProvidersRepository.
// Provider logos are React components, so they stay in the feature (mapped by
// id); only the data lives here.

export type ProviderStatus = "connected" | "available"

export interface PaymentProvider {
  id: string
  name: string
  description: string
  status: ProviderStatus
}

export const PAYMENT_PROVIDERS: PaymentProvider[] = [
  {
    id: "stripe",
    name: "Stripe",
    description:
      "Accept cards, wallets, and local methods with unified payouts.",
    status: "connected",
  },
  {
    id: "paypal",
    name: "PayPal",
    description:
      "Let customers check out with a PayPal balance or linked cards.",
    status: "connected",
  },
  {
    id: "apple-pay",
    name: "Apple Pay",
    description: "One-tap wallet checkout for customers on Apple devices.",
    status: "available",
  },
  {
    id: "google-pay",
    name: "Google Pay",
    description: "Fast wallet checkout across Android and Chrome.",
    status: "available",
  },
  {
    id: "bank-transfer",
    name: "Bank transfer",
    description: "Accept manual bank transfers, reconciled on receipt.",
    status: "connected",
  },
  {
    id: "cod",
    name: "Cash on delivery",
    description: "Collect payment in person when the order is delivered.",
    status: "available",
  },
]
