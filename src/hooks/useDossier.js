import { useMemo } from "react";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useQueryData, useDocData } from "./useFirestore";
import { useEvent } from "./useData";
import { doc } from "firebase/firestore";
import { effectiveStatus } from "@/services/registrations";
import { LOG_LABELS } from "@/services/logs";
import { istDayNumber, toMillis } from "@/lib/utils";

/** "Day 20123" (IST day number) → readable date. */
export const dayToDate = (d) => new Date(d * 86400000 - 19800000 + 12 * 3600000);
export const dayLabel = (d) => dayToDate(d).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
export const timeIST = (ms) => new Date(ms).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

/**
 * Everything the Documentation team needs about one event, live:
 * the event, registrations, forms + responses, saved media, chat activity, activity logs and diary notes,
 * plus a day-by-day timeline grouped by IST date.
 */
export function useDossier(slug) {
  const { data: ev, loading } = useEvent(slug);
  const regs = useQueryData(() => (slug ? query(collection(db, "registrations"), where("eventId", "==", slug)) : null), [slug]).data;
  const forms = useQueryData(() => (slug ? query(collection(db, "forms"), where("eventId", "==", slug)) : null), [slug]).data;
  const responses = useQueryData(() => (slug ? query(collection(db, "formResponses"), where("eventId", "==", slug)) : null), [slug]).data;
  const media = useQueryData(() => (slug ? query(collection(db, "media"), where("eventId", "==", slug)) : null), [slug]).data;
  const messages = useQueryData(() => (slug ? query(collection(db, "events", slug, "messages"), orderBy("createdAt", "desc"), limit(1500)) : null), [slug]).data;
  const logs = useQueryData(() => (slug ? query(collection(db, "logs"), where("scope", "in", ["events", "media"]), where("target.id", "==", slug), orderBy("createdAt", "desc"), limit(300)) : null), [slug]).data;
  const notes = useQueryData(() => (slug ? query(collection(db, "events", slug, "diary"), orderBy("createdAt", "asc")) : null), [slug]).data;
  const report = useDocData(() => (slug ? doc(db, "reports", slug) : null), [slug]);

  const stats = useMemo(() => {
    const s = { online: 0, onspot: 0, confirmed: 0, pending: 0, dropped: 0, people: 0, colleges: new Set(), revenue: 0 };
    for (const r of regs) {
      const st = effectiveStatus(r);
      if (r.mode === "onspot") s.onspot++; else s.online++;
      if (st === "confirmed") { s.confirmed++; s.people += r.headcount || 1; s.revenue += r.amount || 0; }
      else if (st === "pending_payment") s.pending++;
      else s.dropped++;
      if (r.leader?.college) s.colleges.add(r.leader.college.trim());
    }
    const live = media.filter((m) => m.status !== "removed");
    return { ...s, colleges: [...s.colleges], forms: forms.length, responses: responses.length, posters: live.filter((m) => m.kind === "poster").length, videos: live.filter((m) => m.kind === "video").length, messages: messages.length };
  }, [regs, forms, responses, media, messages]);

  const days = useMemo(() => {
    const map = new Map();
    const day = (ms) => { const d = istDayNumber(ms); if (!map.has(d)) map.set(d, { day: d, items: [], notes: [], counts: { registrations: 0, confirmed: 0, responses: 0, messages: 0, media: 0 } }); return map.get(d); };
    const add = (ms, item) => { if (ms) day(ms).items.push({ at: ms, ...item }); };
    if (ev?.createdAt) add(toMillis(ev.createdAt), { kind: "event", text: "Event created", actor: ev.createdBy });
    for (const l of logs) {
      if (l.type === "event.create" || l.type === "media.save") continue; // shown from the source docs
      add(toMillis(l.createdAt), { kind: l.type.split(".")[0], text: `${LOG_LABELS[l.type] || l.type}${l.details?.title ? ` · ${l.details.title}` : ""}`, actor: l.actor });
    }
    for (const r of regs) {
      const c = toMillis(r.createdAt);
      if (c) { add(c, { kind: "registration", text: `${r.teamName} registered (${r.mode === "onspot" ? "on-spot" : "online"}, ${r.headcount || 1} ${r.headcount === 1 ? "person" : "people"}${r.leader?.college ? `, ${r.leader.college}` : ""})` }); day(c).counts.registrations++; }
      const d = toMillis(r.decidedAt);
      if (d) { add(d, { kind: "registration", text: `${r.teamName} ${r.status === "confirmed" ? "confirmed — payment verified" : r.status === "expired" ? "dropped — unpaid after 5 h" : "rejected"}`, actor: r.decidedBy }); if (r.status === "confirmed") day(d).counts.confirmed++; }
    }
    for (const f of forms) add(toMillis(f.createdAt), { kind: "form", text: `Form created: ${f.title}`, actor: f.createdBy });
    for (const r of responses) { const t = toMillis(r.submittedAt); if (t) day(t).counts.responses++; }
    for (const m of media) { const t = toMillis(m.createdAt); if (t) { add(t, { kind: "media", text: `${m.kind === "video" ? "Video" : "Poster"} saved: ${m.title || "untitled"} (${m.source === "canva" ? "Canva" : m.source === "studio" ? "Video Studio" : "upload"})`, actor: m.createdBy, url: m.url }); day(t).counts.media++; } }
    for (const m of messages) { const t = toMillis(m.createdAt); if (t) day(t).counts.messages++; }
    for (const n of notes) { const t = toMillis(n.createdAt); if (n.day) { if (!map.has(n.day)) day(dayToDate(n.day).getTime()); map.get(n.day).notes.push(n); } else if (t) day(t).notes.push(n); }
    // always include today and the event day so notes can be added
    day(Date.now()); if (ev?.startAt) day(toMillis(ev.startAt));
    for (const d of map.values()) d.items.sort((a, b) => a.at - b.at);
    return [...map.values()].sort((a, b) => b.day - a.day);
  }, [ev, logs, regs, forms, responses, media, messages, notes]);

  return { ev, loading, regs, forms, responses, media, messages, logs, notes, report: report.data, reportLoading: report.loading, stats, days };
}

/** Plain-text facts for one day (fed to the AI summary and the report). */
export function dayFacts(d, ev) {
  const lines = [];
  if (ev?.startAt && istDayNumber(toMillis(ev.startAt)) === d.day) lines.push(`This is the event day (${ev.name} at ${ev.location || "the venue"}).`);
  const c = d.counts;
  if (c.registrations) lines.push(`${c.registrations} new team registration(s).`);
  if (c.confirmed) lines.push(`${c.confirmed} registration(s) confirmed after payment.`);
  if (c.responses) lines.push(`${c.responses} form response(s) received.`);
  if (c.messages) lines.push(`${c.messages} message(s) in the participants' chat.`);
  for (const it of d.items) lines.push(`${timeIST(it.at)} — ${it.text}${it.actor?.name ? ` (by ${it.actor.name}${it.actor.designation ? `, ${it.actor.designation}` : ""})` : ""}`);
  for (const n of d.notes.filter((x) => !x.ai)) lines.push(`Note from ${n.author?.name || "the team"}: ${n.text}`);
  return lines;
}
