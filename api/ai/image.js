import { handler, authed, adb, FieldValue, snap, OB, istMonth } from "../_lib/admin.js";
import { generateImage } from "../_lib/ai.js";

const BANNERS_PER_MONTH = 2;

export default handler(async (req) => {
  const { uid, member } = await authed(req);
  const { purpose, eventName = "", description = "", style = "" } = req.body || {};
  const db = adb(); const qref = db.doc(`aiQuota/${uid}`);

  if (purpose === "banner") {
    if (!(member.role === "admin" || OB.includes(member.role))) throw Object.assign(new Error("Only the Admin and Club Representatives create event banners."), { status: 403 });
    // reserve a slot atomically before generating
    const remaining = await db.runTransaction(async (tx) => {
      const s = await tx.get(qref); const d = s.exists ? s.data() : {};
      const used = d.month === istMonth() ? d.banners || 0 : 0;
      if (used >= BANNERS_PER_MONTH) throw Object.assign(new Error(`You've used your ${BANNERS_PER_MONTH} AI banners this month. Upload or pick from Unsplash instead.`), { status: 429 });
      tx.set(qref, { month: istMonth(), banners: used + 1 }, { merge: true });
      return BANNERS_PER_MONTH - used - 1;
    });
    const prompt = `Wide cinematic event banner artwork for a college leadership club event called "${eventName}". Theme: ${description}. Style: ${style || "cinematic stage lighting, deep crimson and warm gold, premium, modern"}. No text, no letters, no words, no logos, no watermarks. Leave calm negative space on the left for a headline.`;
    try {
      const r = await generateImage({ prompt, w: 1600, h: 900 });
      await db.collection("logs").add({ scope: "events", type: "ai.banner", actor: snap(member), target: { id: "", name: eventName }, details: { provider: r.provider, remaining }, createdAt: FieldValue.serverTimestamp() });
      return { ...r, remaining };
    } catch (e) {
      await qref.set({ banners: FieldValue.increment(-1) }, { merge: true }); // refund on failure
      throw e;
    }
  }

  throw Object.assign(new Error("Unknown purpose"), { status: 400 });
});
