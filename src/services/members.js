import {
  collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp, setDoc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { actorSnap } from "@/lib/permissions";
import { randomToken, academicYearOf } from "@/lib/utils";
import { roleLabel } from "@/lib/constants";
import { logInBatch } from "./logs";

const INVITE_DAYS = 7;

/** Resolve an AMAL ID or email to the login email. */
export async function resolveLoginEmail(identifier) {
  const id = identifier.trim().toLowerCase();
  if (id.includes("@")) return id;
  const snap = await getDoc(doc(db, "amalIds", id));
  if (!snap.exists()) throw new Error("No member found with that AMAL ID.");
  return snap.data().email;
}

export async function signInMember(identifier, password) {
  const email = await resolveLoginEmail(identifier);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function amalIdAvailable(amalId) {
  const snap = await getDoc(doc(db, "amalIds", amalId.toLowerCase()));
  return !snap.exists();
}

// ── Invites ──────────────────────────────────────────────────────────
export async function createInvite(me, { name, email, role, team }) {
  const code = `AMAL-${randomToken(4)}-${randomToken(4)}`;
  const batch = writeBatch(db);
  const designation = role === "lead" ? `${roleLabel(role)}` : roleLabel(role);
  batch.set(doc(db, "invites", code), {
    code, name: name.trim(), email: email.trim().toLowerCase(), role, team: team || null, designation,
    createdBy: actorSnap(me), used: false, usedBy: null,
    createdAt: serverTimestamp(), expiresAt: Date.now() + INVITE_DAYS * 86400000,
  });
  logInBatch(batch, { scope: "members", type: "invite.create", actor: me, target: { id: code, name: name.trim() }, details: { role, team: team || null, email: email.trim().toLowerCase() } });
  await batch.commit();
  return code;
}

export async function getInvite(code) {
  const snap = await getDoc(doc(db, "invites", code.trim().toUpperCase()));
  if (!snap.exists()) throw new Error("This invite code doesn't exist. Check it and try again.");
  const inv = snap.data();
  if (inv.used) throw new Error("This invite code was already used. Sign in instead.");
  if (inv.expiresAt < Date.now()) throw new Error("This invite code has expired. Ask for a new one.");
  return inv;
}

/** Create (or sign into) the auth account, then claim the invite and AMAL ID in one batch. */
export async function redeemInvite(invite, { password, amalId }) {
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, invite.email, password);
  } catch (e) {
    if (e.code !== "auth/email-already-in-use") throw e;
    cred = await signInWithEmailAndPassword(auth, invite.email, password);
  }
  const uid = cred.user.uid;
  const batch = writeBatch(db);
  const member = {
    uid, name: invite.name, email: invite.email, role: invite.role, team: invite.team || null,
    designation: invite.designation, amalId: amalId.toLowerCase(), status: "active", onboarded: false,
    inviteCode: invite.code, invitedBy: invite.createdBy, joinedYear: academicYearOf(),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  batch.set(doc(db, "members", uid), member);
  batch.set(doc(db, "amalIds", amalId.toLowerCase()), { uid, email: invite.email });
  batch.update(doc(db, "invites", invite.code), { used: true, usedBy: uid, usedAt: serverTimestamp() });
  logInBatch(batch, { scope: "members", type: "member.join", actor: { ...actorSnap(member) }, target: { id: uid, name: invite.name } });
  await batch.commit();
  return uid;
}

/** One-time bootstrap of the first faculty admin (only works while /config/setup does not exist). */
export async function setupFirstAdmin({ name, email, password, amalId }) {
  const setup = await getDoc(doc(db, "config", "setup"));
  if (setup.exists()) throw new Error("Setup is already complete. Sign in instead.");
  const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  const uid = cred.user.uid;
  const batch = writeBatch(db);
  batch.set(doc(db, "members", uid), {
    uid, name: name.trim(), email: email.trim().toLowerCase(), role: "admin", team: null, designation: "Faculty Admin",
    amalId: amalId.toLowerCase(), status: "active", onboarded: false, joinedYear: academicYearOf(),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, "amalIds", amalId.toLowerCase()), { uid, email: email.trim().toLowerCase() });
  batch.set(doc(db, "config", "setup"), { adminUid: uid, at: serverTimestamp() });
  await batch.commit();
}

// ── Onboarding ───────────────────────────────────────────────────────
export async function completeOnboarding(me, pub, priv) {
  const batch = writeBatch(db);
  batch.update(doc(db, "members", me.uid), { ...pub, onboarded: true, onboardedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(doc(db, "memberPrivate", me.uid), { ...priv, updatedAt: serverTimestamp() }, { merge: true });
  if (!me.onboarded) logInBatch(batch, { scope: "members", type: "member.onboard", actor: { ...me, ...pub }, target: { id: me.uid, name: pub.name } });
  await batch.commit();
}

export async function getPrivate(uid) {
  const s = await getDoc(doc(db, "memberPrivate", uid));
  return s.exists() ? s.data() : {};
}

// ── Academic-year review (retain / release), team by team ────────────
export async function submitYearReview(me, { teamId, academicYear, decisions, members }) {
  const batch = writeBatch(db);
  const released = [], retained = [];
  for (const m of members) {
    const d = decisions[m.uid];
    if (d === "release") {
      released.push({ uid: m.uid, name: m.name });
      batch.update(doc(db, "members", m.uid), {
        status: "released", releasedAt: serverTimestamp(), releasedYear: academicYear,
        releasedBy: actorSnap(me), updatedAt: serverTimestamp(),
      });
    } else {
      retained.push({ uid: m.uid, name: m.name });
      batch.update(doc(db, "members", m.uid), { retainedYear: academicYear, updatedAt: serverTimestamp() });
    }
  }
  batch.set(doc(collection(db, "yearReviews")), {
    team: teamId, academicYear, retained, released, actor: actorSnap(me), createdAt: serverTimestamp(),
  });
  logInBatch(batch, { scope: "members", type: "year.review", actor: me, target: { id: teamId, name: teamId }, details: { academicYear, retained: retained.length, released: released.length } });
  await batch.commit();
  return { retained, released };
}

export async function restoreMember(me, m) {
  const batch = writeBatch(db);
  batch.update(doc(db, "members", m.uid), { status: "active", restoredAt: serverTimestamp(), restoredBy: actorSnap(me), updatedAt: serverTimestamp() });
  logInBatch(batch, { scope: "members", type: "member.restore", actor: me, target: { id: m.uid, name: m.name } });
  await batch.commit();
}

export async function fetchTeamMembers(teamId) {
  const q = teamId === "core"
    ? query(collection(db, "members"), where("status", "==", "active"), where("team", "==", null))
    : query(collection(db, "members"), where("status", "==", "active"), where("team", "==", teamId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function upsertParticipant(user, extra = {}) {
  await setDoc(doc(db, "participants", user.uid), {
    uid: user.uid, name: user.displayName || "", email: (user.email || "").toLowerCase(),
    photoUrl: user.photoURL || "", ...extra, updatedAt: serverTimestamp(),
  }, { merge: true });
}
