import { ensureSeeded, getDb } from "../../db"
import type { AnalyticsRepository } from "../types"

// Demo adapter for the read-only analytics datasets. In the browser it seeds on
// the first read (ensureSeeded), then reads the key/value blobs from the store.
// On the server there is no per-visitor store and so no data: null, the same
// answer a key the store has never held gives. See ./orders.ts.

const isBrowser = typeof window !== "undefined"

export const demoAnalyticsRepository: AnalyticsRepository = {
  async get<T>(key: string): Promise<T | null> {
    if (!isBrowser) return null
    await ensureSeeded()
    const row = await getDb().analytics.get(key)
    return row ? (row.value as T) : null
  },
}
