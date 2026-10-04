import { adb, FieldValue } from "../_lib/admin.js";
import { runPrediction } from "../_lib/predict.js";

/**
 * Daily at 12:05 AM IST (Vercel Hobby allows one run/day):
 *  1. Drop registrations still unpaid 5h after registering (clients also do this lazily all day).
 *  2. Registration closed at 11:50 PM → run AI planning for events starting today.
 */
export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end();
  const db = adb(); const now = Date.now(); let expired = 0, predicted = 0;
  const stale = await db.collection("registrations").where("status", "==", "pending_payment").where("expiresAt", "<", now).limit(400).get();
  for (const d of stale.docs) {
    const r = d.data(); const b = db.batch();
    b.update(d.ref, { status: "expired", decidedAt: FieldValue.serverTimestamp(), decisionNote: "Auto-dropped: not verified within 5 hours" });
    b.update(db.doc(`events/${r.eventId}`), { [r.mode === "onspot" ? "onspotCount" : "onlineCount"]: FieldValue.increment(-1) });
    b.set(db.collection(`events/${r.eventId}/messages`).doc(), { type: "system", text: `@${r.teamName} registration dropped (payment not verified within 5 hours).`, mentions: [{ uid: r.uid, name: r.teamName }], sender: { name: "AMAL", kind: "staff" }, regId: r.id, createdAt: FieldValue.serverTimestamp() });
    b.set(db.collection("logs").doc(), { scope: "registrations", type: "registration.expire", actor: { name: "Nightly job", designation: "System", rank: 0 }, target: { id: r.id, name: r.teamName }, details: { eventId: r.eventId }, createdAt: FieldValue.serverTimestamp() });
    await b.commit(); expired++;
  }
  const ist = new Date(now + 19800000); const dayStart = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 19800000;
  const today = await db.collection("events").where("startAt", ">=", dayStart).where("startAt", "<", dayStart + 86400000).get();
  for (const e of today.docs) {
    if (e.data().status === "disabled") continue;
    try { await runPrediction(e.id, null); predicted++; } catch (err) { console.error(err); }
  }
  res.status(200).json({ expired, predicted });
}
