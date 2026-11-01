import { createFileRoute, useRouter } from "@tanstack/react-router"

import { Auth } from "@/features/auth/components/auth"

// Only allow internal paths as a redirect target (guards against open-redirect).
function sanitizeRedirect(url: unknown): string {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) {
    return "/"
  }
  return url
}

// Top-level route (outside `_app`), so the sign-in page renders without the app
// shell. UI only - no auth/session; the `redirect` search param carries where to
// return after signing in.
export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: sanitizeRedirect(search.redirect),
  }),
  component: SignInPage,
})

function SignInPage() {
  const { redirect } = Route.useSearch()
  const router = useRouter()

  return (
    <div className="flex min-h-svh w-full bg-background">
      <Auth onSignIn={() => router.history.push(redirect)} />
    </div>
  )
}
