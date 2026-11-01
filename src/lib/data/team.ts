// Team members: types, closed vocabularies, and the deterministic seed. Seeded
// into the demo `teamMembers` store on first load and reached only through
// teamMembersRepository (the swap seam). No component holds this data.

export type MemberStatus = "Active" | "Invited" | "Suspended" | "Deactivated"
export type MemberRole =
  "Owner" | "Admin" | "Member" | "Billing" | "Guest" | "Support Agent"
export type AuthMethod = "SSO" | "Password"
export type SsoProvider = "Okta" | "Microsoft Entra ID" | "Google Workspace"
export type TwoFactor = "Authenticator" | "Passkey" | "Security key" | "SMS"
export type Provisioning = "SCIM" | "JIT" | "Manual"
export type Scope = "None" | "Read" | "Write" | "Admin"

/** Closed vocabulary for team tags (filters + badge colors). */
export const TEAM_LABELS = [
  "Engineering",
  "Product",
  "Design",
  "Sales",
  "Marketing",
  "Customer Success",
  "Finance",
  "IT/Security",
] as const

export type TeamLabel = (typeof TEAM_LABELS)[number]

export interface Member {
  id: string
  name: string
  avatar: string
  email: string
  role: MemberRole
  title: string
  scope: Scope
  teams: TeamLabel[]
  status: MemberStatus
  auth: AuthMethod
  ssoProvider: SsoProvider | null
  twoFactor: TwoFactor | null
  provisioning: Provisioning
  lastActive: string
  lastActiveIso: string
  seatLabel: string
}

/** Back-compat alias for the feature's original type name. */
export type IMember = Member

export const STATUS_ORDER: MemberStatus[] = [
  "Active",
  "Invited",
  "Suspended",
  "Deactivated",
]

export const ROLE_ORDER: MemberRole[] = [
  "Owner",
  "Admin",
  "Member",
  "Billing",
  "Guest",
  "Support Agent",
]

/** Roles offered in the bulk change-role control. */
export const BULK_ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: "Member", label: "Member" },
  { value: "Admin", label: "Admin" },
  { value: "Billing", label: "Billing" },
  { value: "Guest", label: "Guest" },
  { value: "Support Agent", label: "Support Agent" },
]

// ── Seed (12 members) ──

export const TEAM_MEMBERS: Member[] = [
  {
    id: "usr_a1b2c3d4",
    name: "Mira Stone",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
    email: "mira.stone@acmecloud.com",
    role: "Owner",
    title: "Head of Product",
    scope: "Admin",
    teams: ["Product", "IT/Security"],
    status: "Active",
    auth: "SSO",
    ssoProvider: "Okta",
    twoFactor: "Passkey",
    provisioning: "SCIM",
    lastActive: "2 min ago",
    lastActiveIso: "2026-06-17T14:12:00Z",
    seatLabel: "Seat 1 of 80",
  },
  {
    id: "usr_b2c3d4e5",
    name: "Leo Grant",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&dpr=2&q=80",
    email: "leo.grant@acmecloud.com",
    role: "Admin",
    title: "Eng Manager",
    scope: "Admin",
    teams: ["Engineering", "IT/Security"],
    status: "Active",
    auth: "SSO",
    ssoProvider: "Microsoft Entra ID",
    twoFactor: "Authenticator",
    provisioning: "SCIM",
    lastActive: "18 min ago",
    lastActiveIso: "2026-06-17T13:56:00Z",
    seatLabel: "Seat 4 of 80",
  },
  {
    id: "usr_c3d4e5f6",
    name: "Sarah Chen",
    avatar:
      "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
    email: "sarah.chen@acmecloud.com",
    role: "Admin",
    title: "Eng Manager",
    scope: "Admin",
    teams: ["Engineering"],
    status: "Active",
    auth: "SSO",
    ssoProvider: "Okta",
    twoFactor: "Security key",
    provisioning: "SCIM",
    lastActive: "1 hour ago",
    lastActiveIso: "2026-06-17T13:09:00Z",
    seatLabel: "Seat 7 of 80",
  },
  {
    id: "usr_d4e5f6a7",
    name: "Nora Vale",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80",
    email: "nora.vale@acmecloud.com",
    role: "Member",
    title: "Product Designer",
    scope: "Write",
    teams: ["Design", "Product"],
    status: "Active",
    auth: "SSO",
    ssoProvider: "Google Workspace",
    twoFactor: "Authenticator",
    provisioning: "JIT",
    lastActive: "3 hours ago",
    lastActiveIso: "2026-06-17T11:05:00Z",
    seatLabel: "Seat 12 of 80",
  },
  {
    id: "usr_e5f6a7b8",
    name: "Sana Qureshi",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&dpr=2&q=80",
    email: "sana.qureshi@acmecloud.com",
    role: "Member",
    title: "Backend Engineer",
    scope: "Write",
    teams: ["Engineering"],
    status: "Active",
    auth: "SSO",
    ssoProvider: "Okta",
    twoFactor: "Authenticator",
    provisioning: "SCIM",
    lastActive: "5 hours ago",
    lastActiveIso: "2026-06-17T09:21:00Z",
    seatLabel: "Seat 18 of 80",
  },
  {
    id: "usr_f6a7b8c9",
    name: "David Kim",
    avatar:
      "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
    email: "david.kim@acmecloud.com",
    role: "Member",
    title: "DevOps",
    scope: "Write",
    teams: ["Engineering", "IT/Security"],
    status: "Active",
    auth: "SSO",
    ssoProvider: "Microsoft Entra ID",
    twoFactor: "Security key",
    provisioning: "SCIM",
    lastActive: "Yesterday",
    lastActiveIso: "2026-06-16T17:40:00Z",
    seatLabel: "Seat 23 of 80",
  },
  {
    id: "usr_a7b8c9d0",
    name: "Michael Rodriguez",
    avatar:
      "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
    email: "michael.rodriguez@acmecloud.com",
    role: "Member",
    title: "Account Executive",
    scope: "Read",
    teams: ["Sales"],
    status: "Active",
    auth: "Password",
    ssoProvider: null,
    twoFactor: "SMS",
    provisioning: "Manual",
    lastActive: "Yesterday",
    lastActiveIso: "2026-06-16T15:18:00Z",
    seatLabel: "Seat 31 of 80",
  },
  {
    id: "usr_b8c9d0e1",
    name: "Priya Patel",
    avatar:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=96&h=96&dpr=2&q=80",
    email: "priya.patel@acmecloud.com",
    role: "Billing",
    title: "Finance",
    scope: "Read",
    teams: ["Finance"],
    status: "Active",
    auth: "SSO",
    ssoProvider: "Google Workspace",
    twoFactor: "Authenticator",
    provisioning: "JIT",
    lastActive: "2 days ago",
    lastActiveIso: "2026-06-15T10:02:00Z",
    seatLabel: "Seat 38 of 80",
  },
  {
    id: "usr_c9d0e1f2",
    name: "Emma Wilson",
    avatar:
      "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
    email: "emma.wilson@acmecloud.com",
    role: "Member",
    title: "Marketing",
    scope: "Read",
    teams: ["Marketing"],
    status: "Invited",
    auth: "Password",
    ssoProvider: null,
    twoFactor: null,
    provisioning: "Manual",
    lastActive: "Invite sent",
    lastActiveIso: "2026-06-14T09:30:00Z",
    seatLabel: "Pending seat",
  },
  {
    id: "usr_d0e1f2a3",
    name: "Omar Haddad",
    avatar:
      "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=96&h=96&dpr=2&q=80",
    email: "omar.haddad@acmecloud.com",
    role: "Member",
    title: "Data Analyst",
    scope: "Read",
    teams: ["Product"],
    status: "Invited",
    auth: "Password",
    ssoProvider: null,
    twoFactor: null,
    provisioning: "Manual",
    lastActive: "Expires in 3 days",
    lastActiveIso: "2026-06-13T16:45:00Z",
    seatLabel: "Pending seat",
  },
  {
    id: "usr_e1f2a3b4",
    name: "Kenji Tan",
    avatar:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=96&h=96&dpr=2&q=80",
    email: "kenji.tan@acmecloud.com",
    role: "Guest",
    title: "Contractor",
    scope: "Read",
    teams: ["Design"],
    status: "Suspended",
    auth: "SSO",
    ssoProvider: "Google Workspace",
    twoFactor: "SMS",
    provisioning: "JIT",
    lastActive: "14 days ago",
    lastActiveIso: "2026-06-03T12:00:00Z",
    seatLabel: "Seat 52 of 80",
  },
  {
    id: "usr_f2a3b4c5",
    name: "Alex Johnson",
    avatar:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
    email: "alex.johnson@acmecloud.com",
    role: "Member",
    title: "QA Engineer",
    scope: "None",
    teams: ["Engineering"],
    status: "Deactivated",
    auth: "Password",
    ssoProvider: null,
    twoFactor: null,
    provisioning: "Manual",
    lastActive: "97 days ago",
    lastActiveIso: "2026-03-12T08:15:00Z",
    seatLabel: "Seat released",
  },
]
