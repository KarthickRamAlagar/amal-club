import {
  collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp, arrayUnion, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { actorSnap, approverType, approverRank, codeFormat } from "@/lib/permissions";
import { LIMITS } from "@/lib/constants";
import { randomDigits } from "@/lib/utils";
import { logInBatch } from "./logs";

const scopeLog = (scope) => (scope === "poster" ? "posters" : "forms");

export async function createRequest(me, { scope, reason, event }) {
  const batch = writeBatch(db);
  const ref = doc(collection(db, "requests"));
  batch.set(ref, {
    id: ref.id, scope, reason: reason.trim(),
    eventId: event?.slug || "", eventName: event?.name || "",
    requester: actorSnap(me), status: "pending", approvals: [],
    createdAt: serverTimestamp(),
  });
  logInBatch(batch, { scope: scopeLog(scope), type: `${scope}.request`, actor: me, target: { id: ref.id, name: event?.name || "" }, details: { reason: reason.trim() } });
  await batch.commit();
  return ref.id;
}

/**
 * Approve: issue a one-time code (valid 24h) with the approver's prefix.
 * If several approvers allow, the highest one (Admin > Club Rep > Lead) is credited and their code replaces earlier ones.
 */
export async function approveRequest(me, req) {
  const type = approverType(me, req.scope);
  if (!type) throw new Error("You can't approve this request.");
  const snap = await getDoc(doc(db, "requests", req.id));
  const cur = snap.data();
  if (cur.status === "denied" || cur.status === "used") throw new Error(`This request is already ${cur.status}.`);
  const myRank = approverRank(type);
  const approval = { ...actorSnap(me), approverType: type, at: Date.now() };
  const batch = writeBatch(db);
  const credited = cur.status === "allowed" && approverRank(cur.decidedBy?.approverType) >= myRank;
  let code = null;
  if (!credited) {
    const fmt = codeFormat(type);
    code = `${fmt.prefix}${randomDigits(fmt.digits)}`;
    const expiresAt = Date.now() + LIMITS.codeValidityHours * 3600000;
    if (cur.activeCode) batch.update(doc(db, "grantCodes", cur.activeCode), { revoked: true });
    batch.set(doc(db, "grantCodes", code), {
      code, requestId: req.id, scope: req.scope, requesterUid: cur.requester.uid,
      issuedBy: approval, expiresAt, used: false, revoked: false, createdAt: serverTimestamp(),
    });
    batch.update(doc(db, "requests", req.id), {
      status: "allowed", decidedBy: approval, decidedAt: serverTimestamp(), activeCode: code,
      codeExpiresAt: expiresAt, approvals: arrayUnion(approval),
    });
  } else {
    batch.update(doc(db, "requests", req.id), { approvals: arrayUnion(approval) });
  }
  logInBatch(batch, { scope: scopeLog(req.scope), type: `${req.scope}.allow`, actor: me, target: { id: req.id, name: cur.requester.name }, details: { event: cur.eventName, approverType: type } });
  await batch.commit();
  return code;
}

export async function denyRequest(me, req, reason) {
  const type = approverType(me, req.scope);
  if (!type) throw new Error("You can't decide this request.");
  if (!reason?.trim()) throw new Error("Give a reason for denying.");
  const batch = writeBatch(db);
  const decided = { ...actorSnap(me), approverType: type, at: Date.now() };
  batch.update(doc(db, "requests", req.id), {
    status: "denied", decidedBy: decided, decisionReason: reason.trim(), decidedAt: serverTimestamp(),
  });
  if (req.activeCode) batch.update(doc(db, "grantCodes", req.activeCode), { revoked: true });
  logInBatch(batch, { scope: scopeLog(req.scope), type: `${req.scope}.deny`, actor: me, target: { id: req.id, name: req.requester.name }, details: { reason: reason.trim(), event: req.eventName } });
  await batch.commit();
}

/** Validate a code the requester typed in (exists, theirs, right scope, unused, unexpired). */
export async function checkCode(me, code, scope) {
  const c = code.trim().toUpperCase();
  const snap = await getDoc(doc(db, "grantCodes", c));
  if (!snap.exists()) throw new Error("That code doesn't exist.");
  const g = snap.data();
  if (g.requesterUid !== me.uid) throw new Error("This code was issued to someone else.");
  if (g.scope !== scope) throw new Error(`This code is for ${g.scope} creation.`);
  if (g.used) throw new Error("This code was already used.");
  if (g.revoked) throw new Error("This code was replaced or revoked.");
  if (g.expiresAt < Date.now()) throw new Error("This code has expired (24h). Request again.");
  return g;
}

export async function fetchCodeForRequest(reqId) {
  const s = await getDocs(query(collection(db, "grantCodes"), where("requestId", "==", reqId), where("revoked", "==", false), limit(1)));
  return s.empty ? null : s.docs[0].data();
}
