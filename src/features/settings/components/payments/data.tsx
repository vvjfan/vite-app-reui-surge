import type { ReactNode } from "react"
import type { BadgeProps } from "@/components/reui/badge"

import { Apple } from "@/components/ui/svgs/apple"
import { Google } from "@/components/ui/svgs/google"
import { PayPal } from "@/components/ui/svgs/paypal"
import { Stripe } from "@/components/ui/svgs/stripe"
import { MoneyIcon as BanknoteIcon, CoinsIcon } from "@phosphor-icons/react"
import type { ProviderStatus } from "@/lib/data/payments"

// Presentation config for the Payments page. The provider records (id, name,
// description, status) are seeded into the demo store and queried; only the logos (React
// components) and status badge styling live here, keyed by provider id.

export const PROVIDER_STATUS_META: Record<
  ProviderStatus,
  { label: string; variant: BadgeProps["variant"] }
> = {
  connected: { label: "Connected", variant: "success-light" },
  available: { label: "Available", variant: "secondary" },
}

// Sizing is owned by the icon container these render into, so no size class here.
//
// The branded gateways carry their own marks, vendored from the SVGL registry
// (svgl.app) so the app stays self-contained: Stripe and PayPal are full-colour
// (one mark for both themes), Apple ships a black/white pair swapped by theme.
// Bank transfer and cash on delivery are generic methods, not brands, so they
// stay iconographic by design. Each mark is keyed by provider id, so a new
// gateway is branded by dropping its licensed SVG in here.
export const PROVIDER_LOGOS: Record<string, ReactNode> = {
  stripe: <Stripe aria-hidden="true" />,
  paypal: <PayPal aria-hidden="true" />,
  "apple-pay": <Apple aria-hidden="true" />,
  "google-pay": <Google aria-hidden="true" />,
  "bank-transfer": <BanknoteIcon aria-hidden="true" />,
  cod: <CoinsIcon aria-hidden="true" />,
}
