import type { ComponentType, ReactNode } from "react"
import {
  SquaresFourIcon as LayoutDashboardIcon,
  UsersIcon,
  BagIcon as ShoppingBagIcon,
  TagIcon,
  StackIcon as BoxesIcon,
  TreeStructureIcon as FolderTreeIcon,
  TicketIcon as TicketPercentIcon,
  StarIcon,
  ChartBarIcon as ChartColumnIcon,
  GearIcon as SettingsIcon,
  ClipboardTextIcon as ClipboardListIcon,
  PackageIcon as PackagePlusIcon,
  ScrollIcon as ScrollTextIcon,
  StorefrontIcon as StoreIcon,
  UsersIcon as UsersRoundIcon,
  CreditCardIcon,
  BellIcon,
  ReceiptIcon,
  MapPinIcon,
  TruckIcon,
} from "@phosphor-icons/react"

// ── Types ──

export type NavChild = {
  id: string
  label: string
  href: string
  icon: ReactNode
}

export type NavItem = {
  id: string
  label: string
  icon: ReactNode
  href?: string
  badge?: string | number
  children?: NavChild[]
}

export type NavGroup = {
  id: string
  label: string
  items: NavItem[]
}

export type Workspace = {
  id: string
  name: string
  tier: string
  Logo: ComponentType<{ className?: string }>
}

export type NewsArticle = {
  href: string
  title: string
  summary: string
  image: string
}

// ── Logos ──

// Acme: indigo → violet → fuchsia diagonal sweep
function AcmeLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="ws-acme"
          x1="0"
          y1="0"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="35%" stopColor="#7c3aed" />
          <stop offset="70%" stopColor="#a21caf" />
          <stop offset="100%" stopColor="#db2777" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="14" fill="url(#ws-acme)" />
    </svg>
  )
}

// Starter: rose → orange → amber → lime horizontal sweep
function StarterLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="ws-starter"
          x1="0"
          y1="0"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="33%" stopColor="#f97316" />
          <stop offset="66%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#84cc16" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="14" fill="url(#ws-starter)" />
    </svg>
  )
}

// Enterprise: sky → blue → indigo vertical sweep
function EnterpriseLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="ws-enterprise"
          x1="0"
          y1="0"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="35%" stopColor="#3b82f6" />
          <stop offset="70%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="14" fill="url(#ws-enterprise)" />
    </svg>
  )
}

// ── Data ──

export const USER = {
  name: "Nick Bold",
  email: "nick@reui.io",
  initials: "NB",
  avatar:
    "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
} as const

export const WORKSPACES: Workspace[] = [
  {
    id: "manifest",
    name: "Manifest Store",
    tier: "Enterprise",
    Logo: AcmeLogo,
  },
  { id: "outlet", name: "Manifest Outlet", tier: "Basic", Logo: StarterLogo },
  {
    id: "wholesale",
    name: "Manifest Wholesale",
    tier: "B2B",
    Logo: EnterpriseLogo,
  },
]

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "store",
    label: "Store",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: "/",
        icon: <LayoutDashboardIcon aria-hidden="true" />,
      },
      {
        id: "orders",
        label: "Orders",
        href: "/orders",
        icon: <ShoppingBagIcon aria-hidden="true" />,
      },
      {
        id: "products",
        label: "Products",
        href: "/products",
        icon: <TagIcon aria-hidden="true" />,
      },
      {
        id: "inventory",
        label: "Inventory",
        icon: <BoxesIcon aria-hidden="true" />,
        children: [
          {
            id: "inv-stock",
            label: "Stock ledger",
            href: "/inventory",
            icon: <ClipboardListIcon aria-hidden="true" />,
          },
          {
            id: "inv-reorder",
            label: "Reorder queue",
            href: "/inventory/reorder",
            icon: <PackagePlusIcon aria-hidden="true" />,
          },
          {
            id: "inv-purchase-orders",
            label: "Purchase orders",
            href: "/inventory/purchase-orders",
            icon: <ScrollTextIcon aria-hidden="true" />,
          },
        ],
      },
      {
        id: "customers",
        label: "Customers",
        icon: <UsersIcon aria-hidden="true" />,
        children: [
          {
            id: "customers-all",
            label: "All customers",
            href: "/customers",
            icon: <UsersIcon aria-hidden="true" />,
          },
          {
            id: "customer-groups",
            label: "Groups",
            href: "/customers/groups",
            icon: <UsersRoundIcon aria-hidden="true" />,
          },
        ],
      },
      {
        id: "categories",
        label: "Categories",
        href: "/categories",
        icon: <FolderTreeIcon aria-hidden="true" />,
      },
      {
        id: "promotions",
        label: "Promotions",
        href: "/promotions",
        icon: <TicketPercentIcon aria-hidden="true" />,
      },
      {
        id: "reviews",
        label: "Reviews",
        href: "/reviews",
        icon: <StarIcon aria-hidden="true" />,
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      {
        id: "analytics",
        label: "Analytics",
        href: "/analytics",
        icon: <ChartColumnIcon aria-hidden="true" />,
      },
      {
        id: "settings",
        label: "Settings",
        icon: <SettingsIcon aria-hidden="true" />,
        children: [
          {
            id: "set-general",
            label: "General",
            href: "/settings",
            icon: <StoreIcon aria-hidden="true" />,
          },
          {
            id: "set-team",
            label: "Team",
            href: "/settings/team",
            icon: <UsersRoundIcon aria-hidden="true" />,
          },
          {
            id: "set-payments",
            label: "Payments",
            href: "/settings/payments",
            icon: <CreditCardIcon aria-hidden="true" />,
          },
          {
            id: "set-notifications",
            label: "Notifications",
            href: "/settings/notifications",
            icon: <BellIcon aria-hidden="true" />,
          },
          {
            id: "set-billing",
            label: "Billing",
            href: "/settings/billing",
            icon: <ReceiptIcon aria-hidden="true" />,
          },
          {
            id: "set-locations",
            label: "Locations",
            href: "/settings/locations",
            icon: <MapPinIcon aria-hidden="true" />,
          },
          {
            id: "set-suppliers",
            label: "Suppliers",
            href: "/settings/suppliers",
            icon: <TruckIcon aria-hidden="true" />,
          },
        ],
      },
    ],
  },
]

// Every top-level nav area, flattened in group order. Active-state resolution
// and the breadcrumb section switcher work across the whole tree, so they read
// this rather than the groups.
export const NAV_MAIN: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    href: "https://pro.reui.io/changelog?v=2.0.3",
    title: "Multi-theme support is here",
    summary:
      "Switch between Vega, Nova, Maia, Lyra, and Mira themes across all components.",
    image:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=225&fit=crop&q=80",
  },
  {
    href: "https://pro.reui.io/changelog?v=2.0.2",
    title: "Icon library v2 released",
    summary:
      "Five icon libraries unified under a single API with automatic mapping.",
    image:
      "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&h=225&fit=crop&q=80",
  },
  {
    href: "https://pro.reui.io/changelog?v=2.0.1",
    title: "Sidebar layout patterns guide",
    summary:
      "Learn best practices for building responsive sidebar layouts with collapsible navigation.",
    image:
      "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&h=225&fit=crop&q=80",
  },
]
