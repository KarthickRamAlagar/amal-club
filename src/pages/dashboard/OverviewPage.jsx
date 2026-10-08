import { Link } from "react-router-dom";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { CalendarDays, FileText, Image as ImageIcon, ShieldCheck, Users, ArrowRight, Table2 } from "lucide-react";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Stat } from "@/components/common/Primitives";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useEvents, useActiveMembers } from "@/hooks/useData";
import { useQueryData } from "@/hooks/useFirestore";
import { eventPhase, registrationState } from "@/services/events";
import { approverType } from "@/lib/permissions";
import { db } from "@/lib/firebase";
import { fmtDate, timeAgo } from "@/lib/utils";

export default function OverviewPage() {
  const { member } = useAuth();
  const { data: events } = useEvents();
  const { data: members } = useActiveMembers();
  const scopes = approverType(member, "form") ? ["form"] : [];
  const { data: pending } = useQueryData(() => (scopes.length ? query(collection(db, "requests"), where("scope", "in", scopes), where("status", "==", "pending")) : null), [scopes.join()]);
  const { data: mine } = useQueryData(() => query(collection(db, "requests"), where("requester.uid", "==", member.uid), orderBy("createdAt", "desc"), limit(5)), [member.uid]);
  const live = events.filter((e) => eventPhase(e) !== "past");
  const hour = new Date().getHours();
  return <>
    <DashHeader eyebrow="YOUR CLUB, AT A GLANCE" title={`${hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}, ${member.name.split(" ")[0]}.`} subtitle="Keep the community informed and everything moving." />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Current & upcoming events" value={live.length} icon={CalendarDays} hint={`${events.length - live.length} past`} />
      <Stat label="Active members" value={members.length} icon={Users} hint="Across 5 teams" />
      <Stat label="Online teams (live events)" value={live.reduce((s, e) => s + (e.onlineCount || 0), 0)} icon={Table2} hint="Pending + confirmed" />
      <Stat label="Requests awaiting you" value={pending.length} icon={ShieldCheck} hint={scopes.length ? "Form permissions" : "You're not an approver"} />
    </div>
    <div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <Card><CardHeader><div><CardTitle>Events</CardTitle><CardDescription>Registration status at a glance.</CardDescription></div><Link to="/dashboard/events" className="text-[13px] font-semibold text-brand-bright">Manage →</Link></CardHeader>
        <CardContent className="space-y-2">{live.slice(0, 6).map((e) => { const rs = registrationState(e); return <Link key={e.slug} to={`/dashboard/events/${e.slug}`} className="flex items-center gap-3 rounded-xl border border-line p-3 hover:border-brand-bright">
          <img src={e.bannerUrl || "/amal-logo.jpg"} alt="" className="h-12 w-16 rounded-lg object-cover" />
          <div className="min-w-0 flex-1"><div className="truncate font-bold">{e.name}</div><div className="text-[12px] text-muted">{fmtDate(e.startAt)} · {e.onlineCount || 0}/{e.onlineIntake} online · {e.onspotCount || 0}/{e.onspotIntake} on-spot</div></div>
          <Badge variant={rs.state === "open" ? "ok" : rs.state === "onspot" ? "gold" : "muted"}>{rs.label}</Badge></Link>; })}
          {!live.length && <p className="text-sm text-muted">No upcoming events.</p>}
        </CardContent></Card>
      <div className="space-y-5">
        <Card><CardHeader><CardTitle>Quick actions</CardTitle></CardHeader><CardContent className="grid gap-2">
          {[["/dashboard/forms/new", FileText, "Create an event form"], ["/dashboard/media", ImageIcon, "Create a poster or video"], ["/dashboard/registrations", Table2, "See registrations"]].map(([to, I, l]) =>
            <Link key={to} to={to} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3 text-sm font-semibold hover:text-brand-bright"><I size={17} className="text-brand-bright" />{l}<ArrowRight size={15} className="ml-auto" /></Link>)}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>My permission requests</CardTitle></CardHeader><CardContent className="space-y-2">
          {mine.map((r) => <Link to="/dashboard/forms" key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-line p-2.5 text-sm"><span className="truncate">Form · {r.eventName || "—"} <span className="text-muted">· {timeAgo(r.createdAt)}</span></span><Badge variant={{ pending: "warn", allowed: "ok", denied: "default", used: "muted" }[r.status]}>{r.status}</Badge></Link>)}
          {!mine.length && <p className="text-sm text-muted">None yet.</p>}
        </CardContent></Card>
      </div>
    </div>
  </>;
}
