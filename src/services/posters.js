import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { actorSnap } from "@/lib/permissions";
import { logInBatch } from "./logs";

export async function savePoster(me, data, grant) {
  const batch = writeBatch(db);
  const ref = doc(collection(db, "posters"));
  if (grant) {
    batch.update(doc(db, "grantCodes", grant.code), { used: true, usedBy: me.uid, usedAt: serverTimestamp(), posterId: ref.id });
    batch.update(doc(db, "requests", grant.requestId), { status: "used", usedAt: serverTimestamp(), posterId: ref.id });
  }
  batch.set(ref, { id: ref.id, ...data, grant: grant ? { code: grant.code, requestId: grant.requestId } : null, createdBy: actorSnap(me), createdAt: serverTimestamp() });
  logInBatch(batch, { scope: "posters", type: "poster.create", actor: me, target: { id: ref.id, name: data.eventName }, details: { theme: data.theme, format: data.format, code: grant?.code || null } });
  await batch.commit();
  return ref.id;
}
