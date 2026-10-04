import { adb, FieldValue } from "./admin.js";
import { generateText } from "./ai.js";

/** Deterministic baseline so the cards still work if every AI provider is down. */
function baseline(inp) {
  const people = Math.round(inp.people + inp.onspotExpected * inp.avgTeam);
  const seats = Math.ceil((people + inp.organisers) * 1.1);
  const perRow = seats > 120 ? 14 : seats > 60 ? 10 : 8;
  return {
    expectedAttendees: people,
    summary: `${inp.teams} online teams + ~${inp.onspotExpected} on-spot teams, plus ${inp.organisers} organisers.`,
    seating: { totalSeats: seats, layout: `${Math.ceil(seats / perRow)} rows × ${perRow} seats, teams seated together; front row reserved for judges & guests.`, notes: "10% buffer included for late walk-ins." },
    snacks: [{ item: "Samosa / puff", quantity: Math.ceil((people + inp.organisers) * 1.1), unit: "pcs" }, { item: "Biscuit packets", quantity: Math.ceil((people + inp.organisers) / 2), unit: "packs" }],
    beverages: [{ item: "Tea / coffee", quantity: Math.ceil((people + inp.organisers) * 1.1), unit: "cups" }, { item: "Water bottles (500 ml)", quantity: Math.ceil((people + inp.organisers) * 1.2), unit: "bottles" }],
    certificates: [{ item: "Participation", quantity: people }, { item: "Winners (top 3 teams)", quantity: Math.ceil(inp.avgTeam * 3) }, { item: "Judges / guests", quantity: inp.judges || 3 }, { item: "Organisers / volunteers", quantity: inp.organisers }],
    tips: ["Print 5 spare certificates for name corrections.", "Keep the on-spot QR desk near the entrance."],
  };
}

export async function runPrediction(slug, actor) {
  const db = adb();
  const evSnap = await db.doc(`events/${slug}`).get();
  if (!evSnap.exists) throw Object.assign(new Error("Event not found"), { status: 404 });
  const ev = evSnap.data();
  const regs = (await db.collection("registrations").where("eventId", "==", slug).get()).docs.map((d) => d.data());
  const now = Date.now();
  const active = regs.filter((r) => r.status === "confirmed" || (r.status === "pending_payment" && (!r.expiresAt || r.expiresAt > now)));
  const online = active.filter((r) => r.mode !== "onspot");
  const confirmed = active.filter((r) => r.status === "confirmed");
  const people = online.reduce((s, r) => s + (r.headcount || 1), 0);
  const avgTeam = online.length ? people / online.length : Math.max(1, ((ev.teamMin || 1) + (ev.teamMax || 1)) / 2);
  const organisers = (await db.collection("members").where("status", "==", "active").get()).size;
  const inp = {
    teams: online.length, confirmedTeams: confirmed.length, people, avgTeam: Math.round(avgTeam * 10) / 10,
    onspotIntake: ev.onspotIntake || 0, onspotSoFar: active.filter((r) => r.mode === "onspot").length,
    onspotExpected: Math.min(ev.onspotIntake || 0, Math.max(active.filter((r) => r.mode === "onspot").length, Math.round((ev.onspotIntake || 0) * 0.6))),
    organisers, judges: 3, price: ev.price || 0,
  };

  let out, provider = "baseline";
  try {
    const r = await generateText({
      json: true,
      system: "You are an event-operations planner for a student management club at Amrita Vishwa Vidyapeetham, Bengaluru (India). Plan realistic quantities for an Indian college event. Reply with JSON only.",
      prompt: `Event: ${ev.name}\nDescription: ${ev.shortDesc}\nVenue: ${ev.location}\nStart: ${new Date(ev.startAt).toString()}\nInputs: ${JSON.stringify(inp)}\n\nPredict tomorrow's needs. Include a 5–10% buffer. Return JSON exactly in this shape:\n{"expectedAttendees": number, "summary": string (1 sentence), "seating": {"totalSeats": number, "layout": string, "notes": string}, "snacks": [{"item": string, "quantity": number, "unit": string}], "beverages": [{"item": string, "quantity": number, "unit": string}], "certificates": [{"item": string, "quantity": number}], "tips": [string, string, string]}`,
    });
    out = r.data; provider = r.provider;
    if (!out?.seating || !Array.isArray(out.snacks)) throw new Error("bad shape");
  } catch { out = baseline(inp); }

  const prediction = { ...out, inputs: inp, provider, generatedAt: Date.now(), generatedBy: actor ? { uid: actor.uid, name: actor.name } : { name: "Nightly job" } };
  await db.doc(`events/${slug}`).update({ prediction });
  await db.collection("logs").add({ scope: "events", type: "ai.prediction", actor: actor || { name: "Nightly job", designation: "System", rank: 0 }, target: { id: slug, name: ev.name }, details: { provider, teams: inp.teams }, createdAt: FieldValue.serverTimestamp() });
  return prediction;
}
