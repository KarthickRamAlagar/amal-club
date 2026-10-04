// Multi-provider AI with fallback. Order comes from env; the first provider is primary.
const list = (v, d) => (v || d).split(",").map((s) => s.trim()).filter(Boolean);
const timeout = (ms) => AbortSignal.timeout(ms);

async function gemini(prompt, system, json) {
  const key = process.env.GEMINI_API_KEY; if (!key) throw new Error("no key");
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: timeout(40000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, ...(json ? { responseMimeType: "application/json" } : {}) },
    }),
  });
  const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || r.status);
  return j.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
}
async function openaiCompat(url, key, model, prompt, system, json) {
  if (!key) throw new Error("no key");
  const r = await fetch(url, {
    method: "POST", signal: timeout(40000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature: 0.6, messages: [{ role: "system", content: system }, { role: "user", content: prompt }], ...(json ? { response_format: { type: "json_object" } } : {}) }),
  });
  const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || r.status);
  return j.choices?.[0]?.message?.content || "";
}
const TEXT = {
  gemini,
  groq: (p, s, j) => openaiCompat("https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY, process.env.GROQ_MODEL || "llama-3.3-70b-versatile", p, s, j),
  openrouter: (p, s, j) => openaiCompat("https://openrouter.ai/api/v1/chat/completions", process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free", p, s, j),
};

export async function generateText({ prompt, system, json = false }) {
  const errors = [];
  for (const name of list(process.env.AI_TEXT_PROVIDERS, "gemini,groq,openrouter")) {
    if (!TEXT[name]) continue;
    try {
      const out = await TEXT[name](prompt, system, json);
      if (!out) throw new Error("empty");
      if (json) { const m = out.match(/\{[\s\S]*\}/); return { data: JSON.parse(m ? m[0] : out), provider: name }; }
      return { text: out.trim(), provider: name };
    } catch (e) { errors.push(`${name}: ${e.message}`); }
  }
  throw Object.assign(new Error(`All AI text providers failed (${errors.join(" | ")})`), { status: 502 });
}

// ── Images ──
const toDataUrl = (buf, mime = "image/png") => `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
const IMAGE = {
  async gemini(prompt, w, h) {
    const key = process.env.GEMINI_API_KEY; if (!key) throw new Error("no key");
    const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
    const ratio = w > h ? "16:9" : w === h ? "1:1" : h / w > 1.6 ? "9:16" : "4:5";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: timeout(55000),
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: ratio } } }),
    });
    const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || r.status);
    const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) throw new Error("no image returned");
    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  },
  async cloudflare(prompt) {
    const acc = process.env.CLOUDFLARE_ACCOUNT_ID, tok = process.env.CLOUDFLARE_API_TOKEN; if (!acc || !tok) throw new Error("no key");
    const model = process.env.CLOUDFLARE_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell";
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc}/ai/run/${model}`, {
      method: "POST", signal: timeout(55000), headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: 6 }),
    });
    const j = await r.json(); if (!r.ok || !j.result?.image) throw new Error(j.errors?.[0]?.message || r.status);
    return `data:image/jpeg;base64,${j.result.image}`;
  },
  async pollinations(prompt, w, h) {
    const r = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 900))}?width=${w}&height=${h}&nologo=true&model=flux&seed=${Date.now() % 100000}`, { signal: timeout(55000) });
    if (!r.ok) throw new Error(r.status);
    return toDataUrl(await r.arrayBuffer(), r.headers.get("content-type") || "image/jpeg");
  },
};

export async function generateImage({ prompt, w = 1600, h = 900 }) {
  const errors = [];
  for (const name of list(process.env.AI_IMAGE_PROVIDERS, "gemini,cloudflare,pollinations")) {
    if (!IMAGE[name]) continue;
    try { return { image: await IMAGE[name](prompt, w, h), provider: name }; }
    catch (e) { errors.push(`${name}: ${e.message}`); }
  }
  throw Object.assign(new Error(`All AI image providers failed (${errors.join(" | ")})`), { status: 502 });
}
