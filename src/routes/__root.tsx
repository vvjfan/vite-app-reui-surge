import { Outlet, createRootRoute } from "@tanstack/react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouteProgress } from "@/components/route-progress"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getQueryClient } from "@/lib/query/query-client"

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
      <a href="/" className="underline">
        Return to dashboard
      </a>
    </main>
  ),
})

function RootLayout() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <RouteProgress />
      <TooltipProvider>
        <Outlet />
      </TooltipProvider>
      <Toaster position="top-center" />
    </QueryClientProvider>
  )
}
