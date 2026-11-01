import { slugify } from "./seed-utils"
// Product reviews: one row per review with a moderation status (pending /
// approved / rejected), a 1-5 rating, a denormalized reviewer name and an
// optional link to a real Customer. Only approved reviews count toward a
// product's average rating.
//
// Reviews are seeded to simulate storefront submissions: the admin moderates
// them, it never authors them.

export type ReviewStatus = "pending" | "approved" | "rejected"
export type RatingValue = 1 | 2 | 3 | 4 | 5

export interface Review {
  /** Stable seed id. Reviews are not URL-addressed, so this is not a slug. */
  id: string
  /** Foreign key to Product.id (a slug, e.g. "boxy-pocket-tee"). */
  productId: string
  rating: number
  title: string
  content: string
  authorName: string
  authorEmail: string
  /** Foreign key to Customer.id (a handle) or null for a guest reviewer. */
  customerId: string | null
  status: ReviewStatus
  /** ISO 8601. */
  createdAt: string
}

type Author = Pick<Review, "authorName" | "authorEmail" | "customerId">

// A registered customer: the handle and email are derived exactly the way the
// customers seed derives them, so customerId always resolves to a real Customer.
function linked(name: string): Author {
  const id = slugify(name)
  return {
    authorName: name,
    authorEmail: `${id.replace(/-/g, ".")}@example.com`,
    customerId: id,
  }
}

// A guest reviewer: no account, so no customerId.
function guest(name: string, email: string): Author {
  return { authorName: name, authorEmail: email, customerId: null }
}

// A fixed base date keeps createdAt deterministic (no Date.now()).
const REVIEW_BASE_MS = new Date("2026-07-16T12:00:00.000Z").getTime()
const DAY_MS = 86_400_000

type ReviewRow = Omit<Review, "id">

function row(
  productId: string,
  rating: number,
  title: string,
  content: string,
  author: Author,
  status: ReviewStatus,
  daysAgo: number
): ReviewRow {
  return {
    productId,
    rating,
    title,
    content,
    ...author,
    status,
    createdAt: new Date(REVIEW_BASE_MS - daysAgo * DAY_MS).toISOString(),
  }
}

const ROWS: ReviewRow[] = [
  // Apparel
  row(
    "boxy-pocket-tee",
    5,
    "Perfect everyday tee",
    "The cotton is thick without being heavy and it has kept its shape after a dozen washes. Buying two more.",
    linked("Camila Reyes"),
    "approved",
    3
  ),
  row(
    "boxy-pocket-tee",
    4,
    "Great fit, runs slightly large",
    "Lovely boxy cut as advertised. I would size down if you want a closer fit through the shoulders.",
    linked("Theo Andersson"),
    "approved",
    9
  ),
  row(
    "boxy-pocket-tee",
    2,
    "Shrank in the wash",
    "Fabric feels nice but it lost almost an inch of length after a warm wash. Follow the cold-wash label.",
    guest("Priya N.", "priya.n@example.com"),
    "pending",
    1
  ),
  row(
    "pima-cotton-crewneck",
    5,
    "Softest knit I own",
    "The pima cotton is genuinely a step up. Drapes well and no pilling after a month of regular wear.",
    linked("Aisha Mbeki"),
    "approved",
    14
  ),
  row(
    "pima-cotton-crewneck",
    4,
    "Lovely but pricey",
    "Quality is there. I just wish it came in more colours for the price.",
    guest("Daniel R.", "daniel.r@example.com"),
    "approved",
    21
  ),
  row(
    "linen-camp-shirt",
    5,
    "Ideal for hot weather",
    "Breathes brilliantly on 30 degree days and the camp collar sits flat. It wrinkles, but that is linen.",
    linked("Marco Bianchi"),
    "approved",
    6
  ),
  row(
    "linen-camp-shirt",
    3,
    "More sheer than expected",
    "Nice cut but you can see through it in bright light. Fine worn over a vest.",
    guest("Emma L.", "emma.l@example.com"),
    "pending",
    2
  ),
  row(
    "recycled-wool-overshirt",
    5,
    "Warm without the bulk",
    "Wearing it as a light jacket through autumn. The recycled wool has a great texture.",
    linked("Lucas Weber"),
    "approved",
    11
  ),

  // Footwear
  row(
    "trail-runner-gtx",
    5,
    "Kept my feet dry",
    "Twenty kilometres in steady rain and the lining held up. Grip on wet rock is excellent.",
    linked("Oscar Nilsson"),
    "approved",
    5
  ),
  row(
    "trail-runner-gtx",
    4,
    "Great grip, narrow toe box",
    "Superb traction. Runners with wide feet should size up half.",
    guest("Tom H.", "tom.h@example.com"),
    "approved",
    17
  ),
  row(
    "trail-runner-gtx",
    1,
    "Sole separated after a month",
    "Really disappointed. The outsole started peeling at the toe within five runs.",
    guest("Nathan Pryce", "nathan.pryce@example.com"),
    "pending",
    1
  ),
  row(
    "linen-low-top-sneaker",
    4,
    "Summer staple",
    "Light and breathable. The linen upper marks easily so keep them off wet grass.",
    linked("Mei Ling"),
    "approved",
    8
  ),
  row(
    "wave-strike-boost-sneaker",
    5,
    "Bouncy and comfortable",
    "The midsole makes long days on my feet painless. True to size.",
    linked("Gabriel Costa"),
    "approved",
    12
  ),
  row(
    "wave-strike-boost-sneaker",
    3,
    "Loud colourway",
    "Comfort is great but the red is much brighter in person than in the photos.",
    guest("Sam K.", "sam.k@example.com"),
    "approved",
    25
  ),
  row(
    "suede-chukka-boot",
    5,
    "Beautiful suede",
    "The nap is even and rich. Wore them straight out of the box with no break-in.",
    linked("Isaac Cohen"),
    "approved",
    19
  ),
  row(
    "suede-chukka-boot",
    2,
    "Suede stained instantly",
    "One light rain shower and they are blotchy. Protect them before wearing.",
    guest("Nora P.", "nora.p@example.com"),
    "pending",
    4
  ),

  // Outerwear
  row(
    "quilted-field-jacket",
    5,
    "Perfect autumn layer",
    "Roomy enough for a jumper underneath and the quilting is not too puffy.",
    linked("Hana Kim"),
    "approved",
    7
  ),
  row(
    "alpine-down-vest",
    4,
    "Warm core, thin arms",
    "Does exactly what a vest should. Packs down tiny into its own pocket.",
    linked("Fatima Al-Rashid"),
    "approved",
    15
  ),
  row(
    "alpine-down-vest",
    5,
    "Packs into nothing",
    "Lives in my bag permanently. Surprisingly warm for the weight.",
    guest("Jonas B.", "jonas.b@example.com"),
    "pending",
    2
  ),
  row(
    "storm-shell-parka",
    5,
    "Genuinely waterproof",
    "Taped seams and a proper storm flap. Wore it through a downpour and stayed dry.",
    linked("Leila Haddad"),
    "approved",
    22
  ),
  row(
    "storm-shell-parka",
    3,
    "Runs very large",
    "Great shell but the fit is enormous. Size down at least one.",
    guest("Chris D.", "chris.d@example.com"),
    "approved",
    30
  ),
  row(
    "merino-zip-cardigan",
    4,
    "Soft merino, slow delivery",
    "The cardigan itself is lovely. Shipping took two weeks longer than promised.",
    linked("Camila Reyes"),
    "approved",
    27
  ),

  // Bags
  row(
    "everyday-tote",
    5,
    "Holds everything",
    "Laptop, gym kit and shopping all fit. The base is reinforced which I appreciate.",
    linked("Mei Ling"),
    "approved",
    10
  ),
  row(
    "everyday-tote",
    4,
    "Wish it had a zip",
    "Great size and canvas quality but an open top makes me nervous on the train.",
    guest("Ruth A.", "ruth.a@example.com"),
    "approved",
    18
  ),
  row(
    "canvas-weekender",
    5,
    "Ideal carry-on",
    "Fits under the seat and the leather trim is ageing nicely.",
    linked("Marco Bianchi"),
    "approved",
    23
  ),
  row(
    "commuter-backpack",
    4,
    "Good commuter, thin straps",
    "The padded laptop sleeve is excellent. Straps could use more padding when loaded.",
    linked("Theo Andersson"),
    "approved",
    13
  ),
  row(
    "commuter-backpack",
    2,
    "Zip broke in week two",
    "The main zip pull snapped off. The rest of the bag seems well made, which makes it more annoying.",
    guest("Victor M.", "victor.m@example.com"),
    "pending",
    3
  ),
  row(
    "leather-duffle",
    5,
    "Heirloom quality",
    "Heavy, beautiful, and the leather already has a patina. Worth every penny.",
    linked("Isaac Cohen"),
    "approved",
    29
  ),

  // Accessories
  row(
    "merino-ribbed-beanie",
    5,
    "Warm and not itchy",
    "Merino makes all the difference. No itch at all and it holds its shape.",
    linked("Oscar Nilsson"),
    "approved",
    16
  ),
  row(
    "leather-card-holder",
    4,
    "Slim and smart",
    "Holds four cards and a folded note. Slightly tight at first, then loosens up.",
    linked("Gabriel Costa"),
    "approved",
    20
  ),
  row(
    "waxed-cotton-cap",
    3,
    "Stiff at first",
    "Takes a while to break in and the wax smell lingers for about a week.",
    guest("Ali S.", "ali.s@example.com"),
    "approved",
    26
  ),
  row(
    "silk-blend-scarf",
    5,
    "Gorgeous drape",
    "The colours are richer in person. Feels far more expensive than it was.",
    linked("Hana Kim"),
    "approved",
    24
  ),
  row(
    "silk-blend-scarf",
    1,
    "Arrived with a pull",
    "There was a visible snag along one edge straight out of the packet. Poor quality control.",
    guest("Helen T.", "helen.t@example.com"),
    "pending",
    1
  ),

  // Activewear
  row(
    "compression-long-sleeve",
    4,
    "Great for cold runs",
    "Holds heat without overheating. The thumb holes are a nice touch.",
    linked("Lucas Weber"),
    "approved",
    9
  ),
  row(
    "seamless-training-tee",
    5,
    "No chafing at all",
    "Seamless really does what it says. Twelve kilometres and zero rubbing.",
    linked("Aisha Mbeki"),
    "approved",
    12
  ),
  row(
    "featherlight-running-short",
    4,
    "Light and quick drying",
    "I barely notice I am wearing them and the liner is comfortable.",
    guest("Kofi A.", "kofi.a@example.com"),
    "approved",
    28
  ),
  row(
    "performance-track-pant",
    3,
    "Fit is odd at the ankle",
    "Comfortable through the thigh but the ankle cuff is too tight over trainers.",
    linked("Fatima Al-Rashid"),
    "pending",
    5
  ),

  // Denim
  row(
    "selvedge-slim-denim",
    5,
    "Proper selvedge",
    "Rigid at first exactly as it should be. Fading beautifully after two months.",
    linked("Leila Haddad"),
    "approved",
    31
  ),
  row(
    "denim-trucker-jacket",
    4,
    "Classic cut",
    "Sits right at the waist. I would like a slightly longer sleeve.",
    guest("Pete W.", "pete.w@example.com"),
    "approved",
    33
  ),
  row(
    "relaxed-straight-jean",
    5,
    "Best fit I have found",
    "Roomy without looking baggy. Ordered a second pair in black.",
    linked("Camila Reyes"),
    "approved",
    35
  ),

  // Moderated away: spam, junk and abuse. These keep the rejected filter honest.
  row(
    "boxy-pocket-tee",
    1,
    "BEST DEALS AT CHEAPTEES",
    "Buy cheaper here! Visit our site for 90 percent off designer clothing, limited time offer.",
    guest("Deals Bot", "promo@spam.example"),
    "rejected",
    6
  ),
  row(
    "trail-runner-gtx",
    5,
    "asdfasdf",
    "asdf asdf asdf test test test",
    guest("Test User", "test@test.example"),
    "rejected",
    8
  ),
  row(
    "everyday-tote",
    1,
    "Removed by a moderator",
    "This review contained abusive language directed at a support agent and was removed.",
    guest("Anonymous", "anon@example.com"),
    "rejected",
    14
  ),
  row(
    "silk-blend-scarf",
    5,
    "Five stars five stars",
    "Great great great great. Five stars. Five stars. Five stars.",
    guest("Rating Farm", "farm@spam.example"),
    "rejected",
    17
  ),
]

export const REVIEWS: Review[] = ROWS.map((review, index) => ({
  id: `rev-${String(index + 1).padStart(4, "0")}`,
  ...review,
}))

/** Every review left on a product, whatever its moderation status. */
export function reviewsForProduct(
  reviews: Review[],
  productId: string
): Review[] {
  return reviews.filter((review) => review.productId === productId)
}

/**
 * Average rating across APPROVED reviews only, to one decimal. Pending and
 * rejected reviews never move a product's score, because the storefront only
 * ever reads approved reviews. Returns 0 when there are none.
 */
export function averageRating(reviews: Review[]): number {
  const approved = reviews.filter((review) => review.status === "approved")
  if (approved.length === 0) return 0
  const total = approved.reduce((sum, review) => sum + review.rating, 0)
  return Math.round((total / approved.length) * 10) / 10
}

/** Count of APPROVED reviews per star, for the rollup breakdown bars. */
export function ratingBreakdown(
  reviews: Review[]
): Record<RatingValue, number> {
  const counts: Record<RatingValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const review of reviews) {
    if (review.status !== "approved") continue
    const star = Math.round(review.rating) as RatingValue
    if (star >= 1 && star <= 5) counts[star] += 1
  }
  return counts
}
