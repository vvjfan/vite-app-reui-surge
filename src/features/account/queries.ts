import {
  ACCOUNT_PREFERENCES_KEY,
  ACCOUNT_PROFILE_KEY,
  ACCOUNT_SECURITY_KEY,
  DEFAULT_ACCOUNT_PREFERENCES,
  DEFAULT_ACCOUNT_PROFILE,
  DEFAULT_ACCOUNT_SECURITY,
  type AccountPreferences,
  type AccountProfile,
  type AccountSecurity,
} from "@/lib/data/account"
import { useSetting, useUpdateSetting } from "@/features/settings/queries"

// The account profile and preferences are settings singletons, so these are the
// generic singleton hooks bound to their keys and defaults — same pattern as
// useBilling. The default is the query fallback: it is returned only when the
// store holds no saved value, never as react-query initialData, so consumers
// still render a loading state until the read settles.

export function useAccountProfile() {
  return useSetting<AccountProfile>(
    ACCOUNT_PROFILE_KEY,
    DEFAULT_ACCOUNT_PROFILE
  )
}

export function useUpdateAccountProfile() {
  return useUpdateSetting<AccountProfile>(ACCOUNT_PROFILE_KEY)
}

export function useAccountPreferences() {
  return useSetting<AccountPreferences>(
    ACCOUNT_PREFERENCES_KEY,
    DEFAULT_ACCOUNT_PREFERENCES
  )
}

export function useUpdateAccountPreferences() {
  return useUpdateSetting<AccountPreferences>(ACCOUNT_PREFERENCES_KEY)
}

export function useAccountSecurity() {
  return useSetting<AccountSecurity>(
    ACCOUNT_SECURITY_KEY,
    DEFAULT_ACCOUNT_SECURITY
  )
}

export function useUpdateAccountSecurity() {
  return useUpdateSetting<AccountSecurity>(ACCOUNT_SECURITY_KEY)
}
