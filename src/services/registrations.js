import {
  collection, doc, getDocs, query, where, writeBatch, serverTimestamp, increment, addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { actorSnap } from "@/lib/permissions";
import { LIMITS, REG_STATUS } from "@/lib/constants";
import { toMillis } from "@/lib/utils";
import { logInBatch } from "./logs";

export const regId = (eventId, uid) => `${eventId}_${uid}`;

export function isExpired(r, now = Date.now()) {
  return r.status === REG_STATUS.pending && r.expiresAt && now > r.expiresAt;
}
export const effectiveStatus = (r) => (isExpired(r) ? REG_STATUS.expired : r.status);

/** Participant registers (online or on-spot). Counter increment is checked by Firestore rules. */
export async function createRegistration(user, ev, payload, mode = "online") {
  const id = regId(ev.slug, user.uid);
  const batch = writeBatch(db);
  const now = Date.now();
  batch.set(doc(db, "registrations", id), {
    id, eventId: ev.slug, eventName: ev.name, uid: user.uid, mode,
    teamName: payload.teamName.trim(),
    leader: payload.leader,
    members: payload.members,
    headcount: 1 + payload.members.length,
    amount: ev.price || 0,
    status: ev.price > 0 ? REG_STATUS.pending : REG_STATUS.confirmed,
    expiresAt: ev.price > 0 ? now + LIMITS.paymentWindowHours * 3600000 : null,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "events", ev.slug), { [mode === "onspot" ? "onspotCount" : "onlineCount"]: increment(1) });
  await batch.commit();
  await addDoc(collection(db, "events", ev.slug, "messages"), {
    type: "system", text: `${payload.teamName.trim()} registered (${mode === "onspot" ? "on-spot" : "online"}).`,
    sender: { uid: user.uid, name: payload.leader.name, photoUrl: payload.leader.photoUrl || "", kind: "participant" },
    regId: id, createdAt: serverTimestamp(),
  });
  return id;
}

/** Staff confirms payment → team tagged in chat. */
export async function setRegistrationStatus(me, reg, status, note = "") {
  const batch = writeBatch(db);
  const patch = { status, decidedBy: actorSnap(me), decidedAt: serverTimestamp(), decisionNote: note };
  batch.update(doc(db, "registrations", reg.id), patch);
  if (status !== REG_STATUS.confirmed && (reg.status === REG_STATUS.pending || reg.status === REG_STATUS.confirmed)) {
    batch.update(doc(db, "events", reg.eventId), { [reg.mode === "onspot" ? "onspotCount" : "onlineCount"]: increment(-1) });
  }
  batch.set(doc(collection(db, "events", reg.eventId, "messages")), {
    type: "system",
    text: status === REG_STATUS.confirmed
      ? `✅ Payment received — @${reg.teamName} is confirmed. See you there!`
      : `@${reg.teamName} registration ${status === REG_STATUS.expired ? "dropped (payment not verified within 5 hours)" : "rejected"}${note ? ` — ${note}` : ""}.`,
    mentions: [{ uid: reg.uid, name: reg.teamName }],
    sender: { ...actorSnap(me), kind: "staff" }, regId: reg.id, createdAt: serverTimestamp(),
  });
  logInBatch(batch, {
    scope: "registrations", type: status === REG_STATUS.confirmed ? "registration.confirm" : "registration.reject",
    actor: me, target: { id: reg.id, name: reg.teamName }, details: { eventId: reg.eventId, status, note },
  });
  await batch.commit();
}

/** Lazy 5-hour sweep: run by any staff client that opens the registrations or chat. */
export async function sweepExpired(me, regs) {
  const stale = regs.filter((r) => isExpired(r));
  if (!stale.length) return 0;
  const batch = writeBatch(db);
  for (const r of stale.slice(0, 120)) {
    batch.update(doc(db, "registrations", r.id), { status: REG_STATUS.expired, decidedAt: serverTimestamp(), decisionNote: "Auto-dropped: not verified within 5 hours" });
    batch.update(doc(db, "events", r.eventId), { [r.mode === "onspot" ? "onspotCount" : "onlineCount"]: increment(-1) });
    logInBatch(batch, { scope: "registrations", type: "registration.expire", actor: me, target: { id: r.id, name: r.teamName }, details: { eventId: r.eventId } });
  }
  await batch.commit();
  return stale.length;
}

export async function fetchEventRegistrations(eventId) {
  const snap = await getDocs(query(collection(db, "registrations"), where("eventId", "==", eventId)));
  return snap.docs.map((d) => d.data()).sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
}

export async function logExport(me, ev, count) {
  const batch = writeBatch(db);
  logInBatch(batch, { scope: "registrations", type: "registration.export", actor: me, target: { id: ev.slug, name: ev.name }, details: { rows: count } });
  await batch.commit();
}
