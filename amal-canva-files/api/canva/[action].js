// /api/canva/<action> — Canva Connect integration (one serverless function).
//   GET  callback        OAuth redirect target (register this URL in the Canva developer portal)
//   POST status | connect | disconnect | designs | create | open | return | export | exportStatus | assets
import { createRemoteJWKSet, jwtVerify } from "jose";
import QRCode from "qrcode";
import { handler, authed, adb, RANK, OB } from "../_lib/admin.js";
import {
  AUTHORIZE_URL, CANVA_API, SCOPES, PRESETS, canvaConfigured, siteUrl, redirectUri, pkce, randomId,
  exchangeCode, saveTokens, canva, withCorrelation, open, accessToken,
} from "../_lib/canva.js";

const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const STATE_TTL = 15 * 60 * 1000;
const JWKS = createRemoteJWKSet(new URL(`${CANVA_API}/connect/keys`));

/** Same rule as the Firestore rules: Admin, Club Reps, every Team Lead, Media & Design team. */
const canMedia = (m) => m.role === "admin" || OB.includes(m.role) || m.role === "lead" || m.team === "media";
const safeReturn = (p) => (typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : "/dashboard/media");

async function callback(req, res) {
  const { code, state, error } = req.query || {};
  const db = adb();
  const go = (path, params) => { res.statusCode = 302; res.setHeader("Location", `${siteUrl(req)}${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams(params)}`); res.end(); };
  if (!state) return go("/dashboard/media", { canva: "error", reason: "missing state" });
  const ref = db.doc(`canvaStates/${String(state).replace(/[^A-Za-z0-9]/g, "")}`);
  const s = await ref.get();
  if (!s.exists || s.data().type !== "oauth") return go("/dashboard/media", { canva: "error", reason: "sign-in link expired" });
  const st = s.data(); await ref.delete(); // one use only
  const back = safeReturn(st.returnTo);
  if (error) return go(back, { canva: "error", reason: String(error) });
  if (Date.now() - st.createdAt > STATE_TTL) return go(back, { canva: "error", reason: "sign-in took too long" });
  try {
    const t = await exchangeCode(String(code), st.verifier, st.redirectUri);
    await saveTokens(st.uid, t, { connectedAt: Date.now() });
    // remember which Canva user this is (used to check return-navigation tokens)
    const meResp = await fetch(`${CANVA_API}/users/me`, { headers: { Authorization: `Bearer ${t.access_token}` } }).then((r) => r.json()).catch(() => ({}));
    const prof = await fetch(`${CANVA_API}/users/me/profile`, { headers: { Authorization: `Bearer ${t.access_token}` } }).then((r) => r.json()).catch(() => ({}));
    await db.doc(`canvaTokens/${st.uid}`).set({ canvaUserId: meResp?.team_user?.user_id || null, canvaTeamId: meResp?.team_user?.team_id || null, displayName: prof?.profile?.display_name || "" }, { merge: true });
    return go(back, { canva: "connected" });
  } catch (e) {
    console.error(e);
    return go(back, { canva: "error", reason: e.message || "token exchange failed" });
  }
}

const actions = {
  async status({ uid }) {
    if (!canvaConfigured()) return { configured: false, connected: false };
    const s = await adb().doc(`canvaTokens/${uid}`).get();
    return { configured: true, connected: s.exists, displayName: s.exists ? s.data().displayName || "" : "", presets: PRESETS };
  },

  async connect({ uid, req, body }) {
    if (!canvaConfigured()) throw fail("Canva isn't set up yet — add CANVA_CLIENT_ID and CANVA_CLIENT_SECRET in Vercel.", 503);
    const { verifier, challenge } = pkce();
    const state = randomId(32);
    const redirect = redirectUri(req);
    await adb().doc(`canvaStates/${state}`).set({ type: "oauth", uid, verifier, redirectUri: redirect, returnTo: safeReturn(body.returnTo), createdAt: Date.now() });
    const q = new URLSearchParams({
      code_challenge: challenge, code_challenge_method: "S256", scope: SCOPES, response_type: "code",
      client_id: process.env.CANVA_CLIENT_ID, state, redirect_uri: redirect,
    });
    return { url: `${AUTHORIZE_URL}?${q}` };
  },

  async disconnect({ uid }) {
    const ref = adb().doc(`canvaTokens/${uid}`);
    const s = await ref.get();
    if (s.exists) {
      try { // best effort revoke at Canva
        const basic = Buffer.from(`${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`).toString("base64");
        await fetch(`${CANVA_API}/oauth/revoke`, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: open(s.data().refresh) }).toString() });
      } catch { /* ignore */ }
      await ref.delete();
    }
    return { ok: true };
  },

  /** The member's own Canva designs (past files) — nothing is copied into AMAL. */
  async designs({ uid, body }) {
    const q = new URLSearchParams({ limit: "24", sort_by: body.query ? "relevance" : "modified_descending" });
    if (body.query) q.set("query", String(body.query).slice(0, 255));
    if (body.continuation) q.set("continuation", String(body.continuation));
    const j = await canva(uid, `/designs?${q}`);
    return {
      items: (j.items || []).map((d) => ({ id: d.id, title: d.title || "Untitled design", thumb: d.thumbnail?.url || "", width: d.thumbnail?.width, height: d.thumbnail?.height, updatedAt: (d.updated_at || 0) * 1000, pages: d.page_count || 1, types: d.design_types || [] })),
      continuation: j.continuation || null,
    };
  },

  /** New blank design at a poster / video size, opened with return navigation back to AMAL. */
  async create({ uid, member, body }) {
    if (!canMedia(member)) throw fail("Media creation is for the Admin, Club Representatives, Team Leads and the Media & Design team.", 403);
    const p = PRESETS[body.preset]; if (!p) throw fail("Unknown size.");
    const ev = await adb().doc(`events/${body.eventId}`).get();
    if (!ev.exists) throw fail("Choose an event first.");
    const title = `${ev.data().name} · ${p.label}`.slice(0, 255);
    const j = await canva(uid, "/designs", { method: "POST", body: { design_type: { type: "custom", width: p.w, height: p.h }, title } });
    const sid = randomId(20);
    await adb().doc(`canvaStates/${sid}`).set({ type: "design", uid, eventId: body.eventId, kind: p.kind, preset: body.preset, designId: j.design.id, createdAt: Date.now() });
    return { designId: j.design.id, editUrl: withCorrelation(j.design.urls?.edit_url, sid) };
  },

  /** Reopen any of the member's designs for an event (fresh edit URL, return navigation on). */
  async open({ uid, member, body }) {
    if (!canMedia(member)) throw fail("Not allowed.", 403);
    const j = await canva(uid, `/designs/${encodeURIComponent(body.designId)}`);
    const sid = randomId(20);
    await adb().doc(`canvaStates/${sid}`).set({ type: "design", uid, eventId: body.eventId || null, kind: body.kind === "video" ? "video" : "poster", preset: null, designId: j.design.id, createdAt: Date.now() });
    return { editUrl: withCorrelation(j.design.urls?.edit_url, sid) };
  },

  /** Verifies Canva's correlation_jwt when the member presses "Return" in the Canva editor. */
  async return({ uid, body }) {
    if (!body.jwt) throw fail("Missing Canva return token.");
    const { payload } = await jwtVerify(String(body.jwt), JWKS, { audience: process.env.CANVA_CLIENT_ID }).catch(() => { throw fail("Canva return link is invalid or expired.", 401); });
    if (payload.type !== "rti") throw fail("Unexpected Canva token.", 401);
    const tok = (await adb().doc(`canvaTokens/${uid}`).get()).data();
    if (tok?.canvaUserId && payload.sub && tok.canvaUserId !== payload.sub) throw fail("This Canva design belongs to a different Canva account than the one connected here.", 403);
    let session = null;
    if (payload.correlation_state) {
      const s = await adb().doc(`canvaStates/${String(payload.correlation_state).replace(/[^A-Za-z0-9]/g, "")}`).get();
      if (s.exists && s.data().uid === uid) session = s.data();
    }
    const d = await canva(uid, `/designs/${encodeURIComponent(payload.design_id)}`);
    return {
      designId: d.design.id, title: d.design.title || "Untitled design", thumb: d.design.thumbnail?.url || "", pages: d.design.page_count || 1,
      eventId: session?.eventId || null, kind: session?.kind || "poster", preset: session?.preset || null,
    };
  },

  async designInfo({ uid, body }) {
    const d = await canva(uid, `/designs/${encodeURIComponent(body.designId)}`);
    return { designId: d.design.id, title: d.design.title || "Untitled design", thumb: d.design.thumbnail?.url || "", pages: d.design.page_count || 1 };
  },

  /** Starts an export at the size/format the member picks (Canva enforces their plan's limits). */
  async export({ uid, body }) {
    const t = String(body.type || "png");
    let format;
    if (t === "png") format = { type: "png", ...(body.width ? { width: Number(body.width) } : {}), ...(body.height ? { height: Number(body.height) } : {}), ...(body.pages ? { pages: body.pages } : {}) };
    else if (t === "jpg") format = { type: "jpg", quality: Math.min(100, Math.max(1, Number(body.quality) || 92)), ...(body.width ? { width: Number(body.width) } : {}), ...(body.height ? { height: Number(body.height) } : {}), ...(body.pages ? { pages: body.pages } : {}) };
    else if (t === "pdf") format = { type: "pdf", ...(body.pages ? { pages: body.pages } : {}) };
    else if (t === "gif") format = { type: "gif", ...(body.pages ? { pages: body.pages } : {}) };
    else if (t === "mp4") format = { type: "mp4", quality: /^(horizontal|vertical)_(480p|720p|1080p|4k)$/.test(body.quality) ? body.quality : "vertical_1080p" };
    else throw fail("Unsupported format.");
    if (body.pro) format.export_quality = "pro";
    const j = await canva(uid, "/exports", { method: "POST", body: { design_id: String(body.designId), format } });
    return { jobId: j.job.id, status: j.job.status, urls: j.job.urls || [] };
  },

  async exportStatus({ uid, body }) {
    const j = await canva(uid, `/exports/${encodeURIComponent(body.jobId)}`);
    return { status: j.job.status, urls: j.job.urls || [], error: j.job.error?.message || null };
  },

  /** Puts the event's registration QR, AMAL logo and banner into the member's Canva uploads. */
  /** Puts the event's registration QR, AMAL logo and banner into the member's Canva (they land in Projects). */
  async assets({ uid, member, req, body }) {
    if (!canMedia(member)) throw fail("Not allowed.", 403);
    const s = await adb().doc(`events/${body.eventId}`).get();
    if (!s.exists) throw fail("Event not found.");
    const ev = s.data(); const site = siteUrl(req);
    const files = [];
    files.push({ name: `${ev.name} – registration QR`, kind: "qr", type: "image", preview: null, buf: await QRCode.toBuffer(`${site}/form/${ev.slug}`, { width: 1200, margin: 2, color: { dark: "#12050a", light: "#ffffff" } }) });
    const grab = async (url, name, kind) => { try { const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); if (r.ok) files.push({ name, kind, type: "image", preview: url, buf: Buffer.from(await r.arrayBuffer()) }); } catch { /* skip */ } };
    await grab(`${site}/amal-logo.jpg`, "AMAL logo", "logo");
    if (ev.bannerUrl) await grab(ev.bannerUrl, `${ev.name} – banner`, "banner");
    return uploadToCanva(uid, ev, files, 25000);
  },

  /** Sends a poster or video already saved to the event into the member's Canva, so they can keep editing it there. */
  async sendMedia({ uid, member, body }) {
    if (!canMedia(member)) throw fail("Not allowed.", 403);
    const ms = await adb().doc(`media/${body.mediaId}`).get();
    if (!ms.exists || ms.data().status === "removed") throw fail("That file isn't on the event any more.");
    const m = ms.data();
    if (!/^https:\/\/res\.cloudinary\.com\//.test(m.url)) throw fail("Only files stored by AMAL can be sent.");
    if (/\.pdf($|\?)/i.test(m.url)) throw fail("PDFs can't be added to Canva as an upload — send the PNG/JPG version instead.");
    const r = await fetch(m.url, { signal: AbortSignal.timeout(40000) });
    if (!r.ok) throw fail("Couldn't fetch the file from storage.", 502);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 100 * 1048576) throw fail("This file is over 100 MB — too big to send to Canva.");
    const ev = { slug: m.eventId, name: m.eventName };
    return uploadToCanva(uid, ev, [{ name: m.title || (m.kind === "video" ? `${m.eventName} video` : `${m.eventName} poster`), kind: "media", mediaId: m.id, type: m.kind === "video" ? "video" : "image", preview: m.kind === "video" ? m.thumbUrl || null : m.url, buf }], m.kind === "video" ? 35000 : 20000);
  },

  /** Re-checks an upload Canva was still processing (videos can take a while). */
  async assetStatus({ uid, body }) {
    const ref = adb().doc(`canvaAssets/${String(body.id).replace(/[^A-Za-z0-9]/g, "")}`);
    const s = await ref.get();
    if (!s.exists || s.data().uid !== uid) throw fail("Not found.", 404);
    const a = s.data();
    if (a.status !== "in_progress") return { status: a.status };
    const j = await canva(uid, `/asset-uploads/${encodeURIComponent(a.jobId)}`);
    const patch = { status: j.job.status, assetId: j.job.asset?.id || null, error: j.job.error?.message || null, updatedAt: Date.now() };
    await ref.update(patch);
    return patch;
  },

  /** Deletes something AMAL put into the member's Canva (Canva moves it to their Trash; designs already using it keep it). */
  async deleteAsset({ uid, body }) {
    const ref = adb().doc(`canvaAssets/${String(body.id).replace(/[^A-Za-z0-9]/g, "")}`);
    const s = await ref.get();
    if (!s.exists || s.data().uid !== uid) throw fail("Not found.", 404);
    let a = s.data();
    if (a.status === "in_progress" && a.jobId) {
      const j = await canva(uid, `/asset-uploads/${encodeURIComponent(a.jobId)}`).catch(() => null);
      if (j?.job?.asset?.id) a = { ...a, assetId: j.job.asset.id };
    }
    if (a.assetId) {
      const token = await accessToken(uid);
      const r = await fetch(`${CANVA_API}/assets/${encodeURIComponent(a.assetId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
      if (!r.ok && r.status !== 404) { const j = await r.json().catch(() => ({})); throw fail(j.message || `Canva couldn't delete it (${r.status}).`, r.status === 403 ? 403 : 502); }
    }
    await ref.delete();
    return { ok: true };
  },
};

/** Upload files to the member's Canva, wait for processing (up to `waitMs`) and record each one in canvaAssets. */
async function uploadToCanva(uid, ev, files, waitMs) {
  const token = await accessToken(uid);
  const headers = { Authorization: `Bearer ${token}` };
  const jobs = [];
  for (const f of files) {
    const r = await fetch(`${CANVA_API}/asset-uploads`, {
      method: "POST", signal: AbortSignal.timeout(50000),
      headers: { ...headers, "Content-Type": "application/octet-stream", "Asset-Upload-Metadata": JSON.stringify({ name_base64: Buffer.from(f.name.slice(0, 50)).toString("base64") }) },
      body: f.buf,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 403) throw fail("Canva refused the upload — make sure the 'asset' Read + Write scopes are ticked in the Canva portal, then Disconnect and Connect Canva again.", 403);
      jobs.push({ f, error: j.message || `Canva error ${r.status}`, status: "failed" });
    } else jobs.push({ f, id: j.job?.id, status: j.job?.status, assetId: j.job?.asset?.id || null, error: j.job?.error?.message });
  }
  // Canva processes uploads in the background — wait for each job (videos may still be processing afterwards)
  const t0 = Date.now();
  while (jobs.some((j) => j.status === "in_progress") && Date.now() - t0 < waitMs) {
    await new Promise((res) => setTimeout(res, 1500));
    for (const j of jobs.filter((x) => x.status === "in_progress")) {
      const r = await fetch(`${CANVA_API}/asset-uploads/${encodeURIComponent(j.id)}`, { headers, signal: AbortSignal.timeout(15000) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { j.status = d.job?.status; j.assetId = d.job?.asset?.id || null; j.error = d.job?.error?.message; }
    }
  }
  // remember what AMAL sent so the member can delete it later from the app
  const db = adb();
  for (const j of jobs.filter((x) => x.status === "success" || x.status === "in_progress")) {
    const ref = db.collection("canvaAssets").doc();
    await ref.set({ id: ref.id, uid, eventId: ev.slug, eventName: ev.name || "", name: j.f.name.slice(0, 50), kind: j.f.kind, type: j.f.type, mediaId: j.f.mediaId || null,
      preview: j.f.preview || null, jobId: j.id || null, assetId: j.assetId || null, status: j.status, createdAt: Date.now() });
  }
  const names = (st) => jobs.filter((j) => j.status === st).map((j) => j.f.name);
  return {
    sent: names("success").length, total: files.length, done: names("success"), pending: names("in_progress"),
    failed: jobs.filter((j) => j.status !== "success" && j.status !== "in_progress").map((j) => ({ name: j.f.name, error: j.error || "upload failed" })),
  };
}

const post = handler(async (req) => {
  const action = String(req.query?.action || "");
  const fn = actions[action];
  if (!fn) throw fail("Unknown Canva action.", 404);
  const { uid, member } = await authed(req);
  if (!RANK[member.role]) throw fail("Not allowed.", 403);
  return fn({ uid, member, req, body: req.body || {} });
});

export default async function route(req, res) {
  if (req.method === "GET" && req.query?.action === "callback") {
    try { return await callback(req, res); } catch (e) { console.error(e); res.statusCode = 302; res.setHeader("Location", "/dashboard/media?canva=error"); return res.end(); }
  }
  return post(req, res);
}
