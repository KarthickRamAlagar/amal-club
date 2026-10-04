import { handler, authed } from "./_lib/admin.js";

export default handler(async (req) => {
  await authed(req);
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw Object.assign(new Error("Unsplash isn't configured (UNSPLASH_ACCESS_KEY)."), { status: 500 });
  const q = String(req.query.q || "").slice(0, 80);
  const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=18&orientation=landscape&content_filter=high`, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" } });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error(j.errors?.[0] || "Unsplash error"), { status: 502 });
  return {
    results: j.results.map((p) => ({
      id: p.id, alt: p.alt_description, author: p.user?.name,
      thumb: p.urls.small, url: `${p.urls.raw}&auto=format&fit=crop&w=1800&q=85`,
    })),
  };
}, { methods: ["GET"] });
