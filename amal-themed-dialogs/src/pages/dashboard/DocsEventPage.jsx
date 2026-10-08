import { Fragment, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, BookOpenText, CalendarDays, ClipboardList, ExternalLink, FileText, Film, Image as ImageIcon, MessagesSquare, NotebookPen,
  Sparkles, Trash2, Users, UserCheck, Ticket, Send, Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, PageLoader, Spinner, Stat } from "@/components/common/Primitives";
import { MediaGrid } from "@/components/media/MediaGrid";
import { PredictionCards } from "@/components/events/PredictionCards";
import { ReportEditor } from "@/components/docs/ReportEditor";
import { useAuth } from "@/context/AuthContext";
import { useDossier, dayFacts, dayLabel, timeIST } from "@/hooks/useDossier";
import { addDiaryNote, deleteDiaryNote } from "@/services/reports";
import { effectiveStatus } from "@/services/registrations";
import { eventPhase } from "@/services/events";
import { canUseDocs, isAdmin, isOB } from "@/lib/permissions";
import { teamName } from "@/lib/constants";
import { api } from "@/lib/api";
import { cn, errMsg, fmtDate, fmtDateTime, fmtTime, istDayNumber, toMillis } from "@/lib/utils";
import { confirmDialog } from "@/components/common/ConfirmDialog";

const KIND_ICON = { event: CalendarDays, registration: Ticket, form: ClipboardList, media: ImageIcon, ai: Sparkles, report: FileText, diary: NotebookPen, poster: ImageIcon };
const STATUS_BADGE = { confirmed: ["ok", "Confirmed"], pending_payment: ["warn", "Payment pending"], expired: ["muted", "Dropped"], rejected: ["default", "Rejected"] };

function DayCard({ d, ev, me, canWrite, isEventDay, isToday }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [summary, setSummary] = useState("");
  const facts = dayFacts(d, ev);
  const c = d.counts;

  async function addNote(body = text, ai = false) {
    if (!body.trim()) return;
    setBusy(ai ? "save-ai" : "note");
    try { await addDiaryNote(me, ev, d.day, body, { ai }); if (!ai) setText(""); else setSummary(""); toast.success(ai ? "AI summary saved to the diary." : "Note added."); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  }
  async function summarise() {
    if (!facts.length) return toast("Nothing recorded for this day yet.");
    setBusy("ai");
    try { const r = await api("ai/text", { purpose: "diary", eventId: ev.slug, eventName: ev.name, facts: facts.join("\n") }); setSummary(r.text); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  }

  return <Card className={cn(isEventDay && "border-brand-bright/60")}>
    <CardHeader className="pb-2">
      <div>
        <CardTitle className="flex flex-wrap items-center gap-2">{dayLabel(d.day)}{isEventDay && <Badge variant="default">Event day</Badge>}{isToday && <Badge variant="gold">Today</Badge>}</CardTitle>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          {c.registrations > 0 && <Badge variant="muted"><Ticket size={11} className="mr-1 inline" />{c.registrations} registrations</Badge>}
          {c.confirmed > 0 && <Badge variant="ok"><UserCheck size={11} className="mr-1 inline" />{c.confirmed} confirmed</Badge>}
          {c.responses > 0 && <Badge variant="muted"><ClipboardList size={11} className="mr-1 inline" />{c.responses} form responses</Badge>}
          {c.messages > 0 && <Badge variant="muted"><MessagesSquare size={11} className="mr-1 inline" />{c.messages} chat messages</Badge>}
          {c.media > 0 && <Badge variant="gold"><ImageIcon size={11} className="mr-1 inline" />{c.media} media</Badge>}
        </div>
      </div>
      {canWrite && <Button size="sm" variant="secondary" onClick={summarise} disabled={!!busy}>{busy === "ai" ? <Spinner /> : <Sparkles />} AI day summary</Button>}
    </CardHeader>
    <CardContent className="space-y-3">
      {d.items.length > 0 && <ol className="relative space-y-2 border-l border-line pl-4">
        {d.items.map((it, i) => { const I = KIND_ICON[it.kind] || CalendarDays; return <li key={i} className="relative text-sm">
          <span className="absolute -left-[25px] top-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-surface-2 text-brand-bright"><I size={11} /></span>
          <span className="mr-2 font-mono text-[11px] text-muted">{timeIST(it.at)}</span>{it.text}
          {it.actor?.name && <span className="text-muted"> · {it.actor.name}</span>}
          {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="ml-1 text-brand-bright"><ExternalLink size={12} className="inline" /></a>}
        </li>; })}
      </ol>}
      {!d.items.length && !d.notes.length && <p className="text-[13px] text-muted">Nothing recorded automatically for this day.</p>}

      {d.notes.map((n) => <div key={n.id} className={cn("rounded-xl p-3 text-sm", n.ai ? "border border-gold/40 bg-gold/5" : "bg-surface-2")}>
        <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
          {n.ai ? <><Sparkles size={12} className="text-gold" /> AI summary, saved by {n.author?.name}</> : <><Avatar src={n.author?.photoUrl} name={n.author?.name} size={18} /> {n.author?.name} · {n.author?.designation}</>}
          <span>· {fmtTime(n.createdAt)}</span>
          {canWrite && (n.author?.uid === me.uid || isAdmin(me) || isOB(me)) && <button className="ml-auto text-muted hover:text-brand-bright" title="Delete note" onClick={async () => (await confirmDialog({ title: "Delete this diary note?", description: "It's removed from the diary for everyone.", confirmText: "Delete", tone: "danger" })) && deleteDiaryNote(ev, n.id).catch((e) => toast.error(errMsg(e)))}><Trash2 size={13} /></button>}
        </div>
        <p className="whitespace-pre-wrap">{n.text}</p>
      </div>)}

      {summary && <div className="rounded-xl border border-gold/50 bg-gold/5 p-3 text-sm">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-gold"><Sparkles size={12} /> AI draft — check before saving</div>
        <p className="whitespace-pre-wrap">{summary}</p>
        <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => addNote(summary, true)} disabled={!!busy}>{busy === "save-ai" ? <Spinner className="text-white" /> : null} Save to diary</Button><Button size="sm" variant="ghost" onClick={() => setSummary("")}>Discard</Button></div>
      </div>}

      {canWrite && <div className="flex gap-2">
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="What happened? Guests, highlights, issues, decisions…" className="min-h-[44px]" maxLength={4000} />
        <Button onClick={() => addNote()} disabled={!text.trim() || !!busy} className="self-end" aria-label="Add note">{busy === "note" ? <Spinner className="text-white" /> : <Send />}</Button>
      </div>}
    </CardContent>
  </Card>;
}

export default function DocsEventPage() {
  const { slug } = useParams();
  const { member: me } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "diary";
  const dossier = useDossier(slug);
  const { ev, loading, regs, forms, responses, media, stats, days } = dossier;
  if (!canUseDocs(me)) return <EmptyState icon={NotebookPen} title="The Documentation desk is for the Documentation & Report team, Club Representatives and the Admin." />;
  if (loading) return <PageLoader />;
  if (!ev) return <EmptyState title="Event not found" />;

  const today = istDayNumber(); const evDay = istDayNumber(toMillis(ev.startAt));
  const phase = eventPhase(ev);
  const rules = (ev.rules || "").split("\n").map((r) => r.trim()).filter(Boolean);
  const respByForm = responses.reduce((a, r) => { a[r.formId] = (a[r.formId] || 0) + 1; return a; }, {});
  const people = new Map();
  [ev.createdBy, ev.updatedBy, ...dossier.logs.map((l) => l.actor), ...media.map((m) => m.createdBy), ...forms.map((f) => f.createdBy), ...regs.map((r) => r.decidedBy)].filter((a) => a?.uid).forEach((a) => people.set(a.uid, a));

  return <>
    <DashHeader eyebrow={`DOCUMENTATION · ${phase === "past" ? "COMPLETED" : phase === "live" ? "TODAY" : "UPCOMING"}`} title={ev.name} subtitle={`${fmtDateTime(ev.startAt)} · ${ev.location}`}
      action={<div className="flex flex-wrap gap-2"><Button asChild variant="secondary"><Link to="/dashboard/documentation"><ArrowLeft /> All events</Link></Button><Button asChild variant="secondary"><Link to={`/events/${ev.slug}`}><ExternalLink /> Event page</Link></Button></div>} />

    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Stat label="Teams registered" value={stats.online + stats.onspot} icon={Ticket} hint={`${stats.online} online · ${stats.onspot} on-spot`} />
      <Stat label="Confirmed" value={stats.confirmed} icon={UserCheck} hint={`${stats.people} participants`} />
      <Stat label="Form responses" value={stats.responses} icon={ClipboardList} hint={`${stats.forms} form${stats.forms === 1 ? "" : "s"}`} />
      <Stat label="Posters / videos" value={`${stats.posters} / ${stats.videos}`} icon={Film} />
      <Stat label="Chat messages" value={stats.messages} icon={MessagesSquare} />
    </div>

    <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
      <TabsList>
        <TabsTrigger value="diary"><NotebookPen size={15} className="mr-1.5 inline" />Daily diary</TabsTrigger>
        <TabsTrigger value="context"><BookOpenText size={15} className="mr-1.5 inline" />Full context</TabsTrigger>
        <TabsTrigger value="report"><FileText size={15} className="mr-1.5 inline" />Report</TabsTrigger>
      </TabsList>

      <TabsContent value="diary" className="space-y-4">
        <p className="text-sm text-muted">Built automatically from registrations, payments, forms, media, chat and team activity — grouped by day (IST). Add your own notes for anything the app can't see: guests, highlights, issues, decisions.</p>
        {days.map((d) => <DayCard key={d.day} d={d} ev={ev} me={me} canWrite={canUseDocs(me)} isEventDay={d.day === evDay} isToday={d.day === today} />)}
      </TabsContent>

      <TabsContent value="context">
        <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <div className="space-y-5">
            <Card><CardHeader><CardTitle>About the event</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
              {ev.bannerUrl && <img src={ev.bannerUrl} alt="" className="w-full rounded-xl object-cover" />}
              <p className="font-semibold">{ev.shortDesc}</p>
              {ev.fullDesc && <p className="whitespace-pre-wrap text-muted">{ev.fullDesc}</p>}
              {rules.length > 0 && <><h4 className="pt-2 font-display font-extrabold">Rules &amp; format</h4><ul className="list-disc space-y-1 pl-5">{rules.map((r) => <li key={r}>{r}</li>)}</ul></>}
            </CardContent></Card>

            <Card><CardHeader><div><CardTitle>Registrations</CardTitle><CardDescription>{regs.length} teams · {stats.colleges.length} colleges</CardDescription></div></CardHeader>
              <CardContent className="max-h-[480px] overflow-auto">
                {!regs.length ? <p className="text-sm text-muted">No registrations yet.</p> : <table className="w-full text-left text-[13px]">
                  <thead className="text-[11px] uppercase text-muted"><tr><th className="py-2 pr-3">Team</th><th className="pr-3">Leader · college</th><th className="pr-3">Size</th><th className="pr-3">Mode</th><th>Status</th></tr></thead>
                  <tbody>{[...regs].sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt)).map((r) => { const [v, l] = STATUS_BADGE[effectiveStatus(r)] || ["muted", r.status]; return <tr key={r.id} className="border-t border-line">
                    <td className="py-2 pr-3 font-semibold">{r.teamName}</td><td className="pr-3 text-muted">{r.leader?.name}{r.leader?.college ? ` · ${r.leader.college}` : ""}</td><td className="pr-3">{r.headcount}</td><td className="pr-3">{r.mode === "onspot" ? "On-spot" : "Online"}</td><td><Badge variant={v}>{l}</Badge></td></tr>; })}</tbody>
                </table>}
              </CardContent></Card>

            <Card><CardHeader><div><CardTitle>Posters &amp; videos</CardTitle><CardDescription>Everything the Media team saved to this event.</CardDescription></div>
              <Button asChild size="sm" variant="secondary"><Link to={`/dashboard/media?event=${ev.slug}&tab=library`}><Wand2 /> Media studio</Link></Button></CardHeader>
              <CardContent><MediaGrid items={media} me={me} /></CardContent></Card>
          </div>

          <div className="space-y-5">
            <Card><CardHeader><CardTitle>Key facts</CardTitle></CardHeader><CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {[["Date", fmtDate(ev.startAt)], ["Time", `${fmtTime(ev.startAt)}${ev.endAt ? ` – ${fmtTime(ev.endAt)}` : ""}`], ["Venue", ev.location], ["Fee", ev.price ? `₹${ev.price} per team` : "Free"],
                  ["Team size", ev.teamMin === ev.teamMax ? ev.teamMin : `${ev.teamMin}–${ev.teamMax}`], ["Seats", `${ev.onlineIntake} online · ${ev.onspotIntake} on-spot`], ["Prizes", ev.prizes || "—"],
                  ["Sponsors", (ev.sponsors || []).map((s) => s.name).join(", ") || "—"], ["Status", ev.status === "disabled" ? "Disabled" : { past: "Completed", live: "Today", upcoming: "Upcoming" }[phase] || phase], ["Created by", `${ev.createdBy?.name || "—"} (${ev.createdBy?.designation || ""})`]].map(([k, v]) =>
                  <Fragment key={k}><dt className="text-muted">{k}</dt><dd className="font-semibold">{v}</dd></Fragment>)}
              </dl></CardContent></Card>

            <Card><CardHeader><CardTitle>Forms</CardTitle></CardHeader><CardContent className="space-y-2">
              {!forms.length ? <p className="text-sm text-muted">No forms for this event.</p> : forms.map((f) => <div key={f.id} className="flex items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
                <span className="min-w-0"><strong className="block truncate">{f.title}</strong><span className="text-[12px] text-muted">by {f.createdBy?.name} · {f.status === "completed" ? "closed" : "open"}</span></span>
                <span className="flex items-center gap-2"><Badge variant="muted">{respByForm[f.id] || 0} responses</Badge><Button asChild size="sm" variant="ghost"><Link to={`/dashboard/forms/${f.id}`}><ExternalLink /></Link></Button></span></div>)}
            </CardContent></Card>

            <Card><CardHeader><div><CardTitle>People involved</CardTitle><CardDescription>Created, edited, approved, designed or confirmed something for this event.</CardDescription></div></CardHeader>
              <CardContent className="space-y-2">{[...people.values()].map((p) => <div key={p.uid} className="flex items-center gap-3 text-sm"><Avatar src={p.photoUrl} name={p.name} size={32} /><span><strong>{p.name}</strong><span className="block text-[12px] text-muted">{p.designation}{p.team ? ` · ${teamName(p.team)}` : ""}</span></span></div>)}
                {!people.size && <p className="text-sm text-muted">—</p>}</CardContent></Card>

            {ev.prediction && <PredictionCards event={ev} canRun={false} />}
            <Card><CardContent className="flex items-center gap-3 p-4 text-sm"><Users className="text-brand-bright" /><span>{stats.colleges.length ? stats.colleges.join(", ") : "Colleges will appear as teams register."}</span></CardContent></Card>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="report"><ReportEditor me={me} dossier={dossier} canEdit={canUseDocs(me)} /></TabsContent>
    </Tabs>
  </>;
}
