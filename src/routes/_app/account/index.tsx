import { createFileRoute, redirect } from "@tanstack/react-router"

// /account has no page of its own - it lands on the first tab.
export const Route = createFileRoute("/_app/account/")({
  beforeLoad: () => {
    throw redirect({ to: "/account/profile" })
  },
})
