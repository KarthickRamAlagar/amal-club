import { handler, authed, adb, FieldValue, snap, OB, istMonth, istDay } from "../_lib/admin.js";
import { generateImage } from "../_lib/ai.js";

const BANNERS_PER_MONTH = 2;
const POSTER_ART_PER_DAY = 8;
const SIZES = { instagram: [1080, 1350], story: [1080, 1920], linkedin: [1200, 627], banner: [1600, 900] };

export default handler(async (req) => {
  const { uid, member } = await authed(req);
  const { purpose, eventName = "", description = "", style = "", theme = "dark", format = "instagram", code } = req.body || {};
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

  if (purpose === "poster") {
    const direct = member.role === "admin" || OB.includes(member.role) || member.team === "media";
    if (!direct) {
      if (!code) throw Object.assign(new Error("A poster permission code is required."), { status: 403 });
      const g = await db.doc(`grantCodes/${String(code).toUpperCase()}`).get();
      const gd = g.data();
      if (!g.exists || gd.requesterUid !== uid || gd.scope !== "poster" || gd.used || gd.revoked || gd.expiresAt < Date.now()) throw Object.assign(new Error("That permission code isn't valid."), { status: 403 });
    }
    await db.runTransaction(async (tx) => {
      const s = await tx.get(qref); const d = s.exists ? s.data() : {};
      const used = d.posterDay === istDay() ? d.posterArt || 0 : 0;
      if (used >= POSTER_ART_PER_DAY) throw Object.assign(new Error(`Daily AI artwork limit reached (${POSTER_ART_PER_DAY}). Try the event banner or Unsplash.`), { status: 429 });
      tx.set(qref, { posterDay: istDay(), posterArt: used + 1 }, { merge: true });
    });
    const [w, h] = SIZES[format] || SIZES.instagram;
    const prompt = `Background artwork for a ${format === "linkedin" ? "LinkedIn" : "Instagram"} event poster for "${eventName}" by a college management & leadership club. ${description}. ${theme === "light" ? "Bright, airy, ivory and soft crimson palette" : "Dark, moody, deep crimson with warm gold light"}. ${style}. Abstract and atmospheric, strong depth. Absolutely no text, letters, numbers, logos or watermarks.`;
    return await generateImage({ prompt, w: Math.round(w * 0.75), h: Math.round(h * 0.75) });
  }
  throw Object.assign(new Error("Unknown purpose"), { status: 400 });
});
