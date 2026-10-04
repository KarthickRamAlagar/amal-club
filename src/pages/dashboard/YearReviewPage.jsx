import { useEffect, useMemo, useState } from "react";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { CheckCircle2, LogOut as Leave, RotateCcw, ShieldAlert, History } from "lucide-react";
import { toast } from "sonner";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Select, Input, Field } from "@/components/ui/input";
import { Spinner, EmptyState } from "@/components/common/Primitives";
import { ActorCard } from "@/components/common/ActorCard";
import { useAuth } from "@/context/AuthContext";
import { useQueryData } from "@/hooks/useFirestore";
import { fetchTeamMembers, submitYearReview, restoreMember } from "@/services/members";
import { canReviewTeam } from "@/lib/permissions";
import { TEAMS, roleLabel, teamName } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { academicYearOf, cn, errMsg, fmtDate } from "@/lib/utils";

/** Each academic year: retain or release members team by team (Admin handles Club Representatives). */
export default function YearReviewPage() {
  const { member: me } = useAuth();
  const teams = [...(canReviewTeam(me, "core") ? [{ id: "core", name: "Club Representatives (core)" }] : []), ...TEAMS];
  const [teamId, setTeamId] = useState(teams[0].id);
  const [year, setYear] = useState(academicYearOf(Date.now() + 120 * 86400000));
  const [rows, setRows] = useState([]); const [dec, setDec] = useState({}); const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false);
  const { data: released } = useQueryData(() => query(collection(db, "members"), where("status", "==", "released"), limit(100)), []);
  const { data: history } = useQueryData(() => query(collection(db, "yearReviews"), orderBy("createdAt", "desc"), limit(20)), []);

  useEffect(() => {
    setLoading(true); setDec({});
    fetchTeamMembers(teamId).then((r) => setRows(r.filter((m) => m.uid !== me.uid && (teamId !== "core" || m.role !== "admin")))).catch((e) => toast.error(errMsg(e))).finally(() => setLoading(false));
  }, [teamId, me.uid]);

  const counts = useMemo(() => ({ release: Object.values(dec).filter((d) => d === "release").length, total: rows.length }), [dec, rows]);
  async function submit() {
    if (!rows.length) return;
    if (!confirm(`Submit ${year} review for ${teamId === "core" ? "Club Representatives" : teamName(teamId)}?\n${counts.release} released · ${counts.total - counts.release} retained.`)) return;
    setBusy(true);
    try { await submitYearReview(me, { teamId, academicYear: year, decisions: dec, members: rows }); toast.success("Review saved. Released members lose dashboard access but their history stays."); setRows(rows.filter((m) => dec[m.uid] !== "release")); setDec({}); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  return <>
    <DashHeader eyebrow="ACADEMIC YEAR" title="Retain or release, team by team." subtitle="No manual deleting. Released members (e.g. graduating final-years) move out of the active tree; their records and logs stay. Only the Admin reviews Club Representatives." />
    <Card><CardHeader>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Team"><Select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-64">{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        <Field label="Academic year"><Input value={year} onChange={(e) => setYear(e.target.value)} className="w-32" /></Field>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted">{counts.release} release · {counts.total - counts.release} retain
        <Button onClick={submit} disabled={busy || !rows.length}>{busy ? <Spinner className="text-white" /> : <CheckCircle2 />} Submit review</Button></div>
    </CardHeader><CardContent>
      {loading ? <Spinner /> : !rows.length ? <EmptyState title="No active members in this team" /> :
        <div className="grid gap-3 md:grid-cols-2">{rows.map((m) => {
          const d = dec[m.uid] || "retain";
          return <div key={m.uid} className={cn("flex items-center gap-3 rounded-xl border p-3 transition", d === "release" ? "border-brand-bright bg-[color-mix(in_oklab,var(--red)_10%,transparent)]" : "border-line")}>
            <Avatar src={m.photoUrl} name={m.name} size={44} />
            <div className="min-w-0 flex-1"><div className="truncate font-bold">{m.name}</div><div className="text-[12px] text-muted">{m.designation || roleLabel(m.role)} · {m.year || "—"}</div></div>
            <div className="flex rounded-lg border border-line p-0.5 text-[12px] font-semibold">
              <button className={cn("rounded-md px-2.5 py-1.5", d === "retain" ? "bg-[#14714a] text-white" : "text-muted")} onClick={() => setDec({ ...dec, [m.uid]: "retain" })}>Retain</button>
              <button className={cn("rounded-md px-2.5 py-1.5", d === "release" ? "brand-gradient text-white" : "text-muted")} onClick={() => setDec({ ...dec, [m.uid]: "release" })}>Release</button>
            </div>
          </div>;
        })}</div>}
      {teamId === "core" && <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted"><ShieldAlert size={13} /> Club Representatives can only be reviewed by the Faculty Admin.</p>}
    </CardContent></Card>

    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <Card><CardHeader><div><CardTitle>Released members</CardTitle><CardDescription>Restore anyone released by mistake.</CardDescription></div><Leave className="text-brand-bright" /></CardHeader>
        <CardContent className="max-h-96 space-y-2 overflow-y-auto">{released.map((m) => <div key={m.uid} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm">
          <Avatar src={m.photoUrl} name={m.name} size={36} /><div className="min-w-0 flex-1"><div className="truncate font-bold">{m.name}</div><div className="text-[12px] text-muted">{m.team ? teamName(m.team) : "Core"} · released {m.releasedYear} by {m.releasedBy?.name}</div></div>
          {canReviewTeam(me, m.team || "core") && <Button size="sm" variant="secondary" onClick={() => restoreMember(me, m).then(() => toast.success("Restored.")).catch((e) => toast.error(errMsg(e)))}><RotateCcw /> Restore</Button>}
        </div>)}{!released.length && <p className="text-sm text-muted">Nobody released yet.</p>}</CardContent></Card>
      <Card><CardHeader><div><CardTitle>Review history</CardTitle></div><History className="text-brand-bright" /></CardHeader>
        <CardContent className="max-h-96 space-y-2 overflow-y-auto">{history.map((h) => <div key={h.id} className="space-y-2 rounded-xl border border-line p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="gold">{h.academicYear}</Badge><strong>{h.team === "core" ? "Club Representatives" : teamName(h.team)}</strong><span className="text-muted">· {fmtDate(h.createdAt)}</span></div>
          <div className="text-[12px] text-muted">Retained {h.retained?.length || 0} · Released {h.released?.length || 0}{h.released?.length ? `: ${h.released.map((x) => x.name).join(", ")}` : ""}</div>
          <ActorCard actor={h.actor} compact label="Reviewed by" />
        </div>)}{!history.length && <p className="text-sm text-muted">No reviews yet.</p>}</CardContent></Card>
    </div>
  </>;
}
