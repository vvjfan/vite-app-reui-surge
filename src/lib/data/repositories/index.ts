import { demoAnalyticsRepository } from "./demo/analytics"
import { demoCategoriesRepository } from "./demo/categories"
import { demoCustomerGroupsRepository } from "./demo/customer-groups"
import { demoCustomersRepository } from "./demo/customers"
import { demoInventoryRepository } from "./demo/inventory"
import { demoInvoicesRepository } from "./demo/invoices"
import { demoLocationsRepository } from "./demo/locations"
import { demoNotificationPrefsRepository } from "./demo/notifications"
import { demoOrdersRepository } from "./demo/orders"
import { demoPaymentProvidersRepository } from "./demo/payments"
import { demoProductsRepository } from "./demo/products"
import { demoPromotionsRepository } from "./demo/promotions"
import { demoPurchaseOrdersRepository } from "./demo/purchase-orders"
import { demoReviewsRepository } from "./demo/reviews"
import { demoSuppliersRepository } from "./demo/suppliers"
import { demoSettingsRepository } from "./demo/settings"
import { demoTeamMembersRepository } from "./demo/team"
import { liveAnalyticsRepository } from "./live/analytics"
import { liveCategoriesRepository } from "./live/categories"
import { liveCustomerGroupsRepository } from "./live/customer-groups"
import { liveCustomersRepository } from "./live/customers"
import { liveInventoryRepository } from "./live/inventory"
import { liveInvoicesRepository } from "./live/invoices"
import { liveLocationsRepository } from "./live/locations"
import { liveNotificationPrefsRepository } from "./live/notifications"
import { liveOrdersRepository } from "./live/orders"
import { livePaymentProvidersRepository } from "./live/payments"
import { liveProductsRepository } from "./live/products"
import { livePromotionsRepository } from "./live/promotions"
import { livePurchaseOrdersRepository } from "./live/purchase-orders"
import { liveReviewsRepository } from "./live/reviews"
import { liveSuppliersRepository } from "./live/suppliers"
import { liveSettingsRepository } from "./live/settings"
import { liveTeamMembersRepository } from "./live/team"
import type {
  AnalyticsRepository,
  CategoriesRepository,
  CustomerGroupsRepository,
  CustomersRepository,
  InventoryRepository,
  InvoicesRepository,
  LocationsRepository,
  NotificationPrefsRepository,
  OrdersRepository,
  PaymentProvidersRepository,
  ProductsRepository,
  PromotionsRepository,
  PurchaseOrdersRepository,
  ReviewsRepository,
  SettingsRepository,
  SuppliersRepository,
  TeamMembersRepository,
} from "./types"

// ── The single swap point ──
//
// `demo` (default) uses the in-memory browser store seeded from mock data.
// `live` uses the adapters in ./live, which you implement against your backend.
// Flip by setting VITE_DATA_MODE=live in .env.local. Nothing else changes:
// every page consumes these two exports through TanStack Query.

const MODE: "demo" | "live" =
  import.meta.env.VITE_DATA_MODE === "live" ? "live" : "demo"

/**
 * True when the store is the in-memory browser demo.
 *
 * For affordances that only make sense against it - loading the sample dataset,
 * clearing it back to empty - and nothing else. A page must never branch on this
 * to decide what to RENDER: that would make demo mode a different product from
 * the one you ship, which is the whole thing the seam exists to prevent.
 */
export const isDemoMode = MODE === "demo"

export const ordersRepository: OrdersRepository =
  MODE === "live" ? liveOrdersRepository : demoOrdersRepository

export const productsRepository: ProductsRepository =
  MODE === "live" ? liveProductsRepository : demoProductsRepository

export const settingsRepository: SettingsRepository =
  MODE === "live" ? liveSettingsRepository : demoSettingsRepository

export const teamMembersRepository: TeamMembersRepository =
  MODE === "live" ? liveTeamMembersRepository : demoTeamMembersRepository

export const paymentProvidersRepository: PaymentProvidersRepository =
  MODE === "live"
    ? livePaymentProvidersRepository
    : demoPaymentProvidersRepository

export const notificationPrefsRepository: NotificationPrefsRepository =
  MODE === "live"
    ? liveNotificationPrefsRepository
    : demoNotificationPrefsRepository

export const invoicesRepository: InvoicesRepository =
  MODE === "live" ? liveInvoicesRepository : demoInvoicesRepository

export const inventoryRepository: InventoryRepository =
  MODE === "live" ? liveInventoryRepository : demoInventoryRepository

export const analyticsRepository: AnalyticsRepository =
  MODE === "live" ? liveAnalyticsRepository : demoAnalyticsRepository

export const locationsRepository: LocationsRepository =
  MODE === "live" ? liveLocationsRepository : demoLocationsRepository

export const customersRepository: CustomersRepository =
  MODE === "live" ? liveCustomersRepository : demoCustomersRepository

export const customerGroupsRepository: CustomerGroupsRepository =
  MODE === "live" ? liveCustomerGroupsRepository : demoCustomerGroupsRepository

export const categoriesRepository: CategoriesRepository =
  MODE === "live" ? liveCategoriesRepository : demoCategoriesRepository

export const promotionsRepository: PromotionsRepository =
  MODE === "live" ? livePromotionsRepository : demoPromotionsRepository

export const suppliersRepository: SuppliersRepository =
  MODE === "live" ? liveSuppliersRepository : demoSuppliersRepository

export const reviewsRepository: ReviewsRepository =
  MODE === "live" ? liveReviewsRepository : demoReviewsRepository

export const purchaseOrdersRepository: PurchaseOrdersRepository =
  MODE === "live" ? livePurchaseOrdersRepository : demoPurchaseOrdersRepository

export type {
  AnalyticsRepository,
  CategoriesRepository,
  CategoryInput,
  CustomersRepository,
  CustomerGroupsRepository,
  CustomerInput,
  CustomerGroupInput,
  InventoryRepository,
  InventoryInput,
  LocationsRepository,
  LocationInput,
  OrdersRepository,
  ProductsRepository,
  PromotionsRepository,
  PromotionInput,
  ReviewsRepository,
  ReviewInput,
  SuppliersRepository,
  SupplierInput,
  SettingsRepository,
  TeamMembersRepository,
  PaymentProvidersRepository,
  NotificationPrefsRepository,
  InvoicesRepository,
  OrderInput,
  ProductInput,
  MemberInput,
} from "./types"
