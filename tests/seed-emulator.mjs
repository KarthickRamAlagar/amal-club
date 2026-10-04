process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const { initializeApp } = await import("../node_modules/firebase-admin/lib/app/index.js");
const { getAuth } = await import("../node_modules/firebase-admin/lib/auth/index.js");
const { getFirestore, FieldValue } = await import("../node_modules/firebase-admin/lib/firestore/index.js");
initializeApp({ projectId: "amal-test" });
const auth = getAuth(), db = getFirestore();
const R = { admin: 100, president: 80, vp: 70, treasurer: 70, lead: 40, member: 20 };
const people = [
  ["admin", "Prof. Sriram Devanathan", "admin", null, "Faculty Admin", "Faculty"],
  ["kanishka", "Kanishka", "president", null, "President", "4th Year"],
  ["sanskar", "Sanskar Deopuje", "vp", null, "Vice President", "3rd Year"],
  ["ashrita", "Ashrita", "treasurer", null, "Treasurer", "3rd Year"],
  ["jiya", "Jiya Borikar", "lead", "technical", "Team Lead", "3rd Year"],
  ["dedeepya", "Dedeepya Kolli", "lead", "media", "Team Lead", "3rd Year"],
  ["rohini", "Rohini B", "member", "technical", "Team Member", "2nd Year"],
  ["anand", "Anand Patil", "member", "technical", "Team Member", "1st Year"],
];
const uids = {};
for (const [id, name, role, team, designation, year] of people) {
  const email = `${id}@amal.test`;
  let u; try { u = await auth.createUser({ email, password: "password123", displayName: name }); } catch { u = await auth.getUserByEmail(email); }
  uids[id] = u.uid;
  await db.doc(`members/${u.uid}`).set({ uid: u.uid, name, email, role, team, designation, amalId: `${id}.amal`, year, department: "CSE", status: "active", onboarded: true, bio: `${name} — ${designation} at AMAL.`, linkedin: "https://linkedin.com/in/x", photoUrl: "" });
  await db.doc(`amalIds/${id}.amal`).set({ uid: u.uid, email });
}
const snap = (id) => { const p = people.find((x) => x[0] === id); return { uid: uids[id], name: p[1], email: `${id}@amal.test`, photoUrl: "", amalId: `${id}.amal`, role: p[2], rank: R[p[2]], designation: p[4], team: p[3], teamName: p[3] || "Core" }; };
const day = 86400000, now = Date.now();
await db.doc("events/mock-parliament-26").set({ slug: "mock-parliament-26", name: "Mock Parliament '26", status: "upcoming", startAt: now + 6 * day, endAt: null, location: "Amriteshwari Hall", shortDesc: "Step into a simulation of the Indian Parliament — debate, draft bills and vote.", fullDesc: "The AMAL Mock Parliament simulates the workings of the Indian Parliament.", rules: "Teams of 2–4\nFormal attire is mandatory\nBills submitted by 9 AM", price: 200, onlineIntake: 40, onspotIntake: 10, onlineCount: 3, onspotCount: 0, teamMin: 2, teamMax: 4, sponsors: [{ name: "ACE", logoUrl: "" }], prizes: "₹12,000 prize pool", upiId: "amal@upi", paymentQrUrl: "", bannerUrl: "", createdBy: snap("kanishka"), createdAt: FieldValue.serverTimestamp() });
const regs = [["Opposition Bench", "pending_payment", now + 3 * 3600000, { utr: "412345678901" }], ["Treasury Benches", "confirmed", null, null], ["Late Team", "pending_payment", now - 3600000, null]];
let i = 0;
for (const [teamName, status, expiresAt, payment] of regs) {
  const id = `mock-parliament-26_p${++i}`;
  await db.doc(`registrations/${id}`).set({ id, eventId: "mock-parliament-26", eventName: "Mock Parliament '26", uid: `p${i}`, mode: "online", teamName, leader: { name: `Leader ${i}`, email: `l${i}@g.com`, phone: "+91 9800000000", college: "Amrita", photoUrl: "" }, members: [{ name: `Member ${i}a` }], headcount: 2, amount: 200, status, expiresAt, ...(payment ? { payment } : {}), createdAt: FieldValue.serverTimestamp() });
  await db.collection("events/mock-parliament-26/messages").add({ type: "system", text: `${teamName} registered (online).`, sender: { uid: `p${i}`, name: `Leader ${i}`, kind: "participant" }, regId: id, createdAt: FieldValue.serverTimestamp() });
}
await db.collection("events/mock-parliament-26/messages").add({ type: "payment", regId: "mock-parliament-26_p1", teamName: "Opposition Bench", amount: 200, utr: "412345678901", text: "Paid via GPay", sender: { uid: "p1", name: "Leader 1", kind: "participant", teamName: "Opposition Bench" }, createdAt: FieldValue.serverTimestamp() });
await db.doc("requests/rqA").set({ id: "rqA", scope: "form", status: "pending", reason: "Feedback form for Mock Parliament judges", eventId: "mock-parliament-26", eventName: "Mock Parliament '26", requester: snap("rohini"), approvals: [], createdAt: FieldValue.serverTimestamp() });
await db.doc("config/setup").set({ adminUid: uids.admin });
console.log("seeded", Object.keys(uids).length, "members");
process.exit(0);
