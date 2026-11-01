import type { Repository } from "../types"

// A live adapter that throws until implemented against a real backend. Used by
// the settings collections; set VITE_DATA_MODE unset to use the demo store.
export function notImplementedRepository<T, TInput>(
  name: string
): Repository<T, TInput> {
  const err = async (): Promise<never> => {
    throw new Error(
      `Live ${name} repository is not implemented. Implement src/lib/data/repositories/live or keep VITE_DATA_MODE unset to use the demo store.`
    )
  }
  return { list: err, get: err, create: err, update: err, remove: err }
}
