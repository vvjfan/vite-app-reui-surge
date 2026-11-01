import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router"

import { PageHeader } from "@/components/shared/page-header"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Master layout for the personal-account area. The sub-pages (Profile,
// Preferences, Security) keep their content verbatim; this layout owns the one
// page title and the tab bar. The tabs ARE the route navigation - each is a Link
// with its own URL, so it deep-links, middle-clicks, and shows in history. A
// single stable "Account" title (rather than one echoing the active tab) keeps
// the header consistent with every other page and free of a redundant subtitle.
//
// Everything here is about the PERSON signed in. What the store runs on - team,
// payments, billing, locations - is System > Settings, a different area.
const ACCOUNT_TABS = [
  { value: "profile", label: "Profile", to: "/account/profile" },
  { value: "preferences", label: "Preferences", to: "/account/preferences" },
  { value: "security", label: "Security", to: "/account/security" },
] as const

export const Route = createFileRoute("/_app/account")({
  staticData: { crumb: "Account" },
  component: AccountLayout,
})

function AccountLayout() {
  const { pathname } = useLocation()
  const active =
    ACCOUNT_TABS.find((tab) => pathname.startsWith(tab.to)) ?? ACCOUNT_TABS[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <PageHeader title="Account" />
        <Tabs value={active.value}>
          <TabsList variant="line">
            {ACCOUNT_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                nativeButton={false}
                render={<Link to={tab.to} />}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <Outlet />
    </div>
  )
}
