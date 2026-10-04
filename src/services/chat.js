import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { actorSnap } from "@/lib/permissions";

export function senderOf(member, user) {
  if (member) return { ...actorSnap(member), kind: "staff" };
  return { uid: user.uid, name: user.displayName || user.email, photoUrl: user.photoURL || "", kind: "participant" };
}

export function sendMessage(eventId, sender, msg) {
  return addDoc(collection(db, "events", eventId, "messages"), { ...msg, sender, createdAt: serverTimestamp() });
}

/** Participant marks payment as sent on their registration (also posts a payment card in chat). */
export async function submitPayment(eventId, sender, reg, { utr, proofUrl, note }) {
  await updateDoc(doc(db, "registrations", reg.id), {
    payment: { utr: utr.trim(), proofUrl: proofUrl || "", note: (note || "").trim(), at: Date.now() },
  });
  return sendMessage(eventId, sender, {
    type: "payment", regId: reg.id, teamName: reg.teamName, amount: reg.amount,
    utr: utr.trim(), proofUrl: proofUrl || "", text: (note || "").trim(),
  });
}
