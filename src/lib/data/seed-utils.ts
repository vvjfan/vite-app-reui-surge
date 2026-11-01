// Shared helpers for the deterministic demo seeds. Every seed in this folder
// derives its data from a fixed PRNG seed rather than Math.random, so the
// dataset is identical across reloads, SSR/client, and test runs.
//
// These lived in duplicate in orders.ts and customers.ts. Two copies of a PRNG
// is not merely repetition: the seeds join to each other, so a tweak to one copy
// silently re-rolls one side of the join and leaves the other where it was.

// ── Seeded PRNG (mulberry32) ──

export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Stable string hash (FNV-1a), so a record can seed its own rng from its id. */
export function hashString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h = Math.imul(h ^ value.charCodeAt(i), 16777619)
  }
  return h >>> 0
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
