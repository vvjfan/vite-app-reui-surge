import type { ReviewsRepository } from "../types"

// LIVE adapter template. Implement each method against your backend, then set
// VITE_DATA_MODE=live. The demo adapter (../demo/reviews) is a working
// reference for the exact return shapes.
//
// Moderation maps to a status update, which a backend typically exposes as a
// bulk POST /admin/reviews/status { ids, status }, so a real implementation can
// fan the per-row update() calls into one request if it prefers.

const NOT_IMPLEMENTED =
  "Live reviews repository is not implemented. Fill in src/lib/data/repositories/live/reviews.ts or keep VITE_DATA_MODE unset to use the demo store."

export const liveReviewsRepository: ReviewsRepository = {
  list: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
  get: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
  create: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
  update: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
  remove: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
}
