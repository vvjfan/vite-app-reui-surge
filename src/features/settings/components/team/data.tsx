// The team types, closed vocabularies, and seed now live in the data layer
// (src/lib/data/team.ts) and are seeded into the demo store. This re-export keeps the
// feature's components importing from "./data" unchanged.
export * from "@/lib/data/team"
