import { QueryClient } from "@tanstack/react-query"

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

// One fresh client per server request (never shared across requests); a single
// browser client so the cache survives client-side navigations.
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}
