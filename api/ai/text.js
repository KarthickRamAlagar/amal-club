import { handler, authed } from "../_lib/admin.js";
import { generateText } from "../_lib/ai.js";

export default handler(async (req) => {
  await authed(req);
  const { purpose, eventName = "", description = "" } = req.body || {};
  if (purpose !== "tagline") throw Object.assign(new Error("Unknown purpose"), { status: 400 });
  const r = await generateText({
    system: "You write punchy poster taglines for a college management & leadership club in India. Max 14 words. No hashtags, no emojis, no quotes.",
    prompt: `Event: ${eventName}\nAbout: ${description.slice(0, 1200)}\nWrite one tagline.`,
  });
  return { text: r.text.replace(/^["'“]|["'”]$/g, "").split("\n")[0], provider: r.provider };
});
