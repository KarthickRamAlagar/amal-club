import { Link, useParams } from "react-router-dom";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { Ban, Download, MessagesSquare, Pencil, PlayCircle, Table2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stat, PageLoader, EmptyState } from "@/components/common/Primitives";
import { ActorCard } from "@/components/common/ActorCard";
import { QRCard } from "@/components/common/QRCard";
import { PredictionCards } from "@/components/events/PredictionCards";
import { useAuth } from "@/context/AuthContext";
import { useEvent } from "@/hooks/useData";
import { useQueryData } from "@/hooks/useFirestore";
import { eventPhase, registrationState, setEventDisabled } from "@/services/events";
import { effectiveStatus, logExport } from "@/services/registrations";
import { registrationsCsv } from "@/lib/exportRegistrations";
import { canDisableEvent, canEditEvent, canExportRegistrations } from "@/lib/permissions";
import { LOG_LABELS } from "@/services/logs";
import { SITE_URL } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { errMsg, fmtDateTime } from "@/lib/utils";

export default function EventManagePage() {
  const { slug } = useParams();
  const { member: me, staff } = useAuth();
  const { data: ev, loading } = useEvent(slug);
  const { data: regs } = useQueryData(() => query(collection(db, "registrations"), where("eventId", "==", slug)), [slug]);
  const { data: logs } = useQueryData(() => (staff ? query(collection(db, "logs"), where("scope", "in", ["events", "registrations"]), where("target.id", "==", slug), orderBy("createdAt", "desc"), limit(20)) : null), [slug, staff]);
  const { data: exportLogs } = useQueryData(() => (staff ? query(collection(db, "logs"), where("scope", "==", "registrations"), where("type", "==", "registration.export"), where("target.id", "==", slug), orderBy("createdAt", "desc"), limit(10)) : null), [slug, staff]);
  if (loading) return <PageLoader />;
  if (!ev) return <EmptyState title="Event not found" />;

  const rs = registrationState(ev); const past = eventPhase(ev) === "past";
  const c = regs.reduce((a, r) => { const s = effectiveStatus(r); a[s] = (a[s] || 0) + 1; if (s === "confirmed") a.people += r.headcount || 1; return a; }, { people: 0 });

  async function toggle() {
    const disabling = ev.status !== "disabled";
    if (disabling && !confirm(`Disable "${ev.name}"? Nobody can register, it moves to Past Events and its forms close.`)) return;
    try { await setEventDisabled(me, ev, disabling); toast.success(disabling ? "Event disabled and moved to Past." : "Event re-opened."); } catch (e) { toast.error(errMsg(e)); }
  }
  async function exportCsv() {
    try { registrationsCsv(ev, regs); await logExport(me, ev, regs.length); toast.success("CSV downloaded · logged."); } catch (e) { toast.error(errMsg(e)); }
  }

  return <>
    <DashHeader eyebrow={past ? "PAST EVENT" : rs.label.toUpperCase()} title={ev.name} subtitle={`${fmtDateTime(ev.startAt)} · ${ev.location}`}
      action={<div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary"><Link to={`/events/${ev.slug}`}><ExternalLink /> Public page</Link></Button>
        {canEditEvent(me, ev) && <Button asChild variant="secondary"><Link to={`/dashboard/events/${ev.slug}/edit`}><Pencil /> Edit</Link></Button>}
        {staff && <Button asChild variant="secondary"><Link to={`/events/${ev.slug}/chat`}><MessagesSquare /> Chat</Link></Button>}
        <Button asChild variant="secondary"><Link to={`/dashboard/registrations/${ev.slug}`}><Table2 /> Registrations</Link></Button>
        {canExportRegistrations(me) && <Button variant="secondary" onClick={exportCsv}><Download /> CSV</Button>}
        {canDisableEvent(me) && <Button variant={ev.status === "disabled" ? "success" : "danger"} onClick={toggle}>{ev.status === "disabled" ? <><PlayCircle /> Re-open</> : <><Ban /> Disable event</>}</Button>}
      </div>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Stat label="Online teams" value={`${ev.onlineCount || 0}/${ev.onlineIntake}`} hint="Pending + confirmed" />
      <Stat label="On-spot teams" value={`${ev.onspotCount || 0}/${ev.onspotIntake}`} />
      <Stat label="Confirmed" value={c.confirmed || 0} hint={`${c.people} people`} />
      <Stat label="Payment pending" value={c.pending_payment || 0} hint="Auto-drop after 5h" />
      <Stat label="Dropped / rejected" value={(c.expired || 0) + (c.rejected || 0)} />
    </div>
    {!past && <div className="mt-6"><PredictionCards event={ev} canRun={staff} /></div>}
    <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_1fr_1.2fr]">
      <QRCard url={`${SITE_URL}/form/${ev.slug}`} title="Registration link (posters)" caption="Opens the event page → Register" filename={`${ev.slug}-register-qr.png`} />
      <QRCard url={`${SITE_URL}/events/${ev.slug}/chat?onspot=1`} title="On-spot desk QR" caption="Print for the venue desk: details + payment in chat" filename={`${ev.slug}-onspot-qr.png`} />
      <Card><CardHeader><div><CardTitle>Who did what</CardTitle><CardDescription>Creation, edits, status changes and downloads.</CardDescription></div></CardHeader>
        <CardContent className="max-h-[420px] space-y-2 overflow-y-auto">
          <ActorCard actor={ev.createdBy} label="Created by" at={ev.createdAt} />
          {ev.disabledBy && <ActorCard actor={ev.disabledBy} label="Disabled by" at={ev.disabledAt} />}
          {exportLogs.map((l) => <ActorCard key={l.id} actor={l.actor} label={`Downloaded CSV · ${l.details?.rows} rows`} at={l.createdAt} compact />)}
          {logs.filter((l) => l.type !== "registration.export").map((l) => <div key={l.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[12px]"><span><strong>{l.actor?.name}</strong> · {LOG_LABELS[l.type] || l.type}</span><Badge variant="muted">{fmtDateTime(l.createdAt)}</Badge></div>)}
        </CardContent></Card>
    </div>
  </>;
}
