import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw Object.assign(new Error("Server is missing FIREBASE_SERVICE_ACCOUNT."), { status: 500 });
  const sa = JSON.parse(raw);
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  return initializeApp({ credential: cert(sa) });
}
export const adb = () => getFirestore(app());
export { FieldValue };

export const RANK = { admin: 100, president: 80, vp: 70, treasurer: 70, lead: 40, member: 20 };
export const OB = ["president", "vp", "treasurer"];

export function snap(m) {
  return { uid: m.uid, name: m.name || "", email: m.email || "", photoUrl: m.photoUrl || "", amalId: m.amalId || "", role: m.role, rank: RANK[m.role] || 0, designation: m.designation || m.role, team: m.team || null, teamName: m.team || "Core" };
}

/** Verifies the Firebase ID token and loads the AMAL member (if any). */
export async function authed(req, { requireMember = true } = {}) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) throw Object.assign(new Error("Sign in first."), { status: 401 });
  const decoded = await getAuth(app()).verifyIdToken(token).catch(() => null);
  if (!decoded) throw Object.assign(new Error("Session expired — sign in again."), { status: 401 });
  const ms = await adb().doc(`members/${decoded.uid}`).get();
  const member = ms.exists ? ms.data() : null;
  if (requireMember && (!member || member.status !== "active" || !member.onboarded)) throw Object.assign(new Error("Only onboarded AMAL members can do this."), { status: 403 });
  return { uid: decoded.uid, member };
}

export function handler(fn, { methods = ["POST"] } = {}) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!methods.includes(req.method)) return res.status(405).json({ error: "Method not allowed" });
    try {
      if (typeof req.body === "string" && req.body) { try { req.body = JSON.parse(req.body); } catch { /* ignore */ } }
      const out = await fn(req, res);
      if (!res.headersSent) res.status(200).json(out ?? { ok: true });
    } catch (e) {
      console.error(e);
      res.status(e.status || 500).json({ error: e.status ? e.message : "Server error — " + (e.message || "try again") });
    }
  };
}

export const istMonth = () => new Date(Date.now() + 19800000).toISOString().slice(0, 7);
export const istDay = () => Math.floor((Date.now() + 19800000) / 86400000);
