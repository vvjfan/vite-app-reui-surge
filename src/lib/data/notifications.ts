// Notification preferences: a flat record per store event (with its tab/group
// metadata and per-channel toggles), seeded into the demo `notificationPrefs`
// store. The tabbed matrix is reconstructed from these rows in the feature.

export const CHANNELS = ["Email", "SMS", "In-app"] as const

export interface NotificationPref {
  id: string
  order: number
  tabId: string
  tabLabel: string
  groupId: string
  groupTitle: string
  label: string
  email: boolean
  sms: boolean
  inApp: boolean
}

type Row = Omit<
  NotificationPref,
  "order" | "tabId" | "tabLabel" | "groupId" | "groupTitle"
>

function group(
  tabId: string,
  tabLabel: string,
  groupId: string,
  groupTitle: string,
  rows: Row[]
): Omit<NotificationPref, "order">[] {
  return rows.map((r) => ({ ...r, tabId, tabLabel, groupId, groupTitle }))
}

// Seed order is preserved via `order` (rows come back by primary key/id).
const rows: Omit<NotificationPref, "order">[] = [
  ...group("orders", "Orders", "order-lifecycle", "Order lifecycle", [
    {
      id: "order-placed",
      label: "New order placed",
      email: true,
      sms: true,
      inApp: true,
    },
    {
      id: "payment-received",
      label: "Payment received",
      email: true,
      sms: false,
      inApp: true,
    },
    {
      id: "order-fulfilled",
      label: "Order fulfilled or shipped",
      email: true,
      sms: true,
      inApp: false,
    },
    {
      id: "order-cancelled",
      label: "Order cancelled",
      email: true,
      sms: false,
      inApp: true,
    },
  ]),
  ...group("orders", "Orders", "disputes", "Payments & disputes", [
    {
      id: "refund-requested",
      label: "Refund requested",
      email: true,
      sms: false,
      inApp: true,
    },
    {
      id: "chargeback",
      label: "Chargeback received",
      email: true,
      sms: false,
      inApp: true,
    },
  ]),
  ...group("inventory", "Inventory", "stock-alerts", "Stock alerts", [
    {
      id: "low-stock",
      label: "Low stock warning",
      email: true,
      sms: false,
      inApp: true,
    },
    {
      id: "out-of-stock",
      label: "Out of stock",
      email: true,
      sms: false,
      inApp: true,
    },
    {
      id: "restock",
      label: "Restock received",
      email: false,
      sms: false,
      inApp: true,
    },
    {
      id: "reorder",
      label: "Reorder suggested",
      email: true,
      sms: false,
      inApp: false,
    },
  ]),
  ...group("customers", "Customers", "customer-activity", "Customer activity", [
    {
      id: "new-customer",
      label: "New customer signup",
      email: false,
      sms: false,
      inApp: true,
    },
    {
      id: "new-review",
      label: "New product review",
      email: true,
      sms: false,
      inApp: true,
    },
    {
      id: "abandoned-cart",
      label: "Abandoned checkout",
      email: true,
      sms: false,
      inApp: false,
    },
    {
      id: "customer-message",
      label: "New customer message",
      email: true,
      sms: false,
      inApp: true,
    },
  ]),
  ...group("system", "System", "account", "Account & security", [
    {
      id: "staff-login",
      label: "New staff device login",
      email: true,
      sms: false,
      inApp: true,
    },
    {
      id: "password-change",
      label: "Password changed",
      email: true,
      sms: false,
      inApp: false,
    },
    {
      id: "billing",
      label: "Billing & invoice updates",
      email: true,
      sms: false,
      inApp: false,
    },
  ]),
  ...group("system", "System", "service", "Service updates", [
    {
      id: "maintenance",
      label: "Scheduled maintenance",
      email: true,
      sms: true,
      inApp: true,
    },
    {
      id: "changelog",
      label: "Product changelog",
      email: false,
      sms: false,
      inApp: true,
    },
  ]),
]

export const NOTIFICATION_PREFS: NotificationPref[] = rows.map((p, i) => ({
  ...p,
  order: i,
}))
