import { Link } from "react-router-dom";
import { collection, query } from "firebase/firestore";
import { CalendarDays, FileCheck2, FilePen, FileX2, NotebookPen } from "lucide-react";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Stat } from "@/components/common/Primitives";
import { sortEventsForPicker } from "@/components/media/EventSelect";
import { useAuth } from "@/context/AuthContext";
import { useEvents } from "@/hooks/useData";
import { useQueryData } from "@/hooks/useFirestore";
import { eventPhase } from "@/services/events";
import { db } from "@/lib/firebase";
import { canUseDocs } from "@/lib/permissions";
import { fmtDate, timeAgo } from "@/lib/utils";
import { cdn } from "@/lib/image";

/** Documentation desk: every event with its report status. */
export default function DocsHomePage() {
  const { member: me } = useAuth();
  const { data: events } = useEvents();
  const { data: reports } = useQueryData(() => query(collection(db, "reports")), []);
  if (!canUseDocs(me)) return <EmptyState icon={NotebookPen} title="The Documentation desk is for the Documentation & Report team, Club Representatives and the Admin." />;

  const byId = Object.fromEntries(reports.map((r) => [r.eventId, r]));
  const { live, past } = sortEventsForPicker(events);
  const pendingPast = past.filter((e) => !byId[e.slug]).length;

  const Row = ({ e }) => {
    const r = byId[e.slug]; const phase = eventPhase(e);
    return <Link to={`/dashboard/documentation/${e.slug}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3 transition hover:border-brand-bright">
      <img src={e.bannerUrl ? cdn(e.bannerUrl, 240) : "/amal-logo.jpg"} alt="" className="h-16 w-24 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[16px] font-extrabold">{e.name}</div>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted"><CalendarDays size={13} /> {fmtDate(e.startAt)} · {e.location}
          <Badge variant={phase === "past" ? "muted" : phase === "live" ? "ok" : "gold"}>{phase === "past" ? "Completed" : phase === "live" ? "Today" : "Upcoming"}</Badge></div>
      </div>
      <div className="hidden text-right text-[12px] sm:block">
        {r ? <><Badge variant="ok"><FileCheck2 size={12} className="mr-1 inline" />Report · {r.words || 0} words</Badge><div className="mt-1 text-muted">{r.updatedBy?.name} · {timeAgo(r.updatedAt)}</div></>
          : phase === "past" ? <Badge variant="default"><FileX2 size={12} className="mr-1 inline" />Report due</Badge> : <Badge variant="muted"><FilePen size={12} className="mr-1 inline" />Diary open</Badge>}
      </div>
    </Link>;
  };

  return <>
    <DashHeader eyebrow="DOCUMENTATION & REPORT" title="Everything that happened, written down." subtitle="Open an event for its day-by-day diary, the full context and a pre-filled report you can download as PDF or Word." />
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat label="Upcoming & live events" value={live.length} icon={CalendarDays} hint="Keep the daily diary going" />
      <Stat label="Reports written" value={reports.length} icon={FileCheck2} />
      <Stat label="Completed events without a report" value={pendingPast} icon={FileX2} hint={pendingPast ? "Due" : "All caught up"} />
    </div>
    <h2 className="mb-3 mt-8 font-display text-lg font-extrabold">Upcoming &amp; live</h2>
    <div className="grid gap-2.5">{live.length ? live.map((e) => <Row key={e.slug} e={e} />) : <p className="text-sm text-muted">No upcoming events.</p>}</div>
    <h2 className="mb-3 mt-8 font-display text-lg font-extrabold">Completed</h2>
    <div className="grid gap-2.5">{past.length ? past.map((e) => <Row key={e.slug} e={e} />) : <p className="text-sm text-muted">No past events yet.</p>}</div>
  </>;
}
