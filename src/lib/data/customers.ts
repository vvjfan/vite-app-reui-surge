import {
  CITIES,
  SEED_NOW,
  SIGNUP_MAX_AGE_DAYS,
  SIGNUP_MIN_AGE_DAYS,
} from "./commerce"
import { CUSTOMER_GROUPS } from "./customer-groups"
import { FACE_AVATARS } from "./avatars"
import { hashString, mulberry32, pick, slugify } from "./seed-utils"
import type { Customer } from "./types"

// Deterministic customer seed. The roster is seeded from its OWN name pool and
// knows nothing about orders: this module must never import orders.ts. Every
// field is derived from a stable hash of the customer's name, so the roster
// reproduces identically and is independent of what anyone bought.
//
// It used to run the other way. The cohort was BUILT by aggregating ORDERS
// (dedupe by order.customer.handle), which made a customer a seed-time
// projection of data embedded in orders. Two things followed. A customer could
// not exist without an order - so an order placed for a new customer could never
// show up on /customers, because the projection had already run. And
// `createdAt` was derived backwards from the customer's FIRST ORDER, which reads
// plausibly and is exactly upside down: you sign up, and then you buy.
//
// Orders now draw their customer FROM this roster (orders.ts imports this
// module, never the reverse), which is the direction the domain actually runs.
//
// Order-based aggregates (orders count, total spent, last order) are NOT stored
// here - they are joined at read time in features/customers/queries.ts.

// ── Name pools ──
//
// These describe PEOPLE, so they live with the people. FIRST_NAMES / LAST_NAMES
// used to sit in orders.ts, where the generator invented a name per order and
// customers.ts read it back off the order - the inversion in miniature.

const FIRST_NAMES = [
  "Jeroen",
  "Amara",
  "Liam",
  "Sofia",
  "Noah",
  "Priya",
  "Mateo",
  "Elena",
  "Kenji",
  "Ava",
  "Omar",
  "Freya",
  "Diego",
  "Ingrid",
  "Tobias",
  "Nadia",
  "Ruben",
  "Chloe",
  "Andre",
  "Yuki",
] as const

const LAST_NAMES = [
  "de Jong",
  "Okafor",
  "Bennett",
  "Rossi",
  "Meyer",
  "Kapoor",
  "Silva",
  "Novak",
  "Tanaka",
  "Walsh",
  "Haddad",
  "Larsen",
  "Moreno",
  "Berg",
  "Fischer",
  "Rahman",
  "Vermeer",
  "Dubois",
  "Costa",
  "Sato",
] as const

/** Full names that are not first/last combinations. */
const SIGNUP_NAMES = [
  "Camila Reyes",
  "Theo Andersson",
  "Aisha Mbeki",
  "Lucas Weber",
  "Mei Ling",
  "Oscar Nilsson",
  "Fatima Al-Rashid",
  "Gabriel Costa",
  "Hana Kim",
  "Isaac Cohen",
  "Leila Haddad",
  "Marco Bianchi",
] as const

const COMPANIES = [
  "Manifest Retail",
  "Atlas Trading Co.",
  "Meridian Supply",
  "Harbor & Co.",
  "Cedar Lane Group",
  "Summit Outfitters",
] as const

/**
 * Roster size. Held at the pre-inversion total (44 order-linked + 12 no-order
 * signups) so /customers stays as populated as it was.
 */
const ROSTER_SIZE = 56

const GROUP_IDS = CUSTOMER_GROUPS.map((group) => group.id)

// Assign groups from independent probability rolls (membership is assigned, not
// derived from behavior). `atRiskEligible` gates the win-back group. It used to
// read order recency for the linked cohort; the roster no longer sees orders, so
// it is now an independent roll like the others. Actual recency lives where it
// belongs - the read-time join in features/customers/queries.ts.
function assignGroups(rng: () => number, atRiskEligible: boolean): string[] {
  const groups: string[] = []
  if (rng() < 0.5) groups.push("newsletter")
  if (rng() < 0.15) groups.push("vip")
  if (rng() < 0.12) groups.push("wholesale")
  if (rng() < 0.18) groups.push("early-access")
  if (atRiskEligible && rng() < 0.5) groups.push("at-risk")
  return groups.filter((id) => GROUP_IDS.includes(id))
}

function phoneFor(rng: () => number): string {
  const area = 200 + Math.floor(rng() * 799)
  const mid = 100 + Math.floor(rng() * 899)
  const last = 1000 + Math.floor(rng() * 8999)
  return `+1 (${area}) ${mid}-${last}`
}

// ── Roster ──

/** Fixed seed for the name draw, so the roster is the same list every run. */
const NAME_SEED = 0x5eed_c0de

/**
 * The full name list: the explicit signup names, topped up to ROSTER_SIZE with
 * seeded first/last combinations. Duplicates are skipped rather than suffixed,
 * so every person is a distinct human before ids are assigned.
 */
function rosterNames(): string[] {
  const rng = mulberry32(NAME_SEED)
  const names: string[] = [...SIGNUP_NAMES]
  const taken = new Set<string>(names)
  while (names.length < ROSTER_SIZE) {
    const name = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`
    if (taken.has(name)) continue
    taken.add(name)
    names.push(name)
  }
  return names
}

function buildCustomer(
  name: string,
  index: number,
  takenIds: Set<string>
): Customer {
  const rng = mulberry32(hashString(`customer:${name}`))

  let id = slugify(name)
  let suffix = 2
  while (takenIds.has(id)) id = `${slugify(name)}-${suffix++}`
  takenIds.add(id)

  const wholesale = rng()
  const groups = assignGroups(rng, rng() < 0.3)
  const company =
    groups.includes("wholesale") || wholesale > 0.85
      ? pick(rng, COMPANIES)
      : undefined

  // Signed up SIGNUP_MIN_AGE_DAYS..SIGNUP_MAX_AGE_DAYS before the seed clock.
  // The floor is what holds "a customer exists before they order": it sits
  // beyond the oldest date the order generator can reach. See commerce.ts.
  const ageDays =
    SIGNUP_MIN_AGE_DAYS +
    Math.floor(rng() * (SIGNUP_MAX_AGE_DAYS - SIGNUP_MIN_AGE_DAYS))
  const createdAt = new Date(SEED_NOW - ageDays * 86_400_000).toISOString()

  const home = pick(rng, CITIES)

  return {
    id,
    name,
    email: `${id.replace(/-/g, ".")}@example.com`,
    avatar: FACE_AVATARS[index % FACE_AVATARS.length],
    phone: rng() > 0.4 ? phoneFor(rng) : undefined,
    company,
    // Guest checkout is real, so not everyone holds an account. This was the one
    // place hasAccount was ever rng-derived; the order-linked cohort simply
    // forced it true, which it no longer can - nothing here knows who ordered.
    hasAccount: rng() > 0.25,
    location: { city: home.city, countryCode: home.countryCode },
    groups,
    createdAt,
  }
}

// ── Assembled seed ──

const TAKEN_IDS = new Set<string>()

export const CUSTOMERS: Customer[] = rosterNames().map((name, index) =>
  buildCustomer(name, index, TAKEN_IDS)
)
