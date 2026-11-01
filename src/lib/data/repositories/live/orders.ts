import type { OrdersRepository } from "../types"

// LIVE adapter template. Implement each method against YOUR backend, then set
// VITE_DATA_MODE=live (see .env.example) to switch every Orders page over with
// no component changes. The demo adapter (../demo/orders) is a working reference
// for the exact return shapes.
//
// Example, fetch against a REST API base URL:
//
//   const base = import.meta.env.VITE_API_URL
//   const json = (r: Response) => { if (!r.ok) throw new Error(r.statusText); return r.json() }
//
//   export const liveOrdersRepository: OrdersRepository = {
//     list:   () => fetch(`${base}/orders`).then(json),
//     get:    (id) => fetch(`${base}/orders/${id}`).then(json),
//     create: (input) => fetch(`${base}/orders`, { method: "POST", body: JSON.stringify(input) }).then(json),
//     update: (id, patch) => fetch(`${base}/orders/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then(json),
//     remove: (id) => fetch(`${base}/orders/${id}`, { method: "DELETE" }).then(() => undefined),
//     transition: (id, action) => fetch(`${base}/orders/${id}/${action}`, { method: "POST" }).then(json),
//   }
//
// You can also delegate to a TanStack Start server function (createServerFn) that
// talks to your database directly. See docs/DATA-LAYER.md.
//
// THE LIFECYCLE CONTRACT, which is the one part of this file that is not just
// plumbing:
//
//   1. `transition` maps 1:1 onto your own verbs - your cancel endpoint, your
//      fulfillments endpoint, your refunds endpoint. It is one method taking an
//      action rather than three methods so this mapping stays mechanical.
//   2. `update` must REJECT a patch touching status / payment / fulfillment.
//      Those axes move only through `transition`, or a caller can write an
//      illegal state straight past the rules.
//   3. YOUR BACKEND OWNS THE RULES. src/lib/data/order-lifecycle.ts exists so
//      the UI does not OFFER an action that would be refused - it greys out
//      Cancel on a shipped order and Delete on one that still carries revenue.
//      It is not a security boundary and your API must still refuse for itself.
//      If your rules differ from it, edit that module to match them, or the UI
//      will keep offering actions your API rejects.

const NOT_IMPLEMENTED =
  "Live orders repository is not implemented. Fill in src/lib/data/repositories/live/orders.ts or keep VITE_DATA_MODE unset to use the demo store."

export const liveOrdersRepository: OrdersRepository = {
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
  transition: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
  remove: async () => {
    throw new Error(NOT_IMPLEMENTED)
  },
}
