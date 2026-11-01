import { ensureSeeded, getDb } from "../../db"
import type { Review } from "../../reviews"
import type { ReviewsRepository } from "../types"

// Demo adapter. In the browser it seeds on the first read (ensureSeeded) and
// reads / writes the in-memory demo store; on the server there is no per-visitor
// store, so reads come back empty. Reviews are not URL-addressed, so the id is
// not a slug: new rows continue the seed's rev-NNNN sequence.

const isBrowser = typeof window !== "undefined"

function reviewId(n: number): string {
  return `rev-${String(n).padStart(4, "0")}`
}

export const demoReviewsRepository: ReviewsRepository = {
  async list() {
    if (!isBrowser) return []
    await ensureSeeded()
    return getDb().reviews.toArray()
  },

  async get(id) {
    if (!isBrowser) return null
    await ensureSeeded()
    return (await getDb().reviews.get(id)) ?? null
  },

  async create(input) {
    const db = getDb()
    let n = (await db.reviews.count()) + 1
    let id = reviewId(n)
    while (await db.reviews.get(id)) id = reviewId(++n)
    const review: Review = { ...input, id }
    await db.reviews.add(review)
    return review
  },

  async update(id, patch) {
    const db = getDb()
    await db.reviews.update(id, patch)
    const next = await db.reviews.get(id)
    if (!next) throw new Error(`Review ${id} not found`)
    return next
  },

  async remove(id) {
    await getDb().reviews.delete(id)
  },
}
