import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import {
  invoicesRepository,
  notificationPrefsRepository,
  ordersRepository,
  paymentProvidersRepository,
  settingsRepository,
  teamMembersRepository,
  type MemberInput,
} from "@/lib/data/repositories"
import { isCurrentMonth } from "@/features/dashboard/derive"
import {
  BILLING_KEY,
  DEFAULT_BILLING,
  type BillingConfig,
} from "@/lib/data/billing"
import type { NotificationPref } from "@/lib/data/notifications"
import type { PaymentProvider } from "@/lib/data/payments"
import type { Member, MemberRole } from "@/lib/data/team"

// Query keys for settings singletons (store profile, notification prefs,
// payment providers, billing config). Each is stored under a stable string key.
export const settingKeys = {
  all: ["settings"] as const,
  detail: (key: string) => [...settingKeys.all, key] as const,
}

// A singleton setting. The UI reads only from the store: no `initialData`, so
// nothing renders before the DB read resolves (consumers show a loading state).
// `fallback` is returned by the query itself only if the store holds no value.
export function settingQuery<T>(key: string, fallback: T) {
  return queryOptions({
    queryKey: settingKeys.detail(key),
    queryFn: async () => (await settingsRepository.get<T>(key)) ?? fallback,
    staleTime: 0,
  })
}

export function useSetting<T>(key: string, fallback: T) {
  return useQuery(settingQuery(key, fallback))
}

// Persist a singleton. Optimistic: the cache updates immediately and rolls back
// on error, so dependent UI (e.g. the store name in the shell) reflects instantly.
export function useUpdateSetting<T>(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (value: T) => settingsRepository.set<T>(key, value),
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: settingKeys.detail(key) })
      const previous = queryClient.getQueryData<T>(settingKeys.detail(key))
      queryClient.setQueryData<T>(settingKeys.detail(key), value)
      return { previous }
    },
    onError: (_err, _value, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(settingKeys.detail(key), ctx.previous)
      }
      toast.error("Could not save settings", {
        description: "Please try again.",
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: settingKeys.detail(key) })
    },
  })
}

// ── Team members (demo collection: invite / role change / remove persist) ──

export const teamMemberKeys = {
  all: ["team-members"] as const,
  lists: () => [...teamMemberKeys.all, "list"] as const,
}

export const teamMembersQuery = () =>
  queryOptions({
    queryKey: teamMemberKeys.lists(),
    queryFn: () => teamMembersRepository.list(),
    staleTime: 0,
  })

export function useTeamMembers() {
  return useQuery(teamMembersQuery())
}

// Build a full member record from an invite (email + role); the rest defaults.
function buildInvite(email: string, role: MemberRole): MemberInput {
  const handle = email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .trim()
  const name = handle.replace(/\b\w/g, (c) => c.toUpperCase()) || "New Member"
  return {
    name,
    avatar: "",
    email,
    role,
    title: "Invited member",
    scope: "Read",
    teams: [],
    status: "Invited",
    auth: "Password",
    ssoProvider: null,
    twoFactor: null,
    provisioning: "Manual",
    lastActive: "Invite sent",
    lastActiveIso: new Date().toISOString(),
    seatLabel: "Pending seat",
  }
}

export function useInviteMembers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (invites: { email: string; role: MemberRole }[]) =>
      Promise.all(
        invites.map((i) =>
          teamMembersRepository.create(buildInvite(i.email, i.role))
        )
      ),
    onError: () => toast.error("Could not send invitations"),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: teamMemberKeys.all }),
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => teamMembersRepository.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: teamMemberKeys.lists() })
      const previous = queryClient.getQueryData<Member[]>(
        teamMemberKeys.lists()
      )
      queryClient.setQueryData<Member[]>(teamMemberKeys.lists(), (old) =>
        (old ?? []).filter((m) => m.id !== id)
      )
      return { previous }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(teamMemberKeys.lists(), ctx.previous)
      }
      toast.error("Could not remove member")
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: teamMemberKeys.all }),
  })
}

export function useUpdateMembers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (updates: { id: string; patch: Partial<Member> }[]) =>
      Promise.all(
        updates.map((u) => teamMembersRepository.update(u.id, u.patch))
      ),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: teamMemberKeys.lists() })
      const previous = queryClient.getQueryData<Member[]>(
        teamMemberKeys.lists()
      )
      const byId = new Map(updates.map((u) => [u.id, u.patch]))
      queryClient.setQueryData<Member[]>(teamMemberKeys.lists(), (old) =>
        (old ?? []).map((m) =>
          byId.has(m.id) ? { ...m, ...byId.get(m.id) } : m
        )
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(teamMemberKeys.lists(), ctx.previous)
      }
      toast.error("Could not update members")
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: teamMemberKeys.all }),
  })
}

// ── Payment providers (demo collection: connect/disconnect persists) ──

export const providerKeys = {
  all: ["payment-providers"] as const,
  lists: () => [...providerKeys.all, "list"] as const,
}

export const paymentProvidersQuery = () =>
  queryOptions({
    queryKey: providerKeys.lists(),
    queryFn: () => paymentProvidersRepository.list(),
    staleTime: 0,
  })

export function usePaymentProviders() {
  return useQuery(paymentProvidersQuery())
}

export function useUpdateProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<PaymentProvider>
    }) => paymentProvidersRepository.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: providerKeys.lists() })
      const previous = queryClient.getQueryData<PaymentProvider[]>(
        providerKeys.lists()
      )
      queryClient.setQueryData<PaymentProvider[]>(providerKeys.lists(), (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p))
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(providerKeys.lists(), ctx.previous)
      }
      toast.error("Could not update provider")
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: providerKeys.all }),
  })
}

// ── Notification preferences (demo collection: each toggle persists) ──

export const notifPrefKeys = {
  all: ["notification-prefs"] as const,
  lists: () => [...notifPrefKeys.all, "list"] as const,
}

export const notificationPrefsQuery = () =>
  queryOptions({
    queryKey: notifPrefKeys.lists(),
    queryFn: () => notificationPrefsRepository.list(),
    staleTime: 0,
  })

export function useNotificationPrefs() {
  return useQuery(notificationPrefsQuery())
}

export function useUpdateNotificationPref() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<NotificationPref>
    }) => notificationPrefsRepository.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: notifPrefKeys.lists() })
      const previous = queryClient.getQueryData<NotificationPref[]>(
        notifPrefKeys.lists()
      )
      queryClient.setQueryData<NotificationPref[]>(
        notifPrefKeys.lists(),
        (old) => (old ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p))
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(notifPrefKeys.lists(), ctx.previous)
      }
      toast.error("Could not update notifications")
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notifPrefKeys.all }),
  })
}

// ── Billing (invoices collection + config singleton + derived usage) ──

export const invoiceKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceKeys.all, "list"] as const,
}

export const invoicesQuery = () =>
  queryOptions({
    queryKey: invoiceKeys.lists(),
    queryFn: () => invoicesRepository.list(),
    staleTime: 0,
  })

export function useInvoices() {
  return useQuery(invoicesQuery())
}

export function useBilling() {
  return useSetting<BillingConfig>(BILLING_KEY, DEFAULT_BILLING)
}

// Powers the "Orders this month" usage meter. It must count only the CURRENT
// calendar month: it used to count every order ever, which billed the plan's
// monthly quota against the whole order history. Same month helper the
// dashboard KPIs bucket with, so the meter and the tiles agree.
export function useOrdersCount() {
  return useQuery({
    queryKey: ["orders", "count", "current-month"],
    queryFn: async () => {
      const now = new Date()
      const orders = await ordersRepository.list()
      return orders.filter((order) => isCurrentMonth(order.date, now)).length
    },
    staleTime: 0,
  })
}
