import { collection, deleteDoc, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { actorSnap } from "@/lib/permissions";
import { logInBatch } from "./logs";

/** Saves the event report (HTML from the editor). `logIt` adds an activity-log line (first save of a session). */
export async function saveReport(me, ev, { html, words, createdBy }, logIt = false) {
  const batch = writeBatch(db);
  batch.set(doc(db, "reports", ev.slug), {
    eventId: ev.slug, eventName: ev.name, html, words: words || 0,
    createdBy: createdBy || actorSnap(me),
    updatedBy: actorSnap(me), updatedAt: serverTimestamp(),
  });
  if (logIt) logInBatch(batch, { scope: "media", type: "report.save", actor: me, target: { id: ev.slug, name: ev.name }, details: { words: words || 0 } });
  await batch.commit();
}

/** A diary note for one IST day of an event (written by the Documentation team). */
export async function addDiaryNote(me, ev, day, text, { ai = false } = {}) {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "events", ev.slug, "diary")), { day, text: text.trim().slice(0, 4000), ai, author: actorSnap(me), createdAt: serverTimestamp() });
  logInBatch(batch, { scope: "media", type: "diary.note", actor: me, target: { id: ev.slug, name: ev.name }, details: { day, ai } });
  await batch.commit();
}
export const deleteDiaryNote = (ev, id) => deleteDoc(doc(db, "events", ev.slug, "diary", id));
