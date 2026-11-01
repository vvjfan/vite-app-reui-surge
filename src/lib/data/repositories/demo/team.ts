import type { Member } from "../../team"
import { makeDemoCollection } from "./make-collection"

function nextMemberId(): string {
  // Invites happen client-side (user action), so a browser UUID is fine.
  return `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`
}

export const demoTeamMembersRepository = makeDemoCollection<Member>(
  (db) => db.teamMembers,
  nextMemberId
)
