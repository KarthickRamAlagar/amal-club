import { Fragment, useMemo, useState } from "react";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { Search } from "lucide-react";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmptyState, Pager, usePaged, Spinner } from "@/components/common/Primitives";
import { ActorCard } from "@/components/common/ActorCard";
import { useAuth } from "@/context/AuthContext";
import { useQueryData } from "@/hooks/useFirestore";
import { LOG_LABELS } from "@/services/logs";
import { canSeeFormLogs, canSeeMediaLogs, isAdmin, isOB } from "@/lib/permissions";
import { rankOf } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { fmtDateTime } from "@/lib/utils";

export default function LogsPage() {
  const { member: me } = useAuth();
  const scopes = [
    rankOf(me.role) >= 40 && ["members", "Members"],
    rankOf(me.role) >= 40 && ["events", "Events"],
    rankOf(me.role) >= 40 && ["registrations", "Registrations & CSV"],
    canSeeFormLogs(me) && ["forms", "Form creation"],
    canSeeMediaLogs(me) && ["media", "Media & reports"],
  ].filter(Boolean);
  const [scope, setScope] = useState(scopes[0]?.[0]);
  const { data: logs, loading } = useQueryData(() => (scope ? query(collection(db, "logs"), where("scope", "==", scope), orderBy("createdAt", "desc"), limit(400)) : null), [scope]);
  const [q, setQ] = useState(""); const [type, setType] = useState("all"); const [page, setPage] = useState(1); const [open, setOpen] = useState(null);
  const types = useMemo(() => [...new Set(logs.map((l) => l.type))], [logs]);
  const rows = logs.filter((l) => (type === "all" || l.type === type) && `${l.actor?.name} ${l.actor?.email} ${l.actor?.amalId} ${l.target?.name} ${JSON.stringify(l.details || {})}`.toLowerCase().includes(q.toLowerCase()));
  const p = usePaged(rows, 20, page);
  if (!scopes.length) return <EmptyState title="No logs available for your role" />;
  return <>
    <DashHeader eyebrow="ACTIVITY LOGS" title="Who did what, when." subtitle={isAdmin(me) || isOB(me) ? "Every invite, event, approval, download and poster — with the person's photo, designation and email." : "Logs visible to your role."} />
    <Tabs value={scope} onValueChange={(v) => { setScope(v); setType("all"); setPage(1); }}><TabsList>{scopes.map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}</TabsList></Tabs>
    <Card className="my-4"><CardContent className="flex flex-wrap gap-2 p-4"><div className="relative min-w-60 flex-1"><Search size={15} className="absolute left-3 top-3.5 text-muted" /><Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search person, email, AMAL ID, target" className="pl-9" /></div>
      <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="w-60"><option value="all">All actions</option>{types.map((t) => <option key={t} value={t}>{LOG_LABELS[t] || t}</option>)}</Select></CardContent></Card>
    {loading ? <Spinner /> : !rows.length ? <EmptyState title="No entries" /> : <div className="space-y-2">{p.rows.map((l) => <button key={l.id} onClick={() => setOpen(l)} className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left hover:border-brand-bright">
      <Avatar src={l.actor?.photoUrl} name={l.actor?.name} size={40} />
      <div className="min-w-0 flex-1"><div className="truncate text-sm"><strong>{l.actor?.name}</strong> <span className="text-muted">· {l.actor?.designation}</span></div><div className="truncate text-[12px] text-muted">{LOG_LABELS[l.type] || l.type}{l.target?.name ? ` · ${l.target.name}` : ""}</div></div>
      <Badge variant="muted">{fmtDateTime(l.createdAt)}</Badge></button>)}</div>}
    <Pager page={p.page} pages={p.pages} onPage={setPage} />
    <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}><DialogContent>{open && <>
      <DialogTitle>{LOG_LABELS[open.type] || open.type}</DialogTitle><DialogDescription>{open.target?.name}</DialogDescription>
      <ActorCard className="mt-4" actor={open.actor} at={open.createdAt} />
      {open.details && Object.keys(open.details).length > 0 && <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-surface-2 p-3 text-sm">{Object.entries(open.details).map(([k, v]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd className="break-words">{v === null ? "—" : String(v)}</dd></Fragment>)}</dl>}
    </>}</DialogContent></Dialog>
  </>;
}
