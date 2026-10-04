import { collection, doc, getDoc, writeBatch, serverTimestamp, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { actorSnap, formCreationMode } from "@/lib/permissions";
import { LIMITS } from "@/lib/constants";
import { istDayNumber } from "@/lib/utils";
import { logInBatch } from "./logs";

export const FIELD_TYPES = [
  { id: "text", label: "Short answer" },
  { id: "textarea", label: "Paragraph" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "number", label: "Number" },
  { id: "select", label: "Dropdown" },
  { id: "radio", label: "Multiple choice" },
  { id: "checkbox", label: "Checkboxes" },
  { id: "date", label: "Date" },
  { id: "rating", label: "Rating (1–5)" },
];

export async function getQuota(uid) {
  const s = await getDoc(doc(db, "formQuota", uid));
  const today = istDayNumber();
  const d = s.exists() ? s.data() : null;
  return { used: d && d.day === today ? d.count : 0, today };
}

/**
 * Saves a form. Path depends on role:
 *  - Admin: free
 *  - Club Reps / Technical lead: 3 per day (counter), then need a code
 *  - Everyone else: needs a one-time code (from Admin / Club Rep / Technical lead)
 */
export async function saveForm(me, form, grant /* {code, requestId} | null */) {
  const mode = formCreationMode(me);
  const batch = writeBatch(db);
  const ref = doc(collection(db, "forms"));
  let via = "admin";
  if (mode === "quota" && !grant) {
    const { used, today } = await getQuota(me.uid);
    if (used >= LIMITS.formsPerDay) throw new Error(`Daily limit reached (${LIMITS.formsPerDay}/day). Request a permission code.`);
    batch.set(doc(db, "formQuota", me.uid), { day: today, count: used + 1 });
    via = "quota";
  } else if (mode !== "unlimited") {
    if (!grant) throw new Error("A permission code is required.");
    via = "code";
    batch.update(doc(db, "grantCodes", grant.code), { used: true, usedBy: me.uid, usedAt: serverTimestamp(), formId: ref.id });
    batch.update(doc(db, "requests", grant.requestId), { status: "used", usedAt: serverTimestamp(), formId: ref.id });
  }
  batch.set(ref, {
    id: ref.id, eventId: form.eventId, eventName: form.eventName,
    title: form.title.trim(), description: form.description.trim(),
    fields: form.fields, status: "in_use", via, grant: grant ? { code: grant.code, requestId: grant.requestId } : null,
    createdBy: actorSnap(me), createdAt: serverTimestamp(), responses: 0,
  });
  logInBatch(batch, { scope: "forms", type: "form.create", actor: me, target: { id: ref.id, name: form.title.trim() }, details: { event: form.eventName, via, code: grant?.code || null } });
  await batch.commit();
  return ref.id;
}

export function submitFormResponse(form, answers, uid = null) {
  return addDoc(collection(db, "formResponses"), {
    formId: form.id, eventId: form.eventId, answers, uid, submittedAt: serverTimestamp(),
  });
}
