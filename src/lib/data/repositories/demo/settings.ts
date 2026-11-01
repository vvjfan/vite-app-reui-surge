import { ensureSeeded, getDb } from "../../db"
import type { SettingsRepository } from "../types"

// Demo adapter for settings singletons. Settings live only in the browser (the
// in-memory demo store, for the session); on the server get() returns null so
// the feature renders its default, and the client seeds on the first read
// (ensureSeeded) then reads any saved value from the store after hydration.

const isBrowser = typeof window !== "undefined"

export const demoSettingsRepository: SettingsRepository = {
  async get<T>(key: string): Promise<T | null> {
    if (!isBrowser) return null
    await ensureSeeded()
    const row = await getDb().settings.get(key)
    return row ? (row.value as T) : null
  },

  async set<T>(key: string, value: T): Promise<T> {
    await getDb().settings.put({ key, value })
    return value
  },
}
