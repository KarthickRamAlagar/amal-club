import { handler, authed, adb, FieldValue, snap, OB, istDay } from "../_lib/admin.js";
import { generateText } from "../_lib/ai.js";

const DIARY_PER_DAY = 15;

/** AI writing help for the Documentation team: a day summary of an event, or a report section draft. */
export default handler(async (req) => {
  const { uid, member } = await authed(req);
  const { purpose, eventId = "", eventName = "", facts = "", section = "" } = req.body || {};
  if (!["diary", "section"].includes(purpose)) throw Object.assign(new Error("Unknown purpose"), { status: 400 });
  if (!(member.role === "admin" || OB.includes(member.role) || member.team === "documentation")) {
    throw Object.assign(new Error("AI writing help is for the Documentation & Report team, Club Representatives and the Admin."), { status: 403 });
  }
  const db = adb(); const qref = db.doc(`aiQuota/${uid}`);
  await db.runTransaction(async (tx) => {
    const s = await tx.get(qref); const d = s.exists ? s.data() : {};
    const used = d.diaryDay === istDay() ? d.diary || 0 : 0;
    if (used >= DIARY_PER_DAY) throw Object.assign(new Error(`Daily AI writing limit reached (${DIARY_PER_DAY}). Try again tomorrow.`), { status: 429 });
    tx.set(qref, { diaryDay: istDay(), diary: used + 1 }, { merge: true });
  });
  const system = "You are the documentation writer for AMAL (Amrita Management & Leadership Club, Amrita Vishwa Vidyapeetham, Bengaluru). Write factual, warm, professional British/Indian English for an official club record. Use ONLY the facts given — never invent names, numbers, quotes or outcomes. If something is unknown, leave it out. No emojis, no hashtags, no markdown headings.";
  const prompt = purpose === "diary"
    ? `Event: ${eventName}\nFacts recorded for this day (one per line):\n${String(facts).slice(0, 7000)}\n\nWrite a concise day summary in 2 short paragraphs (max 140 words) for the event diary.`
    : `Event: ${eventName}\nReport section to draft: ${String(section).slice(0, 120)}\nFacts:\n${String(facts).slice(0, 7000)}\n\nWrite that section in 1–3 short paragraphs (max 220 words).`;
  const r = await generateText({ system, prompt });
  await db.collection("logs").add({ scope: "media", type: "ai.diary", actor: snap(member), target: { id: String(eventId).slice(0, 120), name: eventName }, details: { provider: r.provider, purpose }, createdAt: FieldValue.serverTimestamp() });
  return { text: r.text.replace(/^#+\s.*$/gm, "").replace(/\*\*/g, "").trim(), provider: r.provider };
});
