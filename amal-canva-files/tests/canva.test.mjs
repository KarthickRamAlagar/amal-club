// End-to-end test of api/canva/[action].js against the Auth + Firestore emulators with a mocked Canva API.
// Run: npx firebase-tools emulators:exec --only firestore,auth --project amal-test "node tests/canva.test.mjs"
import crypto from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8085";
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = "amal-test";
const { privateKey: saKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ type: "service_account", project_id: "amal-test", client_email: "test@amal-test.iam.gserviceaccount.com", private_key: saKey });
process.env.CANVA_CLIENT_ID = "OC-test-client";
process.env.CANVA_CLIENT_SECRET = "test-secret";
process.env.SITE_URL = "https://amal.test";

let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log("  ✓", name); } catch (e) { fail++; console.log("  ✗", name, "→", e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };

// ── mock Canva ──
const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
const canvaCalls = [];
let tokenN = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith("https://res.cloudinary.com/")) return new Response(Buffer.from("FAKEVIDEOBYTES"), { status: 200 });
  if (!u.startsWith("https://api.canva.com")) return realFetch(url, init);
  const path = u.replace("https://api.canva.com/rest/v1", "");
  canvaCalls.push({ path, method: init.method || "GET", headers: init.headers, body: init.body });
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
  const auth = init.headers?.Authorization || "";
  if (path === "/connect/keys") return json({ keys: [jwk] });
  if (path === "/oauth/token") {
    const p = new URLSearchParams(init.body);
    if (!auth.startsWith("Basic ")) return json({ error: "invalid_client" }, 401);
    if (p.get("grant_type") === "authorization_code" && p.get("code") === "good-code" && p.get("code_verifier")?.length >= 43) { tokenN++; return json({ access_token: `at${tokenN}`, refresh_token: `rt${tokenN}`, expires_in: 14400, token_type: "Bearer" }); }
    if (p.get("grant_type") === "refresh_token" && p.get("refresh_token") === `rt${tokenN}`) { tokenN++; return json({ access_token: `at${tokenN}`, refresh_token: `rt${tokenN}`, expires_in: 14400, token_type: "Bearer" }); }
    return json({ error: "invalid_grant" }, 400);
  }
  if (path === "/oauth/revoke") return json({});
  if (!auth.startsWith(`Bearer at${tokenN}`)) return json({ message: "Unauthorized" }, 401);
  if (path === "/users/me") return json({ team_user: { user_id: "UCANVA1", team_id: "TCANVA1" } });
  if (path === "/users/me/profile") return json({ profile: { display_name: "Media One" } });
  if (path.startsWith("/designs?")) return json({ items: [{ id: "DAF1", title: "Mock poster", thumbnail: { url: "https://x/t.png", width: 400, height: 500 }, updated_at: 1700000000, page_count: 2, design_types: ["custom"] }], continuation: "NEXT" });
  if (path === "/designs" && init.method === "POST") { const b = JSON.parse(init.body); return json({ design: { id: "DNEW", title: b.title, urls: { edit_url: "https://www.canva.com/api/design/tok123/edit", view_url: "v" }, thumbnail: null } }); }
  if (path.startsWith("/designs/")) return json({ design: { id: path.split("/")[2], title: "Mock poster", urls: { edit_url: "https://www.canva.com/api/design/tok456/edit" }, thumbnail: { url: "https://x/t.png" }, page_count: 2 } });
  if (path === "/exports" && init.method === "POST") { const b = JSON.parse(init.body); return json({ job: { id: "EXP1", status: "in_progress", _format: b.format } }); }
  if (path === "/exports/EXP1") return json({ job: { id: "EXP1", status: "success", urls: ["https://export-download.canva.com/a.png"] } });
  if (path === "/asset-uploads") { const n = canvaCalls.filter((c) => c.path === "/asset-uploads").length; return json({ job: { id: `AU${n}`, status: "in_progress" } }); }
  if (path.startsWith("/assets/") && init.method === "DELETE") return new Response(null, { status: 204 });
  if (path.startsWith("/asset-uploads/")) { const id = path.split("/")[2]; return id === "AU99" ? json({ job: { id, status: "failed", error: { code: "import_failed", message: "Could not import" } } }) : json({ job: { id, status: "success", asset: { id: "A" + id } } }); }
  return json({ message: `unmocked ${path}` }, 404);
};

// ── emulator user + member ──
const { initializeApp, getApps } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
const { getAuth } = await import("firebase-admin/auth");
if (!getApps().length) initializeApp({ projectId: "amal-test" });
const db = getFirestore(); const auth = getAuth();
async function user(id, role, team) {
  const email = `${id}@canva.test`;
  let u; try { u = await auth.createUser({ email, password: "password123" }); } catch { u = await auth.getUserByEmail(email); }
  await db.doc(`members/${u.uid}`).set({ uid: u.uid, name: id, email, role, team, designation: role, status: "active", onboarded: true });
  const r = await realFetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "password123", returnSecureToken: true }) });
  return { uid: u.uid, token: (await r.json()).idToken };
}
const media = await user("media1", "member", "media");
const outreach = await user("outreach1", "member", "outreach");
await db.doc("media/vid1").set({ id: "vid1", eventId: "demo-event", eventName: "Demo Event", kind: "video", source: "studio", title: "Demo reel", url: "https://res.cloudinary.com/demo/video/upload/v1/reel.mp4", thumbUrl: "https://res.cloudinary.com/demo/video/upload/so_1/reel.jpg", status: "active", visibility: "public" });
await db.doc("events/demo-event").set({ slug: "demo-event", name: "Demo Event", bannerUrl: "", startAt: Date.now() + 86400000 });

const route = (await import("../api/canva/[action].js")).default;
function call(action, { token, body, method = "POST", query = {} } = {}) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, headers: {}, headersSent: false,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; },
      json(o) { this.headersSent = true; resolve({ status: this.statusCode, body: o, headers: this.headers }); }, end() { resolve({ status: this.statusCode, headers: this.headers }); } };
    route({ method, query: { action, ...query }, headers: { authorization: token ? `Bearer ${token}` : "", host: "amal.test" }, body }, res);
  });
}

console.log("Canva integration");
await t("requires sign-in", async () => { const r = await call("status"); assert(r.status === 401, r.status); });
await t("status: configured, not connected", async () => { const r = await call("status", { token: media.token, body: {} }); assert(r.body.configured && !r.body.connected, JSON.stringify(r.body)); });
let state;
await t("connect returns a PKCE authorize URL and stores one-time state", async () => {
  const r = await call("connect", { token: media.token, body: { returnTo: "/dashboard/media?event=demo-event" } });
  const u = new URL(r.body.url); state = u.searchParams.get("state");
  assert(u.origin + u.pathname === "https://www.canva.com/api/oauth/authorize");
  assert(u.searchParams.get("code_challenge_method") === "S256" && u.searchParams.get("code_challenge").length === 43, "pkce");
  assert(u.searchParams.get("redirect_uri") === "https://amal.test/api/canva/callback", u.searchParams.get("redirect_uri"));
  assert(u.searchParams.get("scope").includes("design:content:write"));
  assert((await db.doc(`canvaStates/${state}`).get()).exists, "state saved");
});
await t("connect rejects an off-site returnTo", async () => {
  const r = await call("connect", { token: media.token, body: { returnTo: "//evil.example" } });
  const s = new URL(r.body.url).searchParams.get("state");
  assert((await db.doc(`canvaStates/${s}`).get()).data().returnTo === "/dashboard/media");
});
await t("callback with a bad state is refused", async () => { const r = await call("callback", { method: "GET", query: { code: "good-code", state: "nope" } }); assert(r.status === 302 && r.headers.location.includes("canva=error")); });
await t("callback exchanges the code, stores encrypted tokens, redirects back", async () => {
  const r = await call("callback", { method: "GET", query: { code: "good-code", state } });
  assert(r.status === 302 && r.headers.location === "https://amal.test/dashboard/media?event=demo-event&canva=connected", r.headers.location);
  const d = (await db.doc(`canvaTokens/${media.uid}`).get()).data();
  assert(d && !String(d.access).includes("at1") && !String(d.refresh).includes("rt1"), "tokens must be encrypted");
  assert(d.canvaUserId === "UCANVA1" && d.displayName === "Media One");
  assert(!(await db.doc(`canvaStates/${state}`).get()).exists, "state is single-use");
});
await t("state cannot be replayed", async () => { const r = await call("callback", { method: "GET", query: { code: "good-code", state } }); assert(r.headers.location.includes("canva=error")); });
await t("status: connected with name", async () => { const r = await call("status", { token: media.token, body: {} }); assert(r.body.connected && r.body.displayName === "Media One"); });
await t("lists the member's own designs", async () => { const r = await call("designs", { token: media.token, body: {} }); assert(r.body.items[0].id === "DAF1" && r.body.items[0].pages === 2 && r.body.continuation === "NEXT"); });
let editUrl;
await t("creates a poster design at the preset size with return navigation", async () => {
  const r = await call("create", { token: media.token, body: { preset: "instagram-post", eventId: "demo-event" } });
  editUrl = r.body.editUrl; assert(/\/edit\?correlation_state=[A-Za-z0-9]{20}$/.test(editUrl), editUrl);
  const sent = JSON.parse(canvaCalls.findLast((c) => c.path === "/designs" && c.method === "POST").body);
  assert(sent.design_type.width === 1080 && sent.design_type.height === 1350 && sent.design_type.type === "custom", JSON.stringify(sent));
});
await t("outreach member cannot create designs", async () => {
  // connect them quickly by planting tokens via a real flow is unnecessary — rights are checked first
  const r = await call("create", { token: outreach.token, body: { preset: "reel", eventId: "demo-event" } }); assert(r.status === 403, r.status);
});
await t("unknown event is rejected", async () => { const r = await call("create", { token: media.token, body: { preset: "reel", eventId: "missing" } }); assert(r.status === 400); });
await t("return: verifies Canva's JWT and restores the event", async () => {
  const cs = new URL(editUrl).searchParams.get("correlation_state");
  const jwt = await new SignJWT({ type: "rti", design_id: "DNEW", correlation_state: cs, team_id: "TCANVA1" }).setProtectedHeader({ alg: "RS256", kid: "k1" }).setAudience("OC-test-client").setSubject("UCANVA1").setExpirationTime("1d").sign(privateKey);
  const r = await call("return", { token: media.token, body: { jwt } });
  assert(r.status === 200 && r.body.eventId === "demo-event" && r.body.kind === "poster" && r.body.designId === "DNEW", JSON.stringify(r.body));
});
await t("return: forged JWT rejected", async () => {
  const { privateKey: other } = await generateKeyPair("RS256");
  const jwt = await new SignJWT({ type: "rti", design_id: "DNEW" }).setProtectedHeader({ alg: "RS256", kid: "k1" }).setAudience("OC-test-client").setSubject("UCANVA1").setExpirationTime("1d").sign(other);
  const r = await call("return", { token: media.token, body: { jwt } }); assert(r.status === 401, r.status);
});
await t("return: JWT for a different Canva user rejected", async () => {
  const jwt = await new SignJWT({ type: "rti", design_id: "DNEW" }).setProtectedHeader({ alg: "RS256", kid: "k1" }).setAudience("OC-test-client").setSubject("USOMEONEELSE").setExpirationTime("1d").sign(privateKey);
  const r = await call("return", { token: media.token, body: { jwt } }); assert(r.status === 403, r.status);
});
await t("export: PNG at a chosen width, then poll to success", async () => {
  const r = await call("export", { token: media.token, body: { designId: "DAF1", type: "png", width: 1600, pages: [1] } });
  assert(r.body.jobId === "EXP1");
  const sent = JSON.parse(canvaCalls.findLast((c) => c.path === "/exports").body);
  assert(sent.format.type === "png" && sent.format.width === 1600 && sent.format.pages[0] === 1, JSON.stringify(sent));
  const s = await call("exportStatus", { token: media.token, body: { jobId: "EXP1" } }); assert(s.body.status === "success" && s.body.urls.length === 1);
});
await t("export: MP4 quality is validated", async () => {
  await call("export", { token: media.token, body: { designId: "DAF1", type: "mp4", quality: "bogus" } });
  const sent = JSON.parse(canvaCalls.findLast((c) => c.path === "/exports").body); assert(sent.format.quality === "vertical_1080p");
});
await t("expired access token is refreshed (single-use refresh token rotated)", async () => {
  await db.doc(`canvaTokens/${media.uid}`).update({ expiresAt: Date.now() - 1000 });
  const before = tokenN;
  const r = await call("designs", { token: media.token, body: {} });
  assert(r.status === 200 && tokenN === before + 1, `status ${r.status} tokenN ${tokenN}`);
});
await t("event QR + logo pushed into Canva uploads, waiting for each job to finish", async () => {
  const r = await call("assets", { token: media.token, body: { eventId: "demo-event" } });
  const up = canvaCalls.filter((c) => c.path === "/asset-uploads");
  assert(r.status === 200 && r.body.total >= 1 && up.length >= 1, JSON.stringify(r.body));
  assert(r.body.done.length + r.body.failed.length === r.body.total, "every job resolved: " + JSON.stringify(r.body));
  if (r.body.total >= 2) assert(r.body.failed[0]?.error === "Could not import", "failure reason surfaced");
  assert(JSON.parse(up[0].headers["Asset-Upload-Metadata"]).name_base64, "metadata header");
});
await t("everything sent is recorded for the member (so it can be deleted later)", async () => {
  const q = await db.collection("canvaAssets").where("uid", "==", media.uid).get();
  assert(q.size >= 1 && q.docs.every((d) => d.data().eventId === "demo-event" && d.data().assetId), `records ${q.size}`);
});
let videoRec;
await t("an event video is sent to Canva and recorded as a video", async () => {
  const r = await call("sendMedia", { token: media.token, body: { mediaId: "vid1" } });
  assert(r.status === 200 && r.body.sent === 1, JSON.stringify(r.body));
  const q = await db.collection("canvaAssets").where("mediaId", "==", "vid1").get();
  videoRec = q.docs[0]?.data(); assert(videoRec?.type === "video" && videoRec.uid === media.uid, JSON.stringify(videoRec));
  const up = canvaCalls.findLast((c) => c.path === "/asset-uploads" && c.method === "POST");
  assert(up.headers["Content-Type"] === "application/octet-stream" && String(up.body) === "FAKEVIDEOBYTES", "uploads the real file bytes");
});
await t("a member without media rights can't send event media", async () => { const r = await call("sendMedia", { token: outreach.token, body: { mediaId: "vid1" } }); assert(r.status === 403, r.status); });
await t("nobody else can delete my Canva file", async () => { const r = await call("deleteAsset", { token: outreach.token, body: { id: videoRec.id } }); assert(r.status === 404, r.status); });
await t("delete removes it from Canva (to Trash) and from the list", async () => {
  const r = await call("deleteAsset", { token: media.token, body: { id: videoRec.id } });
  assert(r.status === 200, r.status);
  const del = canvaCalls.findLast((c) => c.method === "DELETE");
  assert(del && del.path === `/assets/${videoRec.assetId}`, JSON.stringify(del));
  assert(!(await db.doc(`canvaAssets/${videoRec.id}`).get()).exists, "record removed");
});
await t("disconnect removes stored tokens", async () => { await call("disconnect", { token: media.token, body: {} }); assert(!(await db.doc(`canvaTokens/${media.uid}`).get()).exists); });
await t("after disconnect, API asks to connect again", async () => { const r = await call("designs", { token: media.token, body: {} }); assert(r.status === 409, r.status); });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
