// Pre-filled event report (HTML that the report editor opens with).
import { fmtDate, fmtTime, toMillis } from "./utils";
import { dayLabel } from "@/hooks/useDossier";
import { SITE_URL } from "./constants";

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const todo = (t) => `<p><em><mark>[${esc(t)}]</mark></em></p>`;
const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export function participationTable(stats, ev) {
  return `<table><tbody>
<tr><th>Measure</th><th>Count</th></tr>
<tr><td>Online teams registered</td><td>${stats.online}${ev?.onlineIntake ? ` of ${ev.onlineIntake} seats` : ""}</td></tr>
<tr><td>On-spot teams registered</td><td>${stats.onspot}${ev?.onspotIntake ? ` of ${ev.onspotIntake} seats` : ""}</td></tr>
<tr><td>Teams confirmed</td><td>${stats.confirmed}</td></tr>
<tr><td>Participants (confirmed)</td><td>${stats.people}</td></tr>
<tr><td>Colleges represented</td><td>${stats.colleges.length}</td></tr>
${ev?.price ? `<tr><td>Registration fees collected</td><td>${rupees(stats.revenue)}</td></tr>` : ""}
<tr><td>Form responses</td><td>${stats.responses}</td></tr>
<tr><td>Posters / videos published</td><td>${stats.posters} / ${stats.videos}</td></tr>
</tbody></table>`;
}

export function dayHighlights(days, notesOnly = false) {
  const withContent = [...days].sort((a, b) => a.day - b.day).filter((d) => d.notes.length || (!notesOnly && d.items.length));
  if (!withContent.length) return todo("No diary entries yet — add notes in the Daily diary tab, then use Insert → Day-by-day highlights.");
  return withContent.map((d) => {
    const notes = d.notes.map((n) => `<p>${esc(n.text)}${n.ai ? "" : ` <em>— ${esc(n.author?.name || "")}</em>`}</p>`).join("");
    const facts = notesOnly ? "" : `<ul>${d.items.slice(0, 12).map((it) => `<li>${esc(it.text)}</li>`).join("")}</ul>`;
    return `<h3>${esc(dayLabel(d.day))}</h3>${notes}${d.items.length && !notesOnly ? facts : ""}`;
  }).join("");
}

export function mediaList(media) {
  const live = media.filter((m) => m.status !== "removed");
  if (!live.length) return todo("No posters or videos saved to this event yet.");
  return `<ul>${live.map((m) => `<li>${m.kind === "video" ? "Video" : "Poster"}: <a href="${esc(m.url)}">${esc(m.title || "untitled")}</a> (${m.source === "canva" ? "Canva" : m.source === "studio" ? "AMAL Video Studio" : "uploaded"}, by ${esc(m.createdBy?.name || "—")})</li>`).join("")}</ul>`;
}

/** The whole starting document. `me` = the documentation member preparing it. */
export function buildReportTemplate({ ev, stats, days, media, forms }, me) {
  const start = toMillis(ev.startAt);
  const rules = (ev.rules || "").split("\n").map((r) => r.trim()).filter(Boolean);
  const sponsors = (ev.sponsors || []).map((s) => s.name).filter(Boolean);
  return `
<h1>${esc(ev.name)} — Event Report</h1>
<p><strong>Amrita Management &amp; Leadership Club (AMAL)</strong> · Amrita Vishwa Vidyapeetham, Bengaluru</p>
<table><tbody>
<tr><th>Event</th><td>${esc(ev.name)}</td></tr>
<tr><th>Date &amp; time</th><td>${fmtDate(start)} · ${fmtTime(start)}${ev.endAt ? ` – ${fmtTime(ev.endAt)}` : ""}</td></tr>
<tr><th>Venue</th><td>${esc(ev.location || "—")}</td></tr>
<tr><th>Organised by</th><td>AMAL — ${esc(ev.createdBy?.name || "")}${ev.createdBy?.designation ? ` (${esc(ev.createdBy.designation)})` : ""}</td></tr>
<tr><th>Report prepared by</th><td>${esc(me?.name || "")}${me?.designation ? `, ${esc(me.designation)}` : ""} — Documentation &amp; Report team</td></tr>
<tr><th>Report date</th><td>${fmtDate(Date.now())}</td></tr>
<tr><th>Event page</th><td><a href="${SITE_URL}/events/${esc(ev.slug)}">${SITE_URL.replace(/^https?:\/\//, "")}/events/${esc(ev.slug)}</a></td></tr>
</tbody></table>

<h2>1. Overview</h2>
<p>${esc(ev.shortDesc || "")}</p>
${ev.fullDesc ? ev.fullDesc.split(/\n{2,}/).map((p) => `<p>${esc(p.trim())}</p>`).join("") : ""}

<h2>2. Objectives</h2>
<ul><li><mark>[Objective 1]</mark></li><li><mark>[Objective 2]</mark></li><li><mark>[Objective 3]</mark></li></ul>

<h2>3. Event details</h2>
<table><tbody>
<tr><th>Registration fee</th><td>${ev.price ? `${rupees(ev.price)} per team` : "Free"}</td></tr>
<tr><th>Team size</th><td>${ev.teamMin === ev.teamMax ? ev.teamMin : `${ev.teamMin}–${ev.teamMax}`} member(s)</td></tr>
<tr><th>Seats</th><td>${ev.onlineIntake || 0} online · ${ev.onspotIntake || 0} on-spot</td></tr>
${ev.prizes ? `<tr><th>Prizes</th><td>${esc(ev.prizes)}</td></tr>` : ""}
${sponsors.length ? `<tr><th>Sponsors</th><td>${esc(sponsors.join(", "))}</td></tr>` : ""}
</tbody></table>
${rules.length ? `<h3>Rules &amp; format</h3><ul>${rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}

<h2>4. Participation</h2>
${participationTable(stats, ev)}
${stats.colleges.length ? `<p>Colleges: ${esc(stats.colleges.join(", "))}.</p>` : ""}
${forms?.length ? `<p>Forms used: ${forms.map((f) => esc(f.title)).join(", ")}.</p>` : ""}

<h2>5. Day-by-day highlights</h2>
${dayHighlights(days, true)}

<h2>6. Judges, guests &amp; speakers</h2>
${todo("Names, designations and organisations of judges / chief guests")}

<h2>7. Winners &amp; results</h2>
<table><tbody><tr><th>Position</th><th>Team</th><th>Members</th><th>Prize</th></tr>
<tr><td>Winner</td><td></td><td></td><td></td></tr><tr><td>Runner-up</td><td></td><td></td><td></td></tr><tr><td>Special mention</td><td></td><td></td><td></td></tr></tbody></table>

<h2>8. Posters, photos &amp; videos</h2>
${mediaList(media)}

<h2>9. Feedback &amp; learnings</h2>
<ul><li><strong>What went well:</strong> <mark>[…]</mark></li><li><strong>What to improve:</strong> <mark>[…]</mark></li><li><strong>Participant feedback:</strong> <mark>[summary of form responses]</mark></li></ul>

<h2>10. Acknowledgements</h2>
<p>AMAL thanks ${sponsors.length ? `our sponsors ${esc(sponsors.join(", "))}, ` : ""}the faculty coordinators, every participating team and the Event Management, Media &amp; Design, Technical, Outreach and Documentation teams who made ${esc(ev.name)} possible.</p>

<p></p>
<table><tbody><tr><td><p>Prepared by</p><p></p><p>${esc(me?.name || "")}<br>Documentation &amp; Report team</p></td><td><p>Verified by</p><p></p><p>Faculty Coordinator, AMAL</p></td></tr></tbody></table>
`.trim();
}
