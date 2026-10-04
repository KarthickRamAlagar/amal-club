import { useMemo, useState } from "react";
import { collection, orderBy, query, where, limit } from "firebase/firestore";
import { Search, Send, UserPlus, Mail, Clock } from "lucide-react";
import { toast } from "sonner";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShareButtons } from "@/components/common/ShareButtons";
import { Spinner, EmptyState, Pager, usePaged } from "@/components/common/Primitives";
import { MemberCardDialog } from "@/components/members/MemberCard";
import { useAuth } from "@/context/AuthContext";
import { useQueryData } from "@/hooks/useFirestore";
import { useActiveMembers } from "@/hooks/useData";
import { createInvite } from "@/services/members";
import { invitableRoles, roleLabel, TEAMS, teamName, SITE_URL, rankOf } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { errMsg, timeAgo } from "@/lib/utils";

export default function MembersPage() {
  const { member: me } = useAuth();
  const roles = invitableRoles(me.role);
  const [f, setF] = useState({ name: "", email: "", role: roles[roles.length - 1] || "member", team: me.role === "lead" ? me.team : "" });
  const [busy, setBusy] = useState(false); const [issued, setIssued] = useState(null);
  const [q, setQ] = useState(""); const [teamF, setTeamF] = useState("all"); const [page, setPage] = useState(1); const [open, setOpen] = useState(null);
  const needsTeam = f.role === "lead" || f.role === "member";
  const seesAll = rankOf(me.role) >= 70;
  const { data: invites } = useQueryData(() => (seesAll
    ? query(collection(db, "invites"), orderBy("createdAt", "desc"), limit(60))
    : query(collection(db, "invites"), where("createdBy.uid", "==", me.uid), orderBy("createdAt", "desc"), limit(60))), [me.uid, seesAll]);
  const { data: members, loading } = useActiveMembers();
  const filtered = useMemo(() => members.filter((m) =>
    (teamF === "all" || (teamF === "core" ? !m.team : m.team === teamF)) &&
    `${m.name} ${m.email} ${m.amalId} ${m.designation}`.toLowerCase().includes(q.toLowerCase())), [members, q, teamF]);
  const paged = usePaged(filtered, 12, page);

  async function submit(e) {
    e.preventDefault();
    if (needsTeam && !f.team) return toast.error("Pick a team.");
    setBusy(true);
    try {
      const code = await createInvite(me, { ...f, team: needsTeam ? f.team : null });
      setIssued({ code, ...f });
      setF({ ...f, name: "", email: "" });
    } catch (er) { toast.error(errMsg(er)); } finally { setBusy(false); }
  }
  const inviteText = (i) => `Hi ${i.name.split(" ")[0]}! 👋 You've been invited to join AMAL — Amrita Management & Leadership Club as ${roleLabel(i.role)}${i.team ? ` (${teamName(i.team)})` : ""}.\n\nYour invite code: ${i.code}\nJoin here: ${SITE_URL}/join?code=${i.code}\n\nUse ${i.email} as your account email. The code is valid for 7 days.`;

  return <>
    <DashHeader eyebrow="PEOPLE" title="Members & invites." subtitle={me.role === "lead" ? `You can invite members to ${teamName(me.team)}.` : "Invite Club Representatives, Team Leads and Members. They complete onboarding before doing anything."} />
    <div className="grid gap-5 xl:grid-cols-[400px_1fr]">
      <Card className="self-start"><CardHeader><div><CardTitle>Create an AMAL user</CardTitle><CardDescription>Name + email → one-time invite code to share.</CardDescription></div><UserPlus className="text-brand-bright" /></CardHeader>
        <CardContent><form onSubmit={submit} className="space-y-3">
          <Field label="Full name" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
          <Field label="Email address" required><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
          <Field label="Role"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</Select></Field>
          {needsTeam && <Field label="Team" required><Select value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })} disabled={me.role === "lead"}>
            <option value="">Select team</option>{TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? <Spinner className="text-white" /> : <Send />} Generate invite code</Button>
        </form></CardContent></Card>

      <Card><CardHeader><div><CardTitle>Invites</CardTitle><CardDescription>{seesAll ? "All invites" : "Invites you created"} · codes expire after 7 days.</CardDescription></div></CardHeader>
        <CardContent className="max-h-[420px] space-y-2 overflow-y-auto">{invites.map((i) => <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3 text-sm">
          <div className="min-w-0 flex-1"><div className="font-bold">{i.name} <span className="font-normal text-muted">· {i.email}</span></div>
            <div className="text-[12px] text-muted">{roleLabel(i.role)}{i.team ? ` · ${teamName(i.team)}` : ""} · by {i.createdBy?.name} · {timeAgo(i.createdAt)}</div></div>
          {i.used ? <Badge variant="ok">Joined</Badge> : i.expiresAt < Date.now() ? <Badge variant="muted">Expired</Badge>
            : <><Badge variant="warn"><Clock size={11} /> Pending</Badge><Button size="sm" variant="secondary" onClick={() => setIssued(i)}><Send /> Share</Button></>}
        </div>)}{!invites.length && <p className="text-sm text-muted">No invites yet.</p>}</CardContent></Card>
    </div>

    <Card className="mt-5"><CardHeader><div><CardTitle>Active roster</CardTitle><CardDescription>{filtered.length} members</CardDescription></div>
      <div className="flex flex-wrap gap-2"><div className="relative"><Search size={15} className="absolute left-3 top-3.5 text-muted" /><Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name, email, AMAL ID" className="w-64 pl-9" /></div>
        <Select value={teamF} onChange={(e) => { setTeamF(e.target.value); setPage(1); }} className="w-48"><option value="all">All teams</option><option value="core">Core committee</option>{TEAMS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></div></CardHeader>
      <CardContent>{loading ? <Spinner /> : !filtered.length ? <EmptyState title="No members found" /> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{paged.rows.map((m) => <button key={m.uid} onClick={() => setOpen(m)} className="flex items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-brand-bright">
          <Avatar src={m.photoUrl} name={m.name} size={46} /><div className="min-w-0 flex-1"><div className="truncate font-bold">{m.name}</div><div className="truncate text-[12px] text-muted">{m.designation || roleLabel(m.role)} · {m.team ? teamName(m.team) : "Core"}</div>
            <div className="truncate text-[11px] text-muted"><Mail size={10} className="inline" /> {m.email}</div></div>
          {!m.onboarded && <Badge variant="warn">Onboarding</Badge>}</button>)}</div>
        <Pager page={paged.page} pages={paged.pages} onPage={setPage} /></>}</CardContent></Card>

    <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}><DialogContent>
      {issued && <><DialogTitle>Invite ready for {issued.name.split(" ")[0]}</DialogTitle><DialogDescription>Share this one-time code. They'll set their AMAL ID and password, then complete onboarding.</DialogDescription>
        <div className="my-5 rounded-2xl border border-dashed border-brand-bright bg-surface-2 p-5 text-center font-mono text-2xl font-bold tracking-[3px] text-gold">{issued.code}</div>
        <ShareButtons text={inviteText(issued)} subject="Your AMAL Club invite" email={issued.email} /></>}
    </DialogContent></Dialog>
    <MemberCardDialog member={open} onOpenChange={setOpen} />
  </>;
}
