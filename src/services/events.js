import {
  collection, doc, getDoc, getDocs, query, where, writeBatch, serverTimestamp, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { actorSnap } from "@/lib/permissions";
import { slugify, registrationClosesAt, toMillis } from "@/lib/utils";
import { logInBatch } from "./logs";

export function eventPhase(ev, now = Date.now()) {
  if (!ev) return "unknown";
  if (ev.status === "disabled") return "past";
  const start = toMillis(ev.startAt);
  const end = toMillis(ev.endAt) || (start ? new Date(start).setHours(23, 59, 59, 999) : 0);
  if (end && now > end) return "past";
  if (start && now >= start) return "live";
  return "upcoming";
}

/** Registration state shown on the event page. */
export function registrationState(ev, now = Date.now()) {
  const phase = eventPhase(ev, now);
  if (phase === "past") return { state: "closed", label: "Event completed" };
  const closes = registrationClosesAt(toMillis(ev.startAt));
  const onlineLeft = Math.max(0, (ev.onlineIntake || 0) - (ev.onlineCount || 0));
  const onspotLeft = Math.max(0, (ev.onspotIntake || 0) - (ev.onspotCount || 0));
  if (now < closes) {
    if (onlineLeft <= 0) return { state: "full", label: "Online seats full", closes, onlineLeft, onspotLeft };
    return { state: "open", label: "Registrations open", closes, onlineLeft, onspotLeft };
  }
  return { state: "onspot", label: "On-spot registration", closes, onlineLeft, onspotLeft };
}

async function uniqueSlug(name) {
  const base = slugify(name);
  let slug = base, n = 2;
  while ((await getDoc(doc(db, "events", slug))).exists()) slug = `${base}-${n++}`;
  return slug;
}

const cleanEvent = (f) => ({
  name: f.name.trim(),
  shortDesc: f.shortDesc.trim(),
  fullDesc: f.fullDesc.trim(),
  rules: f.rules.trim(),
  location: f.location.trim(),
  startAt: toMillis(f.startAt),
  endAt: f.endAt ? toMillis(f.endAt) : null,
  price: Number(f.price) || 0,
  onlineIntake: Number(f.onlineIntake) || 0,
  onspotIntake: Number(f.onspotIntake) || 0,
  teamMin: Math.max(1, Number(f.teamMin) || 1),
  teamMax: Math.max(Number(f.teamMin) || 1, Number(f.teamMax) || 1),
  sponsors: (f.sponsors || []).filter((s) => s.name?.trim()).map((s) => ({ name: s.name.trim(), logoUrl: s.logoUrl || "" })),
  prizes: (f.prizes || "").trim(),
  upiId: (f.upiId || "").trim(),
  paymentQrUrl: f.paymentQrUrl || "",
  bannerUrl: f.bannerUrl || "",
  bannerSource: f.bannerSource || "upload",
  bannerCredit: f.bannerCredit || "",
});

export async function createEvent(me, form) {
  const slug = await uniqueSlug(form.name);
  const data = cleanEvent(form);
  const batch = writeBatch(db);
  batch.set(doc(db, "events", slug), {
    ...data, slug, status: "upcoming", onlineCount: 0, onspotCount: 0,
    createdBy: actorSnap(me), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  logInBatch(batch, { scope: "events", type: "event.create", actor: me, target: { id: slug, name: data.name } });
  await batch.commit();
  return slug;
}

export async function updateEvent(me, ev, form) {
  const batch = writeBatch(db);
  batch.update(doc(db, "events", ev.slug), { ...cleanEvent(form), updatedBy: actorSnap(me), updatedAt: serverTimestamp() });
  logInBatch(batch, { scope: "events", type: "event.update", actor: me, target: { id: ev.slug, name: form.name } });
  await batch.commit();
}

/** Disable → registration stops, card moves to Past Events, its forms become "Event completed". */
export async function setEventDisabled(me, ev, disabled) {
  const batch = writeBatch(db);
  batch.update(doc(db, "events", ev.slug), disabled
    ? { status: "disabled", disabledBy: actorSnap(me), disabledAt: serverTimestamp() }
    : { status: "upcoming", disabledBy: null, disabledAt: null });
  if (disabled) {
    const forms = await getDocs(query(collection(db, "forms"), where("eventId", "==", ev.slug), where("status", "==", "in_use")));
    forms.forEach((f) => batch.update(f.ref, { status: "completed", completedAt: serverTimestamp() }));
  }
  logInBatch(batch, { scope: "events", type: disabled ? "event.disable" : "event.enable", actor: me, target: { id: ev.slug, name: ev.name } });
  await batch.commit();
}

export const bumpCount = (batch, slug, field, by) => batch.update(doc(db, "events", slug), { [field]: increment(by) });
