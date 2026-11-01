// Billing: invoices (seeded into the demo `invoices` store) and the plan /
// payment-method / limits config (seeded as a settings singleton). Usage meters
// are derived from live data at query time (order count, member count), not
// stored here.

export interface Invoice {
  id: string
  date: string
  amount: string
}

export const INVOICES: Invoice[] = [
  { id: "INV-2026-07", date: "Jul 1, 2026", amount: "$79.00" },
  { id: "INV-2026-06", date: "Jun 1, 2026", amount: "$79.00" },
  { id: "INV-2026-05", date: "May 1, 2026", amount: "$79.00" },
  { id: "INV-2026-04", date: "Apr 1, 2026", amount: "$49.00" },
]

export const BILLING_KEY = "billing-config"

export interface BillingConfig {
  planName: string
  price: string
  renews: string
  paymentBrand: string
  paymentLast4: string
  paymentExpiry: string
  limits: { orders: number; seats: number; storageGb: number }
  storageUsedGb: number
}

export const DEFAULT_BILLING: BillingConfig = {
  planName: "Growth plan",
  price: "$79 / month",
  renews: "renews Aug 1, 2026",
  paymentBrand: "Visa",
  paymentLast4: "4242",
  paymentExpiry: "08 / 2027",
  limits: { orders: 2000, seats: 10, storageGb: 10 },
  storageUsedGb: 3.2,
}
