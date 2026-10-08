// Canva Connect API helpers — tokens never leave the server.
import crypto from "node:crypto";
import { adb } from "./admin.js";

export const CANVA_API = "https://api.canva.com/rest/v1";
export const AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
export const SCOPES = [
  "design:meta:read", "design:content:read", "design:content:write",
  "asset:read", "asset:write", "profile:read",
].join(" ");

export const canvaConfigured = () => Boolean(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET);
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });

export function siteUrl(req) {
  const env = (process.env.SITE_URL || process.env.VITE_SITE_URL || "").replace(/\/$/, "");
  if (env) return env;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}`;
}
export const redirectUri = (req) => process.env.CANVA_REDIRECT_URI || `${siteUrl(req)}/api/canva/callback`;

// ── PKCE ──
const b64url = (buf) => Buffer.from(buf).toString("base64url");
export function pkce() {
  const verifier = b64url(crypto.randomBytes(48)); // 64 chars, within 43–128
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}
export const randomId = (n = 24) => b64url(crypto.randomBytes(n)).replace(/[^A-Za-z0-9]/g, "").slice(0, n);

// ── token encryption at rest (AES-256-GCM, key derived from the client secret or CANVA_TOKEN_KEY) ──
function key() {
  const k = process.env.CANVA_TOKEN_KEY || `${process.env.CANVA_CLIENT_SECRET}:amal-canva-tokens`;
  return crypto.createHash("sha256").update(k).digest();
}
export function seal(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}
export function open(sealed) {
  const [iv, tag, enc] = String(sealed).split(".").map((s) => Buffer.from(s, "base64url"));
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

// ── OAuth token endpoint ──
async function tokenRequest(params) {
  const basic = Buffer.from(`${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`).toString("base64");
  const r = await fetch(`${CANVA_API}/oauth/token`, {
    method: "POST", signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error_description || j.message || j.error || `Canva token error ${r.status}`), { status: r.status === 400 ? 401 : 502, code: j.error });
  return j;
}
export const exchangeCode = (code, verifier, redirect) =>
  tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirect });

export async function saveTokens(uid, t, extra = {}) {
  await adb().doc(`canvaTokens/${uid}`).set({
    access: seal(t.access_token), refresh: seal(t.refresh_token),
    expiresAt: Date.now() + (Number(t.expires_in) || 14400) * 1000,
    scope: t.scope || SCOPES, updatedAt: Date.now(), ...extra,
  }, { merge: true });
}

/** A valid access token for this member (refreshes when needed). Refresh tokens are single-use. */
export async function accessToken(uid) {
  const ref = adb().doc(`canvaTokens/${uid}`);
  const s = await ref.get();
  if (!s.exists) throw fail("Connect your Canva account first.", 409);
  const d = s.data();
  if (d.expiresAt - 60000 > Date.now()) return open(d.access);
  try {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: open(d.refresh) });
    await saveTokens(uid, t);
    return t.access_token;
  } catch (e) {
    // another request may have refreshed at the same moment — use its token
    const again = (await ref.get()).data();
    if (again && again.updatedAt !== d.updatedAt && again.expiresAt - 60000 > Date.now()) return open(again.access);
    if (e.status === 401) { await ref.delete(); throw fail("Your Canva sign-in expired. Connect Canva again.", 409); }
    throw e;
  }
}

/** Calls the Canva REST API as this member. */
export async function canva(uid, path, { method = "GET", body, headers = {}, raw = false } = {}) {
  const token = await accessToken(uid);
  const r = await fetch(`${CANVA_API}${path}`, {
    method, signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${token}`, ...(body && !raw ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { await adb().doc(`canvaTokens/${uid}`).delete(); throw fail("Canva disconnected — connect again.", 409); }
  if (!r.ok) throw fail(j.message || j.error || `Canva error ${r.status}`, r.status === 429 ? 429 : r.status >= 500 ? 502 : 400);
  return j;
}

export function withCorrelation(editUrl, state) {
  if (!editUrl) return editUrl;
  return `${editUrl}${editUrl.includes("?") ? "&" : "?"}correlation_state=${encodeURIComponent(state)}`;
}

// Poster / video sizes (px). Canva custom designs allow 40–8000 px per side.
export const PRESETS = {
  "instagram-post": { kind: "poster", w: 1080, h: 1350, label: "Instagram post (4:5)" },
  "instagram-square": { kind: "poster", w: 1080, h: 1080, label: "Instagram square (1:1)" },
  "instagram-story": { kind: "poster", w: 1080, h: 1920, label: "Instagram story (9:16)" },
  "linkedin-post": { kind: "poster", w: 1200, h: 1200, label: "LinkedIn post (1:1)" },
  "linkedin-landscape": { kind: "poster", w: 1200, h: 627, label: "LinkedIn landscape" },
  "a4-poster": { kind: "poster", w: 2480, h: 3508, label: "A4 print poster" },
  "reel": { kind: "video", w: 1080, h: 1920, label: "Reel / Short (9:16)" },
  "video-square": { kind: "video", w: 1080, h: 1080, label: "Square video (1:1)" },
  "video-landscape": { kind: "video", w: 1920, h: 1080, label: "Landscape video (16:9)" },
};
