import { OB_ROLES, rankOf, CODE_FORMATS, APPROVER_RANK, roleLabel, teamName } from "./constants";

export const isAdmin = (m) => m?.role === "admin";
export const isOB = (m) => OB_ROLES.includes(m?.role);
export const isLead = (m) => m?.role === "lead";
export const isTTL = (m) => m?.role === "lead" && m?.team === "technical";
export const isMTL = (m) => m?.role === "lead" && m?.team === "media";
export const isMediaTeam = (m) => m?.team === "media" && (m?.role === "lead" || m?.role === "member");
export const isActiveMember = (m) => !!m && m.status === "active";
export const isReady = (m) => isActiveMember(m) && m.onboarded === true;
export const isStaff = (m) => isReady(m) && rankOf(m.role) >= 40; // admin, OB, leads (chat + event ops)

/** Snapshot stored on logs / requests / events so history stays readable after people leave. */
export function actorSnap(m) {
  if (!m) return null;
  return {
    uid: m.uid, name: m.name || "", email: m.email || "", photoUrl: m.photoUrl || "",
    amalId: m.amalId || "", role: m.role || "", rank: rankOf(m.role),
    designation: m.designation || roleLabel(m.role), team: m.team || null,
    teamName: m.team ? teamName(m.team) : "Core",
  };
}

// ── Events ──
export const canCreateEvent = (m) => isReady(m) && (isAdmin(m) || isOB(m));
/** Q1 (c): once a senior creates an event, only equal or higher ranks can edit it */
export const canEditEvent = (m, ev) => canCreateEvent(m) && rankOf(m.role) >= (ev?.createdBy?.rank ?? 0);
export const canDisableEvent = (m) => isReady(m) && rankOf(m.role) >= 40;
export const canExportRegistrations = (m) => isReady(m) && rankOf(m.role) >= 40;
export const canSeeRegistrations = (m) => isReady(m);

// ── Members ──
export function canReviewTeam(m, teamId) {
  if (!isReady(m)) return false;
  if (teamId === "core") return isAdmin(m);
  return isAdmin(m) || isOB(m);
}
export const canInvite = (m) => isReady(m) && rankOf(m.role) >= 40;

// ── Permission scopes ──
/** Approver type for a scope, or null if this member cannot approve. */
export function approverType(m, scope) {
  if (!isReady(m)) return null;
  if (isAdmin(m)) return "admin";
  if (isOB(m)) return "ob";
  if (scope === "form" && isTTL(m)) return "ttl";
  if (scope === "poster" && isMTL(m)) return "mtl";
  return null;
}
export const approverRank = (type) => APPROVER_RANK[type] ?? 0;
export const codeFormat = (type) => CODE_FORMATS[type];

/** Form creation: Admin unlimited; OB + Technical Team Lead free (3/day); everyone else needs a code. */
export function formCreationMode(m) {
  if (!isReady(m)) return "blocked";
  if (isAdmin(m)) return "unlimited";
  if (isOB(m) || isTTL(m)) return "quota";
  return "code";
}
/** Poster creation: Admin, OB, Media & Design team directly; others need a code. */
export function posterCreationMode(m) {
  if (!isReady(m)) return "blocked";
  if (isAdmin(m) || isOB(m) || isMediaTeam(m)) return "direct";
  return "code";
}

export const canSeeFormLogs = (m) => isReady(m) && (isAdmin(m) || isOB(m) || isTTL(m));
export const canSeePosterLogs = (m) => isReady(m) && (isAdmin(m) || isOB(m) || isMediaTeam(m));
