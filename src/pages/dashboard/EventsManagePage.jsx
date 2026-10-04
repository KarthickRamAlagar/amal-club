import { Link } from "react-router-dom";
import { Plus, CalendarClock, History } from "lucide-react";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState, PageLoader } from "@/components/common/Primitives";
import { useAuth } from "@/context/AuthContext";
import { useEvents } from "@/hooks/useData";
import { eventPhase, registrationState } from "@/services/events";
import { canCreateEvent } from "@/lib/permissions";
import { fmtDate, toMillis } from "@/lib/utils";
import { cdn } from "@/lib/image";

function Row({ e }) {
  const rs = registrationState(e);
  return <Link to={`/dashboard/events/${e.slug}`} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-3 transition hover:border-brand-bright">
    <img src={cdn(e.bannerUrl, 300) || "/amal-logo.jpg"} alt="" className="h-16 w-24 rounded-xl object-cover" />
    <div className="min-w-0 flex-1"><div className="truncate font-display text-[16px] font-extrabold">{e.name}</div>
      <div className="text-[12px] text-muted">{fmtDate(e.startAt)} · {e.location} · {e.onlineCount || 0}/{e.onlineIntake} online · {e.onspotCount || 0}/{e.onspotIntake} on-spot</div></div>
    <div className="flex items-center gap-2 text-[12px] text-muted"><Avatar src={e.createdBy?.photoUrl} name={e.createdBy?.name} size={26} />{e.createdBy?.name}</div>
    <Badge variant={e.status === "disabled" ? "muted" : rs.state === "open" ? "ok" : rs.state === "onspot" ? "gold" : "muted"}>{e.status === "disabled" ? "Disabled" : rs.label}</Badge>
  </Link>;
}

export default function EventsManagePage() {
  const { member } = useAuth();
  const { data: events, loading } = useEvents();
  const current = events.filter((e) => eventPhase(e) !== "past");
  const past = events.filter((e) => eventPhase(e) === "past").sort((a, b) => toMillis(b.startAt) - toMillis(a.startAt));
  return <>
    <DashHeader eyebrow="EVENTS" title="Current, upcoming & past." subtitle="Disabled or finished events move to Past automatically and their registrations become downloadable."
      action={canCreateEvent(member) && <Button asChild><Link to="/dashboard/events/new"><Plus /> Create event</Link></Button>} />
    {loading ? <PageLoader /> : <Tabs defaultValue="current">
      <TabsList><TabsTrigger value="current"><CalendarClock size={14} className="mr-1 inline" />Current &amp; upcoming ({current.length})</TabsTrigger><TabsTrigger value="past"><History size={14} className="mr-1 inline" />Past ({past.length})</TabsTrigger></TabsList>
      <TabsContent value="current" className="space-y-3">{current.map((e) => <Row key={e.slug} e={e} />)}{!current.length && <EmptyState title="No current events" />}</TabsContent>
      <TabsContent value="past" className="space-y-3">{past.map((e) => <Row key={e.slug} e={e} />)}{!past.length && <EmptyState title="No past events" />}</TabsContent>
    </Tabs>}
  </>;
}
