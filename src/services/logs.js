import { collection, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { actorSnap } from "@/lib/permissions";

/**
 * Adds a log entry into a batch. scope decides who can read it:
 * members | events | registrations | forms | media
 */
export function logInBatch(batch, { scope, type, actor, target = {}, details = {} }) {
  const ref = doc(collection(db, "logs"));
  batch.set(ref, {
    scope, type,
    actor: actor?.rank !== undefined ? actor : actorSnap(actor),
    target: { id: target.id || "", name: target.name || "", ...target },
    details,
    createdAt: serverTimestamp(),
  });
  return ref;
}

export const LOG_LABELS = {
  "invite.create": "Created an invite",
  "member.join": "Joined AMAL",
  "member.onboard": "Completed onboarding",
  "member.release": "Released member",
  "member.restore": "Restored member",
  "year.review": "Academic-year review",
  "event.create": "Created event",
  "event.update": "Edited event",
  "event.disable": "Disabled event",
  "event.enable": "Re-opened event",
  "registration.export": "Downloaded registrations CSV",
  "registration.confirm": "Confirmed payment",
  "registration.reject": "Rejected registration",
  "registration.expire": "Auto-dropped (5h, unpaid)",
  "form.create": "Created form",
  "form.request": "Requested form permission",
  "form.allow": "Allowed form request",
  "form.deny": "Denied form request",
  "media.save": "Saved media to event",
  "media.hide": "Hid media from event page",
  "media.show": "Showed media on event page",
  "media.remove": "Removed media",
  "report.save": "Updated event report",
  "diary.note": "Added a diary note",
  "ai.diary": "Generated AI day summary",
  "ai.banner": "Generated AI banner",
  "ai.prediction": "Ran AI planning prediction",
};
