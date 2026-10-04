// ─── Roles & hierarchy ───────────────────────────────────────────────
// Faculty Admin > President > Vice President == Treasurer > Team Lead > Team Member
export const ROLES = {
  admin: { label: "Admin (Faculty)", short: "Admin", rank: 100 },
  president: { label: "President", short: "President", rank: 80 },
  vp: { label: "Vice President", short: "Vice President", rank: 70 },
  treasurer: { label: "Treasurer", short: "Treasurer", rank: 70 },
  lead: { label: "Team Lead", short: "Team Lead", rank: 40 },
  member: { label: "Team Member", short: "Member", rank: 20 },
};
export const ROLE_ORDER = ["admin", "president", "vp", "treasurer", "lead", "member"];
export const OB_ROLES = ["president", "vp", "treasurer"]; // Club Representatives (Office Bearers)
export const rankOf = (role) => ROLES[role]?.rank ?? 0;
export const roleLabel = (role) => ROLES[role]?.label ?? "Participant";

// Which roles each role may invite
export function invitableRoles(role) {
  if (role === "admin") return ["president", "vp", "treasurer", "lead", "member"];
  if (OB_ROLES.includes(role)) return ["lead", "member"];
  if (role === "lead") return ["member"];
  return [];
}

// ─── Teams ───────────────────────────────────────────────────────────
export const TEAMS = [
  {
    id: "event-management", name: "Event Management", category: "Operations",
    summary: "Planning, logistics and on-ground execution that turn ideas into memorable AMAL events.",
    imageUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=85",
  },
  {
    id: "media", name: "Media & Design", category: "Creative",
    summary: "Posters, photography, reels and the visual identity behind every AMAL story.",
    imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=85",
  },
  {
    id: "technical", name: "Technical", category: "Technology",
    summary: "Building the AMAL platform, forms and digital tools that keep the club running.",
    imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=85",
  },
  {
    id: "outreach", name: "Outreach", category: "Community",
    summary: "Partnerships, sponsors and connecting AMAL with students, alumni and industry.",
    imageUrl: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=85",
  },
  {
    id: "documentation", name: "Documentation & Report", category: "Records",
    summary: "Minutes, event reports and the institutional memory of everything AMAL does.",
    imageUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=85",
  },
];
export const teamById = (id) => TEAMS.find((t) => t.id === id);
export const teamName = (id) => teamById(id)?.name ?? (id ? id : "Core");

export const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "PG / M.Tech", "Research", "Faculty"];
export const DEPARTMENTS = ["CSE", "AIE", "AID", "ECE", "EEE", "ME", "CCE", "RAI", "MBA", "MCA", "BBA", "B.Com", "M.Tech", "Other"];

// ─── Permission scopes (form creation / poster creation) ─────────────
// approver roles + code prefix per approver type
export const CODE_FORMATS = {
  admin: { prefix: "ADMIN-AMAL-", digits: 4 },
  ob: { prefix: "OB-AMAL-", digits: 6 },
  ttl: { prefix: "TTL-AMAL-", digits: 4 },
  mtl: { prefix: "MTL-AMAL-", digits: 4 },
};
export const APPROVER_RANK = { admin: 3, ob: 2, ttl: 1, mtl: 1 };

export const LIMITS = {
  formsPerDay: 3,          // OB / Technical lead free forms per day (Admin unlimited)
  aiBannersPerMonth: 2,    // per Admin / Club Representative
  paymentWindowHours: 5,   // unverified registrations drop after this
  codeValidityHours: 24,   // one-time permission codes
  registrationCloseHour: 23, registrationCloseMinute: 50, // night before the event
};

export const EVENT_STATUS = { upcoming: "upcoming", disabled: "disabled" };
export const REG_STATUS = {
  pending: "pending_payment",
  confirmed: "confirmed",
  expired: "expired",
  rejected: "rejected",
};

export const SITE_URL = (import.meta.env.VITE_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");

export const IMAGES = {
  hero: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1800&q=90",
  community: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1000&q=85",
  stage: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1800&q=85",
};
