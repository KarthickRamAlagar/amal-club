import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { Plus, Search, FileText, ShieldCheck, Copy, Inbox } from "lucide-react";
import { toast } from "sonner";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmptyState, Pager, usePaged } from "@/components/common/Primitives";
import { ActorCard } from "@/components/common/ActorCard";
import { RequestDecisionDialog, reqStatusVariant, sortNewest } from "@/components/forms/PermissionGate";
import { useAuth } from "@/context/AuthContext";
import { useQueryData } from "@/hooks/useFirestore";
import { useEvents } from "@/hooks/useData";
import { eventPhase } from "@/services/events";
import { canSeeFormLogs } from "@/lib/permissions";
import { SITE_URL } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { fmtDateTime, timeAgo } from "@/lib/utils";

const STATUS = { in_use: ["ok", "In use"], completed: ["muted", "Event completed"], pending: ["warn", "Pending"], allowed: ["ok", "Allowed"], denied: ["default", "Denied"], used: ["muted", "Code used"] };

export default function FormsPage() {
  const { member: me } = useAuth();
  const { data: events } = useEvents();
  const phase = useMemo(() => Object.fromEntries(events.map((e) => [e.slug, eventPhase(e)])), [events]);
  const { data: forms } = useQueryData(() => query(collection(db, "forms"), orderBy("createdAt", "desc"), limit(300)), []);
  const { data: mine } = useQueryData(() => query(collection(db, "requests"), where("requester.uid", "==", me.uid), where("scope", "==", "form"), orderBy("createdAt", "desc"), limit(50)), [me.uid]);
  const seeLogs = canSeeFormLogs(me);
  const { data: allReq } = useQueryData(() => (seeLogs ? query(collection(db, "requests"), where("scope", "==", "form"), orderBy("createdAt", "desc"), limit(300)) : null), [seeLogs]);
  const formStatus = (f) => (f.status === "completed" || phase[f.eventId] === "past" ? "completed" : "in_use");

  const [q, setQ] = useState(""); const [st, setSt] = useState("all"); const [page, setPage] = useState(1);
  const [lq, setLq] = useState(""); const [lst, setLst] = useState("all"); const [lpage, setLpage] = useState(1);
  const [view, setView] = useState(null); const [logView, setLogView] = useState(null);

  const fRows = forms.filter((f) => (st === "all" || formStatus(f) === st) && `${f.title} ${f.eventName} ${f.createdBy?.name}`.toLowerCase().includes(q.toLowerCase()));
  const fp = usePaged(fRows, 12, page);
  // Unified log: forms (In use / Event completed) + requests (Pending / Allowed / Denied / Used)
  const logRows = useMemo(() => sortNewest([
    ...forms.map((f) => ({ kind: "form", id: f.id, status: formStatus(f), actor: f.createdBy, title: f.title, eventName: f.eventName, createdAt: f.createdAt, via: f.via, code: f.grant?.code, raw: f })),
    ...allReq.map((r) => ({ kind: "request", id: r.id, status: r.status, actor: r.requester, title: r.reason, eventName: r.eventName, createdAt: r.createdAt, raw: r })),
  ]).filter((r) => (lst === "all" || r.status === lst) && `${r.title} ${r.eventName} ${r.actor?.name} ${r.actor?.email} ${r.actor?.amalId}`.toLowerCase().includes(lq.toLowerCase())), [forms, allReq, lst, lq, phase]); // eslint-disable-line
  const lp = usePaged(logRows, 15, lpage);

  return <>
    <DashHeader eyebrow="FORM CREATION" title="Event forms." subtitle="Admin, Club Representatives and the Technical Team Lead create directly (logged). Everyone else requests a one-time code."
      action={<Button asChild><Link to="/dashboard/forms/new"><Plus /> Create form</Link></Button>} />
    <Tabs defaultValue="forms">
      <TabsList><TabsTrigger value="forms"><FileText size={14} className="mr-1 inline" />Forms ({forms.length})</TabsTrigger><TabsTrigger value="mine"><Inbox size={14} className="mr-1 inline" />My requests ({mine.length})</TabsTrigger>
        {seeLogs && <TabsTrigger value="logs"><ShieldCheck size={14} className="mr-1 inline" />Request logs</TabsTrigger>}</TabsList>

      <TabsContent value="forms">
        <Card className="mb-4"><CardContent className="flex flex-wrap gap-2 p-4"><div className="relative min-w-60 flex-1"><Search size={15} className="absolute left-3 top-3.5 text-muted" /><Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search forms, events, creators" className="pl-9" /></div>
          <Select value={st} onChange={(e) => { setSt(e.target.value); setPage(1); }} className="w-48"><option value="all">All</option><option value="in_use">In use</option><option value="completed">Event completed</option></Select></CardContent></Card>
        {!fRows.length ? <EmptyState icon={FileText} title="No forms yet" action={<Button asChild><Link to="/dashboard/forms/new"><Plus /> Create form</Link></Button>} /> :
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{fp.rows.map((f) => { const s = formStatus(f); return <div key={f.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><Link to={`/dashboard/forms/${f.id}`} className="block truncate font-display text-[16px] font-extrabold hover:text-brand-bright">{f.title}</Link><div className="truncate text-[12px] text-muted">{f.eventName} · {f.fields?.length} questions</div></div><Badge variant={STATUS[s][0]}>{STATUS[s][1]}</Badge></div>
            <div className="flex items-center gap-2 text-[12px] text-muted"><Avatar src={f.createdBy?.photoUrl} name={f.createdBy?.name} size={24} />{f.createdBy?.name} · {timeAgo(f.createdAt)}{f.grant?.code && <Badge variant="outline" className="font-mono">{f.grant.code}</Badge>}</div>
            <div className="mt-auto flex gap-2"><Button size="sm" variant="secondary" asChild><Link to={`/dashboard/forms/${f.id}`}>Responses</Link></Button>
              {s === "in_use" && <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(`${SITE_URL}/f/${f.id}`); toast.success("Form link copied."); }}><Copy /> Link</Button>}</div>
          </div>; })}</div>}
        <Pager page={fp.page} pages={fp.pages} onPage={setPage} />
      </TabsContent>

      <TabsContent value="mine" className="space-y-2">{mine.map((r) => <button key={r.id} onClick={() => setView(r)} className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left hover:border-brand-bright">
        <div className="min-w-0 flex-1"><div className="truncate font-bold">{r.eventName || "General"}</div><div className="truncate text-[12px] text-muted">{r.reason}</div></div>
        {r.decidedBy && <span className="flex items-center gap-1.5 text-[12px] text-muted"><Avatar src={r.decidedBy.photoUrl} name={r.decidedBy.name} size={22} />{r.decidedBy.name}</span>}
        <Badge variant={reqStatusVariant[r.status]}>{STATUS[r.status][1]}</Badge><span className="text-[12px] text-muted">{timeAgo(r.createdAt)}</span></button>)}
        {!mine.length && <EmptyState title="No requests">You only need one if your role requires a code or you hit the daily limit.</EmptyState>}</TabsContent>

      {seeLogs && <TabsContent value="logs">
        <Card className="mb-4"><CardContent className="flex flex-wrap gap-2 p-4"><div className="relative min-w-60 flex-1"><Search size={15} className="absolute left-3 top-3.5 text-muted" /><Input value={lq} onChange={(e) => { setLq(e.target.value); setLpage(1); }} placeholder="Search name, email, AMAL ID, event, reason" className="pl-9" /></div>
          <Select value={lst} onChange={(e) => { setLst(e.target.value); setLpage(1); }} className="w-52"><option value="all">All statuses</option>{Object.entries(STATUS).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}</Select></CardContent></Card>
        <div className="space-y-2">{lp.rows.map((r) => <button key={`${r.kind}-${r.id}`} onClick={() => (r.kind === "request" ? setView(r.raw) : setLogView(r))} className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left hover:border-brand-bright">
          <Avatar src={r.actor?.photoUrl} name={r.actor?.name} size={40} />
          <div className="min-w-0 flex-1"><div className="truncate text-sm"><strong>{r.actor?.name}</strong> <span className="text-muted">· {r.actor?.designation} · {r.actor?.teamName}</span></div>
            <div className="truncate text-[12px] text-muted">{r.kind === "form" ? `Created "${r.title}"` : `Requested: ${r.title}`} · {r.eventName || "General"}</div></div>
          <Badge variant="outline">{r.kind === "form" ? "Form" : "Request"}</Badge><Badge variant={STATUS[r.status]?.[0]}>{STATUS[r.status]?.[1]}</Badge><span className="w-28 text-right text-[12px] text-muted">{fmtDateTime(r.createdAt)}</span></button>)}
          {!logRows.length && <EmptyState title="No log entries match" />}</div>
        <Pager page={lp.page} pages={lp.pages} onPage={setLpage} />
      </TabsContent>}
    </Tabs>

    <RequestDecisionDialog request={view} onOpenChange={setView} />
    <Dialog open={!!logView} onOpenChange={(o) => !o && setLogView(null)}><DialogContent>{logView && <>
      <DialogTitle>{logView.title}</DialogTitle><DialogDescription>{logView.eventName} · created via {logView.via === "code" ? `permission code ${logView.code}` : logView.via === "quota" ? "daily allowance" : "admin access"}</DialogDescription>
      <ActorCard className="mt-4" actor={logView.actor} label="Created by" at={logView.createdAt} />
    </>}</DialogContent></Dialog>
  </>;
}
