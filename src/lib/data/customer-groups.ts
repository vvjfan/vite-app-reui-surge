import type { CustomerGroup } from "./types"

// Deterministic seed for customer groups (segments). Membership is stored on
// Customer.groups (see ./customers.ts); a group's members are the customers
// whose `groups` include the group id.

export const CUSTOMER_GROUPS: CustomerGroup[] = [
  {
    id: "vip",
    name: "VIP",
    description: "Top spenders with priority support",
    createdAt: "2024-11-02T09:00:00.000Z",
  },
  {
    id: "wholesale",
    name: "Wholesale",
    description: "B2B accounts on volume pricing",
    createdAt: "2024-11-10T09:00:00.000Z",
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "Opted in to marketing emails and campaigns",
    createdAt: "2024-12-01T09:00:00.000Z",
  },
  {
    id: "early-access",
    name: "Early access",
    description: "Beta and pre-launch product testers",
    createdAt: "2025-01-15T09:00:00.000Z",
  },
  {
    id: "at-risk",
    name: "At risk",
    description: "No recent orders, win-back targets",
    createdAt: "2025-02-20T09:00:00.000Z",
  },
]
