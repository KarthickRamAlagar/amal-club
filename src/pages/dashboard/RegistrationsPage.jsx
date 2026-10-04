import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, query, where } from "firebase/firestore";
import { Download, LayoutGrid, Rows3, Search, Check, X, Clock, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Select } from "@/components/ui/input";
import { TableWrap, Table, Th, Td } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmptyState, Pager, usePaged, Spinner } from "@/components/common/Primitives";
import { ActorCard } from "@/components/common/ActorCard";
import { useAuth } from "@/context/AuthContext";
import { useEvents } from "@/hooks/useData";
import { useQueryData, useNow } from "@/hooks/useFirestore";
import { effectiveStatus, logExport, setRegistrationStatus, sweepExpired } from "@/services/registrations";
import { registrationsCsv } from "@/lib/exportRegistrations";
import { canExportRegistrations } from "@/lib/permissions";
import { REG_STATUS } from "@/lib/constants";
import { cn, countdown, errMsg, fmtDateTime, toMillis } from "@/lib/utils";
import { cdn } from "@/lib/image";
import { db } from "@/lib/firebase";

const SB = { pending_payment: ["warn", "Payment pending"], confirmed: ["ok", "Confirmed"], expired: ["muted", "Dropped (5h)"], rejected: ["default", "Rejected"] };

/** Dedicated sub-page for every AMAL member: visual cards + full table. */
export default function RegistrationsPage() {
  const { slug } = useParams(); const nav = useNavigate();
  const { member: me, staff } = useAuth(); const now = useNow(30000);
  const { data: events } = useEvents();
  const ev = events.find((e) => e.slug === slug) || null;
  useEffect(() => { if (!slug && events.length) nav(`/dashboard/registrations/${events[events.length - 1].slug}`, { replace: true }); }, [slug, events, nav]);
  const { data: regs, loading } = useQueryData(() => (slug ? query(collection(db, "registrations"), where("eventId", "==", slug)) : null), [slug]);
  const [view, setView] = useState("visual"); const [q, setQ] = useState(""); const [st, setSt] = useState("all"); const [mode, setMode] = useState("all"); const [page, setPage] = useState(1); const [open, setOpen] = useState(null);
  const swept = useRef(0);
  useEffect(() => { if (staff && regs.length && Date.now() - swept.current > 60000) { swept.current = Date.now(); sweepExpired(me, regs).catch(() => {}); } }, [regs, staff, me]);

  const rows = useMemo(() => regs.filter((r) => (st === "all" || effectiveStatus(r) === st) && (mode === "all" || r.mode === mode) &&
    `${r.teamName} ${r.leader?.name} ${r.leader?.email} ${r.leader?.phone} ${(r.members || []).map((m) => m.name).join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)), [regs, st, mode, q, now]); // eslint-disable-line
  const paged = usePaged(rows, view === "visual" ? 12 : 25, page);
  const people = rows.reduce((s, r) => s + (r.headcount || 1), 0);

  async function decide(r, status) {
    const note = status === REG_STATUS.rejected ? prompt("Reason (shown in chat):") : "";
    if (status === REG_STATUS.rejected && !note) return;
    try { await setRegistrationStatus(me, r, status, note || ""); toast.success("Updated and posted to chat."); setOpen(null); } catch (e) { toast.error(errMsg(e)); }
  }
  async function exportCsv() { if (!ev) return; registrationsCsv(ev, rows); await logExport(me, ev, rows.length).catch(() => {}); toast.success("CSV downloaded · logged."); }

  return <>
    <DashHeader eyebrow="REGISTRATIONS" title={ev ? ev.name : "Registrations"} subtitle={`${rows.length} teams · ${people} people (filtered)`}
      action={<div className="flex flex-wrap gap-2">
        <Select value={slug || ""} onChange={(e) => { setPage(1); nav(`/dashboard/registrations/${e.target.value}`); }} className="w-64">{events.map((e) => <option key={e.slug} value={e.slug}>{e.name}</option>)}</Select>
        {canExportRegistrations(me) && ev && <Button variant="secondary" onClick={exportCsv}><Download /> CSV</Button>}
      </div>} />
    <Card><CardContent className="flex flex-wrap items-center gap-2 p-4">
      <div className="relative min-w-60 flex-1"><Search size={15} className="absolute left-3 top-3.5 text-muted" /><Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search team, leader, member, phone…" className="pl-9" /></div>
      <Select value={st} onChange={(e) => { setSt(e.target.value); setPage(1); }} className="w-44"><option value="all">All statuses</option>{Object.entries(SB).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}</Select>
      <Select value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }} className="w-36"><option value="all">Online + on-spot</option><option value="online">Online</option><option value="onspot">On-spot</option></Select>
      <div className="flex rounded-xl border border-line p-1">{[["visual", LayoutGrid], ["table", Rows3]].map(([k, I]) => <button key={k} onClick={() => setView(k)} className={cn("rounded-lg px-3 py-1.5", view === k ? "brand-gradient text-white" : "text-muted")} aria-label={k}><I size={16} /></button>)}</div>
    </CardContent></Card>

    <div className="mt-5">{loading ? <Spinner /> : !rows.length ? <EmptyState title="No registrations match" /> : view === "visual" ?
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{paged.rows.map((r) => { const s = effectiveStatus(r); return <button key={r.id} onClick={() => setOpen(r)} className="fade-up rounded-2xl border border-line bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-bright">
        <div className="flex items-center justify-between gap-2"><span className="truncate font-display text-[16px] font-extrabold">{r.teamName}</span><Badge variant={SB[s][0]}>{SB[s][1]}</Badge></div>
        <div className="mt-3 flex -space-x-2">{[r.leader, ...(r.members || [])].map((p, i) => <Avatar key={i} src={p?.photoUrl} name={p?.name} size={40} className="border-2 border-[var(--surface)]" />)}</div>
        <div className="mt-3 text-[13px]"><strong>{r.leader?.name}</strong> <span className="text-muted">· leader</span></div>
        <div className="text-[12px] text-muted">{r.headcount} people · {r.mode === "onspot" ? "On-spot" : "Online"} · {fmtDateTime(r.createdAt)}</div>
        {s === REG_STATUS.pending && <div className="mt-2 inline-flex items-center gap-1 text-[12px] text-warn"><Clock size={12} /> {countdown(r.expiresAt - now)} to verify{r.payment ? " · payment sent" : ""}</div>}
      </button>; })}</div>
      : <TableWrap><Table><thead><tr><Th>Team</Th><Th>Leader</Th><Th>Phone</Th><Th>College / Dept</Th><Th>Members</Th><Th>Mode</Th><Th>Status</Th><Th>UTR</Th><Th>Registered</Th></tr></thead>
        <tbody>{paged.rows.map((r) => { const s = effectiveStatus(r); return <tr key={r.id} className="cursor-pointer hover:bg-surface-2" onClick={() => setOpen(r)}>
          <Td className="font-bold">{r.teamName}</Td><Td><div className="flex items-center gap-2"><Avatar src={r.leader?.photoUrl} name={r.leader?.name} size={26} />{r.leader?.name}<span className="text-muted">{r.leader?.email}</span></div></Td>
          <Td>{r.leader?.phone}</Td><Td>{r.leader?.college}{r.leader?.department ? ` · ${r.leader.department}` : ""}</Td><Td>{(r.members || []).map((m) => m.name).join(", ") || "—"}</Td>
          <Td>{r.mode}</Td><Td><Badge variant={SB[s][0]}>{SB[s][1]}</Badge></Td><Td className="font-mono">{r.payment?.utr || "—"}</Td><Td className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</Td></tr>; })}</tbody></Table></TableWrap>}
      <Pager page={paged.page} pages={paged.pages} onPage={setPage} />
    </div>

    <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}><DialogContent wide>{open && <>
      <DialogTitle>{open.teamName}</DialogTitle><DialogDescription>{open.mode === "onspot" ? "On-spot" : "Online"} · registered {fmtDateTime(open.createdAt)} · ₹{open.amount}</DialogDescription>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{[{ ...open.leader, lead: true }, ...(open.members || [])].map((p, i) => <div key={i} className="flex gap-3 rounded-xl border border-line p-3">
        <Avatar src={p.photoUrl} name={p.name} size={52} /><div className="min-w-0 text-[13px]"><div className="font-bold">{p.name} {p.lead && <Badge variant="gold">Leader</Badge>}</div>
          {p.email && <div className="truncate text-muted"><Mail size={11} className="inline" /> {p.email}</div>}{p.phone && <div className="text-muted"><Phone size={11} className="inline" /> {p.phone}</div>}
          <div className="text-muted">{[p.college, p.collegeId, p.department, p.year].filter(Boolean).join(" · ")}</div></div></div>)}</div>
      {open.payment && <div className="mt-4 rounded-xl bg-surface-2 p-3 text-sm"><strong>Payment:</strong> UTR <span className="font-mono">{open.payment.utr}</span>{open.payment.note ? ` · ${open.payment.note}` : ""}
        {open.payment.proofUrl && <a href={open.payment.proofUrl} target="_blank" rel="noreferrer"><img src={cdn(open.payment.proofUrl, 600)} alt="Payment proof" className="mt-2 max-h-64 rounded-lg" /></a>}</div>}
      {open.decidedBy && <ActorCard className="mt-4" actor={open.decidedBy} label={`${effectiveStatus(open)} by`} at={open.decidedAt} />}
      {staff && effectiveStatus(open) === REG_STATUS.pending && <div className="mt-5 flex justify-end gap-2"><Button variant="danger" onClick={() => decide(open, REG_STATUS.rejected)}><X /> Reject</Button><Button variant="success" onClick={() => decide(open, REG_STATUS.confirmed)}><Check /> Confirm payment & tag</Button></div>}
    </>}</DialogContent></Dialog>
  </>;
}

