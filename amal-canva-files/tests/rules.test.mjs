import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, writeBatch, serverTimestamp, increment, collection, addDoc, getDocs, query, where } from "firebase/firestore";
import fs from "node:fs";

const env = await initializeTestEnvironment({ projectId: "amal-test", firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8085 } });
let pass = 0, fail = 0;
async function t(name, p) { try { await p; pass++; console.log("  ✓", name); } catch (e) { fail++; console.log("  ✗", name, "→", e.message.split("\n")[0].slice(0, 160)); } }
const ok = (n, p) => t(n, assertSucceeds(p)); const no = (n, p) => t(n, assertFails(p));
const ctx = (uid, email) => env.authenticatedContext(uid, { email }).firestore();
const DAY = 86400000, now = Date.now();
const snap = (uid, role, team = null) => ({ uid, name: uid, email: `${uid}@x.com`, photoUrl: "", amalId: uid, role, rank: { admin: 100, president: 80, vp: 70, treasurer: 70, lead: 40, member: 20 }[role], designation: role, team, teamName: team || "Core" });
const member = (uid, role, team = null) => ({ uid, name: uid, email: `${uid}@x.com`, role, team, designation: role, amalId: uid, status: "active", onboarded: true });

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  for (const [u, r, tm] of [["pres", "president"], ["vp1", "vp"], ["ttl", "lead", "technical"], ["mtl", "lead", "media"], ["mem", "member", "outreach"], ["media1", "member", "media"], ["docs1", "member", "documentation"], ["docl", "lead", "documentation"]]) await setDoc(doc(db, "members", u), member(u, r, tm));
  await setDoc(doc(db, "members", "newbie"), { ...member("newbie", "member", "outreach"), onboarded: false });
  const ev = (slug, start, extra = {}) => setDoc(doc(db, "events", slug), { slug, name: slug, status: "upcoming", startAt: start, price: 200, teamMin: 2, teamMax: 4, onlineIntake: 2, onspotIntake: 1, onlineCount: 0, onspotCount: 0, createdBy: snap("pres", "president"), ...extra });
  await ev("future", now + 5 * DAY); await ev("tomorrow-closed", now + 30 * 60000 + 0); await ev("full", now + 5 * DAY, { onlineCount: 2 });
  await setDoc(doc(db, "grantCodes", "TTL-AMAL-1234"), { code: "TTL-AMAL-1234", requestId: "rq1", scope: "form", requesterUid: "mem", used: false, revoked: false, expiresAt: now + DAY, issuedBy: snap("ttl", "lead", "technical") });
  await setDoc(doc(db, "requests", "rq1"), { id: "rq1", scope: "form", status: "allowed", requester: snap("mem", "member", "outreach"), decidedBy: { ...snap("ttl", "lead", "technical"), approverType: "ttl" }, approvals: [] });
  await setDoc(doc(db, "requests", "rq2"), { id: "rq2", scope: "poster", status: "pending", requester: snap("mem", "member", "outreach"), approvals: [] });
  await setDoc(doc(db, "registrations", "future_other"), { id: "future_other", eventId: "future", uid: "other", status: "pending_payment", mode: "online" });
  await setDoc(doc(db, "logs", "lf"), { scope: "forms", type: "form.create", actor: snap("ttl", "lead", "technical") });
  await setDoc(doc(db, "logs", "lm"), { scope: "media", type: "media.save", target: { id: "future" }, actor: snap("media1", "member", "media") });
  await setDoc(doc(db, "logs", "le"), { scope: "events", type: "event.update", target: { id: "future" }, actor: snap("pres", "president") });
  await setDoc(doc(db, "logs", "lmem"), { scope: "members", type: "invite.create", target: { id: "x" }, actor: snap("pres", "president") });
  await setDoc(doc(db, "events/future/messages", "msg1"), { type: "text", text: "hi", sender: { uid: "pres" } });
  await setDoc(doc(db, "canvaTokens", "media1"), { access: "sealed", refresh: "sealed" });
});

console.log("Setup / first admin");
{ const db = ctx("admin1", "admin1@x.com"); const b = writeBatch(db);
  b.set(doc(db, "members", "admin1"), { uid: "admin1", name: "Prof", email: "admin1@x.com", role: "admin", team: null, designation: "Faculty Admin", amalId: "admin.amal", status: "active", onboarded: false });
  b.set(doc(db, "amalIds", "admin.amal"), { uid: "admin1", email: "admin1@x.com" }); b.set(doc(db, "config", "setup"), { adminUid: "admin1" });
  await ok("first admin bootstrap", b.commit()); }
{ const db = ctx("hacker", "h@x.com"); const b = writeBatch(db);
  b.set(doc(db, "members", "hacker"), { uid: "hacker", role: "admin", status: "active", onboarded: false }); b.set(doc(db, "config", "setup"), { adminUid: "hacker" });
  await no("second bootstrap blocked", b.commit()); }
{ const db = ctx("admin1", "admin1@x.com");
  await ok("admin completes onboarding", updateDoc(doc(db, "members", "admin1"), { name: "Prof S", bio: "hello world bio", onboarded: true, updatedAt: serverTimestamp() }));
  await no("cannot change own role", updateDoc(doc(db, "members", "admin1"), { role: "president" })); }

console.log("Invites");
await ok("admin invites president", setDoc(doc(ctx("admin1", "admin1@x.com"), "invites", "AMAL-AAAA-BBBB"), { code: "AMAL-AAAA-BBBB", name: "P", email: "p2@x.com", role: "president", team: null, designation: "President", createdBy: snap("admin1", "admin"), used: false, expiresAt: now + 7 * DAY, createdAt: serverTimestamp() }));
await no("lead cannot invite president", setDoc(doc(ctx("ttl", "ttl@x.com"), "invites", "AMAL-CCCC-DDDD"), { code: "AMAL-CCCC-DDDD", name: "X", email: "x@x.com", role: "president", team: null, designation: "President", createdBy: snap("ttl", "lead", "technical"), used: false, expiresAt: now + DAY }));
await no("lead cannot invite into another team", setDoc(doc(ctx("ttl", "ttl@x.com"), "invites", "AMAL-EEEE-FFFF"), { code: "AMAL-EEEE-FFFF", name: "X", email: "x@x.com", role: "member", team: "media", designation: "Team Member", createdBy: snap("ttl", "lead", "technical"), used: false, expiresAt: now + DAY }));
await ok("lead invites member to own team", setDoc(doc(ctx("ttl", "ttl@x.com"), "invites", "AMAL-GGGG-HHHH"), { code: "AMAL-GGGG-HHHH", name: "Y", email: "y@x.com", role: "member", team: "technical", designation: "Team Member", createdBy: snap("ttl", "lead", "technical"), used: false, expiresAt: now + DAY }));
await no("member cannot invite", setDoc(doc(ctx("mem", "mem@x.com"), "invites", "AMAL-IIII-JJJJ"), { code: "AMAL-IIII-JJJJ", name: "Z", email: "z@x.com", role: "member", team: "outreach", designation: "Team Member", createdBy: snap("mem", "member"), used: false, expiresAt: now + DAY }));
const redeem = (uid, email, code) => { const db = ctx(uid, email); const b = writeBatch(db);
  b.set(doc(db, "members", uid), { uid, name: "P", email, role: "president", team: null, designation: "President", amalId: uid, status: "active", onboarded: false, inviteCode: code });
  b.update(doc(db, "invites", code), { used: true, usedBy: uid, usedAt: serverTimestamp() }); return b.commit(); };
await no("redeem with wrong email", redeem("thief", "thief@x.com", "AMAL-AAAA-BBBB"));
await ok("redeem invite with matching email", redeem("p2", "p2@x.com", "AMAL-AAAA-BBBB"));
await no("redeem used invite again", redeem("p3", "p2@x.com", "AMAL-AAAA-BBBB"));

console.log("Events (rank lock)");
const evData = (by) => ({ slug: "ev-x", name: "X", status: "upcoming", startAt: now + 3 * DAY, price: 0, teamMin: 1, teamMax: 1, onlineIntake: 5, onspotIntake: 5, onlineCount: 0, onspotCount: 0, createdBy: by });
await no("member cannot create event", setDoc(doc(ctx("mem"), "events", "ev-x"), evData(snap("mem", "member"))));
await no("VP cannot fake higher rank", setDoc(doc(ctx("vp1"), "events", "ev-x"), evData({ ...snap("vp1", "vp"), rank: 100 })));
await ok("president creates event", setDoc(doc(ctx("pres"), "events", "ev-x"), evData(snap("pres", "president"))));
await no("VP cannot edit president's event", updateDoc(doc(ctx("vp1"), "events", "ev-x"), { name: "hacked" }));
await ok("admin can edit president's event", updateDoc(doc(ctx("admin1", "admin1@x.com"), "events", "ev-x"), { name: "Edited" }));
await ok("team lead can disable event", updateDoc(doc(ctx("ttl"), "events", "ev-x"), { status: "disabled", disabledBy: snap("ttl", "lead", "technical"), disabledAt: serverTimestamp() }));
await no("member cannot disable event", updateDoc(doc(ctx("mem"), "events", "ev-x"), { status: "upcoming" }));

console.log("Registrations");
const reg = (uid, ev, mode = "online", opts = {}) => { const db = ctx(uid, `${uid}@g.com`); const b = writeBatch(db); const id = `${ev}_${uid}`;
  b.set(doc(db, "registrations", id), { id, eventId: ev, eventName: ev, uid, mode, teamName: "T", leader: { name: "L" }, members: [{ name: "M" }], headcount: 2, amount: 200, status: "pending_payment", expiresAt: Date.now() + 5 * 3600000, createdAt: serverTimestamp() });
  if (!opts.noCount) b.update(doc(db, "events", ev), { [mode === "onspot" ? "onspotCount" : "onlineCount"]: increment(1) }); return b.commit(); };
await no("registration without counter blocked", reg("p1", "future", "online", { noCount: true }));
await ok("online registration before deadline", reg("p1", "future"));
await no("cannot register twice", reg("p1", "future"));
await no("online after 11:50 PM deadline", reg("p2x", "tomorrow-closed"));
await ok("on-spot after deadline", reg("p3x", "tomorrow-closed", "onspot"));
await no("on-spot beyond intake", reg("p4x", "tomorrow-closed", "onspot"));
await no("online when full", reg("p5x", "full"));
await no("participant reads another team", getDoc(doc(ctx("p1", "p1@g.com"), "registrations", "future_other")));
await ok("participant reads own", getDoc(doc(ctx("p1", "p1@g.com"), "registrations", "future_p1")));
await ok("AMAL member reads registrations", getDoc(doc(ctx("mem"), "registrations", "future_other")));
await no("participant cannot self-confirm", updateDoc(doc(ctx("p1", "p1@g.com"), "registrations", "future_p1"), { status: "confirmed" }));
await ok("participant sends payment", updateDoc(doc(ctx("p1", "p1@g.com"), "registrations", "future_p1"), { payment: { utr: "123456789012" } }));
await ok("lead confirms payment", updateDoc(doc(ctx("ttl"), "registrations", "future_p1"), { status: "confirmed", decidedBy: snap("ttl", "lead"), decidedAt: serverTimestamp(), decisionNote: "" }));

console.log("Chat");
const msg = (uid, type, extra = {}) => addDoc(collection(ctx(uid, `${uid}@g.com`), "events", "future", "messages"), { type, text: "hi", sender: { uid }, createdAt: serverTimestamp(), ...extra });
await ok("registered team writes", msg("p1", "text"));
await no("stranger cannot write", msg("rando", "text"));
await no("stranger cannot read", getDocs(collection(ctx("rando", "r@g.com"), "events", "future", "messages")));
await no("team cannot share location", msg("p1", "location", { lat: 1, lng: 2 }));
await ok("lead shares location", msg("ttl", "location", { lat: 1, lng: 2 }));
await no("plain member (rank 20) not in chat", msg("mem", "text"));

console.log("Forms + permission codes");
const form = (uid, via, grant = null, extraOps) => { const db = ctx(uid); const b = writeBatch(db); const r = doc(collection(db, "forms"));
  b.set(r, { id: r.id, eventId: "future", eventName: "future", title: "F", description: "", fields: [], status: "in_use", via, grant, createdBy: snap(uid, "member"), createdAt: serverTimestamp() });
  extraOps?.(b, db, r); return b.commit(); };
await no("member cannot create without code", form("mem", "admin"));
await ok("admin creates directly", form("admin1", "admin"));
const day = Math.floor((Date.now() + 19800000) / 86400000);
for (let i = 1; i <= 4; i++) {
  const p = form("pres", "quota", null, (b, db) => b.set(doc(db, "formQuota", "pres"), { day, count: i }));
  await (i <= 3 ? ok : no)(`president quota form #${i}`, p);
}
await no("member code for someone else blocked", form("ttl", "code", { code: "TTL-AMAL-1234", requestId: "rq1" }, (b, db, r) => b.update(doc(db, "grantCodes", "TTL-AMAL-1234"), { used: true, usedBy: "ttl", usedAt: serverTimestamp(), formId: r.id })));
const useCode = () => form("mem", "code", { code: "TTL-AMAL-1234", requestId: "rq1" }, (b, db, r) => { b.update(doc(db, "grantCodes", "TTL-AMAL-1234"), { used: true, usedBy: "mem", usedAt: serverTimestamp(), formId: r.id }); b.update(doc(db, "requests", "rq1"), { status: "used", usedAt: serverTimestamp(), formId: r.id }); });
await ok("member creates with valid one-time code", useCode());
await no("code cannot be reused", useCode());
await no("TTL cannot approve old poster request", updateDoc(doc(ctx("ttl"), "requests", "rq2"), { status: "allowed", decidedBy: snap("ttl", "lead") }));
await no("media lead can no longer approve poster requests", updateDoc(doc(ctx("mtl"), "requests", "rq2"), { status: "allowed", decidedBy: snap("mtl", "lead", "media"), decidedAt: serverTimestamp() }));
await no("poster permission requests are gone", setDoc(doc(ctx("mem"), "requests", "rqp"), { id: "rqp", scope: "poster", status: "pending", requester: snap("mem", "member", "outreach") }));
await no("TTL cannot mint an ADMIN code", setDoc(doc(ctx("ttl"), "grantCodes", "ADMIN-AMAL-9999"), { code: "ADMIN-AMAL-9999", scope: "form", requesterUid: "mem", requestId: "rq9", used: false, revoked: false, expiresAt: now + 3600000, issuedBy: snap("ttl", "lead") }));
await ok("TTL mints TTL code", setDoc(doc(ctx("ttl"), "grantCodes", "TTL-AMAL-4321"), { code: "TTL-AMAL-4321", scope: "form", requesterUid: "mem", requestId: "rq9", used: false, revoked: false, expiresAt: now + 3600000, issuedBy: snap("ttl", "lead") }));

console.log("Event media (Canva / Video Studio / uploads)");
const mediaDoc = (id, by, role, team, extra = {}) => ({ id, eventId: "future", eventName: "future", kind: "poster", source: "canva", format: "png", title: "Poster", url: "https://res.cloudinary.com/demo/image/upload/v1/a.png", thumbUrl: "", visibility: "public", status: "active", canva: { designId: "DAF1" }, createdBy: snap(by, role, team), createdAt: serverTimestamp(), ...extra });
await ok("media member saves a poster to an event", setDoc(doc(ctx("media1"), "media", "m1"), mediaDoc("m1", "media1", "member", "media")));
await ok("any team lead saves a video", setDoc(doc(ctx("ttl"), "media", "m2"), mediaDoc("m2", "ttl", "lead", "technical", { kind: "video", source: "studio", visibility: "internal", url: "https://res.cloudinary.com/demo/video/upload/v1/a.mp4" })));
await no("outreach member cannot save media", setDoc(doc(ctx("mem"), "media", "m3"), mediaDoc("m3", "mem", "member", "outreach")));
await no("non-Cloudinary URL rejected", setDoc(doc(ctx("media1"), "media", "m4"), mediaDoc("m4", "media1", "member", "media", { url: "https://evil.example/x.png" })));
await no("unknown event rejected", setDoc(doc(ctx("media1"), "media", "m5"), mediaDoc("m5", "media1", "member", "media", { eventId: "nope" })));
await no("cannot save as someone else", setDoc(doc(ctx("media1"), "media", "m6"), mediaDoc("m6", "ttl", "lead", "technical")));
await ok("public reads public media", getDoc(doc(env.unauthenticatedContext().firestore(), "media", "m1")));
await no("public cannot read team-only media", getDoc(doc(env.unauthenticatedContext().firestore(), "media", "m2")));
await ok("public lists public media for an event", getDocs(query(collection(env.unauthenticatedContext().firestore(), "media"), where("eventId", "==", "future"), where("visibility", "==", "public"), where("status", "==", "active"))));
await ok("members read team-only media", getDoc(doc(ctx("docs1"), "media", "m2")));
await ok("creator hides their poster", updateDoc(doc(ctx("media1"), "media", "m1"), { visibility: "internal", updatedBy: snap("media1", "member", "media"), updatedAt: serverTimestamp() }));
await no("another member cannot hide it", updateDoc(doc(ctx("docs1"), "media", "m1"), { visibility: "public" }));
await ok("a lead can remove media", updateDoc(doc(ctx("docl"), "media", "m1"), { status: "removed", updatedAt: serverTimestamp() }));
await no("URL can never be changed", updateDoc(doc(ctx("media1"), "media", "m1"), { url: "https://res.cloudinary.com/demo/image/upload/b.png" }));

console.log("Documentation: reports, diary, logs");
const rep = (by, role, team, extra = {}) => ({ eventId: "future", eventName: "future", html: "<h1>Report</h1>", words: 1, createdBy: snap(by, role, team), updatedBy: snap(by, role, team), updatedAt: serverTimestamp(), ...extra });
await ok("documentation member writes the report", setDoc(doc(ctx("docs1"), "reports", "future"), rep("docs1", "member", "documentation")));
await ok("president edits the report", setDoc(doc(ctx("pres"), "reports", "future"), rep("pres", "president")));
await no("outreach member cannot write reports", setDoc(doc(ctx("mem"), "reports", "future"), rep("mem", "member", "outreach")));
await no("report id must match its event", setDoc(doc(ctx("docs1"), "reports", "full"), rep("docs1", "member", "documentation")));
await no("report needs an existing event", setDoc(doc(ctx("docs1"), "reports", "ghost"), rep("docs1", "member", "documentation", { eventId: "ghost" })));
await ok("any member reads reports", getDoc(doc(ctx("ttl"), "reports", "future")));
await no("public cannot read reports", getDoc(doc(env.unauthenticatedContext().firestore(), "reports", "future")));
const note = (by, role, team, extra = {}) => ({ day: 20000, text: "Chief guest arrived at 10", ai: false, author: snap(by, role, team), createdAt: serverTimestamp(), ...extra });
await ok("documentation member adds a diary note", setDoc(doc(ctx("docs1"), "events/future/diary", "n1"), note("docs1", "member", "documentation")));
await no("outreach member cannot add diary notes", setDoc(doc(ctx("mem"), "events/future/diary", "n2"), note("mem", "member", "outreach")));
await no("diary note over 4000 chars rejected", setDoc(doc(ctx("docs1"), "events/future/diary", "n3"), note("docs1", "member", "documentation", { text: "x".repeat(4001) })));
await no("another docs member cannot delete my note", (async () => { const d = ctx("docl"); const b = writeBatch(d); b.delete(doc(d, "events/future/diary", "n1")); return b.commit(); })());
await ok("author deletes own note", (async () => { const d = ctx("docs1"); const b = writeBatch(d); b.delete(doc(d, "events/future/diary", "n1")); return b.commit(); })());
await ok("docs member reads media logs", getDoc(doc(ctx("docs1"), "logs", "lm")));
await ok("docs member reads event logs", getDoc(doc(ctx("docs1"), "logs", "le")));
await no("docs member cannot read member/invite logs", getDoc(doc(ctx("docs1"), "logs", "lmem")));
await no("outreach member cannot read media logs", getDoc(doc(ctx("mem"), "logs", "lm")));
await ok("docs member reads the event chat (for the diary)", getDoc(doc(ctx("docs1"), "events/future/messages", "msg1")));
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "canvaAssets", "ca1"), { uid: "media1", eventId: "future", name: "QR" }); });
await ok("member reads the list of what AMAL sent to their own Canva", getDoc(doc(ctx("media1"), "canvaAssets", "ca1")));
await no("nobody else can read it", getDoc(doc(ctx("docs1"), "canvaAssets", "ca1")));
await no("browsers can't write that list", setDoc(doc(ctx("media1"), "canvaAssets", "ca2"), { uid: "media1", eventId: "future" }));
await no("Canva tokens are server-only, even for their owner", getDoc(doc(ctx("media1"), "canvaTokens", "media1")));
await no("Canva OAuth states are server-only", getDoc(doc(ctx("media1"), "canvaStates", "abc")));

console.log("Logs, onboarding gate");
await ok("TTL reads form logs", getDoc(doc(ctx("ttl"), "logs", "lf")));
await no("member cannot read form logs", getDoc(doc(ctx("mem"), "logs", "lf")));
await no("non-onboarded member cannot request permission", setDoc(doc(ctx("newbie"), "requests", "rqn"), { id: "rqn", scope: "form", status: "pending", requester: snap("newbie", "member") }));
await ok("public reads events", getDoc(doc(env.unauthenticatedContext().firestore(), "events", "future")));
await no("public cannot read registrations", getDoc(doc(env.unauthenticatedContext().firestore(), "registrations", "future_other")));

console.log("Retain / release");
await no("VP cannot release President", updateDoc(doc(ctx("vp1"), "members", "pres"), { status: "released", releasedYear: "2026-27" }));
await ok("President releases a member", updateDoc(doc(ctx("pres"), "members", "mem"), { status: "released", releasedYear: "2026-27", updatedAt: serverTimestamp() }));
await ok("Admin releases VP", updateDoc(doc(ctx("admin1", "admin1@x.com"), "members", "vp1"), { status: "released", releasedYear: "2026-27" }));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup(); process.exit(fail ? 1 : 0);
