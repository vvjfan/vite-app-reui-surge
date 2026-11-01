import { toast } from "sonner"
import { Badge } from "@/components/reui/badge"
import { Frame, FramePanel } from "@/components/reui/frame"
import { IconTile } from "@/components/shared/icon-tile"
import { PageHeader } from "@/components/shared/page-header"

import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import {
  usePaymentProviders,
  useUpdateProvider,
} from "@/features/settings/queries"
import type { PaymentProvider, ProviderStatus } from "@/lib/data/payments"
import { PROVIDER_LOGOS, PROVIDER_STATUS_META } from "./data"

// Placeholder row shown while the client reads providers from the store, so no
// seed is rendered before the DB read settles. Mirrors ProviderRow's layout.
function ProviderRowSkeleton() {
  return (
    <Item className="items-center px-3.5 py-2.5 sm:px-4">
      <ItemMedia className="translate-y-0! self-center!">
        <Skeleton className="size-8 rounded-lg" />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-52" />
      </ItemContent>
      <ItemActions className="ml-auto shrink-0">
        <Skeleton className="h-7 w-24" />
      </ItemActions>
    </Item>
  )
}

function ProviderRow({
  provider,
  onToggle,
  disabled,
}: {
  provider: PaymentProvider
  onToggle: () => void
  disabled: boolean
}) {
  const meta = PROVIDER_STATUS_META[provider.status]
  const connected = provider.status === "connected"

  return (
    <Item role="listitem" className="items-center px-3.5 py-2.5 sm:px-4">
      <ItemMedia className="translate-y-0! self-center!">
        <IconTile>{PROVIDER_LOGOS[provider.id]}</IconTile>
      </ItemMedia>

      <ItemContent className="min-w-0 gap-0">
        <ItemTitle className="w-full min-w-0 gap-2">
          <span className="truncate">{provider.name}</span>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </ItemTitle>
        <ItemDescription className="line-clamp-1">
          {provider.description}
        </ItemDescription>
      </ItemContent>

      <ItemActions className="ml-auto shrink-0 justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onToggle}
        >
          {connected ? "Disconnect" : "Connect"}
        </Button>
      </ItemActions>
    </Item>
  )
}

// Payments settings: checkout providers seeded into the demo `paymentProviders`
// store and queried; connect/disconnect updates the record and persists.
export function PaymentSettings() {
  const providersQuery = usePaymentProviders()
  const providers = providersQuery.data ?? []
  const updateProvider = useUpdateProvider()

  function toggle(provider: PaymentProvider) {
    const next: ProviderStatus =
      provider.status === "connected" ? "available" : "connected"
    updateProvider.mutate(
      { id: provider.id, patch: { status: next } },
      {
        onSuccess: () =>
          next === "connected"
            ? toast.success(`${provider.name} connected`)
            : toast.message(`${provider.name} disconnected`),
      }
    )
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        title="Payments"
        actions={
          <Button
            type="button"
            className="shrink-0"
            onClick={() =>
              toast.info("Add provider", {
                description: "Browse the provider directory. Demo only.",
              })
            }
          >
            Add provider
          </Button>
        }
      />
      <section className="flex flex-col gap-3">
        <Frame dense>
          <FramePanel className="p-0!">
            <ItemGroup className="gap-0">
              {providersQuery.isPending
                ? Array.from({ length: 6 }).map((_, index) => (
                    <div key={index}>
                      {index > 0 ? <ItemSeparator className="my-0" /> : null}
                      <ProviderRowSkeleton />
                    </div>
                  ))
                : providers.map((provider, index) => (
                    <div key={provider.id}>
                      {index > 0 ? <ItemSeparator className="my-0" /> : null}
                      <ProviderRow
                        provider={provider}
                        onToggle={() => toggle(provider)}
                        disabled={updateProvider.isPending}
                      />
                    </div>
                  ))}
            </ItemGroup>
          </FramePanel>
        </Frame>
      </section>
    </div>
  )
}
