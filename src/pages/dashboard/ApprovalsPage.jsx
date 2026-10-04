import { useState } from "react";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { Check, X, KeyRound, ShieldCheck, Eye } from "lucide-react";
import { toast } from "sonner";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmptyState, Spinner, Pager, usePaged } from "@/components/common/Primitives";
import { ActorCard } from "@/components/common/ActorCard";
import { ShareButtons } from "@/components/common/ShareButtons";
import { reqStatusVariant } from "@/components/forms/PermissionGate";
import { useAuth } from "@/context/AuthContext";
import { useQueryData } from "@/hooks/useFirestore";
import { approveRequest, denyRequest, fetchCodeForRequest } from "@/services/requests";
import { approverType, approverRank } from "@/lib/permissions";
import { SITE_URL, LIMITS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { errMsg, timeAgo, countdown } from "@/lib/utils";

const SCOPE_LABEL = { form: "Form creation", poster: "Poster creation" };

/** Approver inbox: Admin / Club Representatives / Technical Lead (forms) / Media Lead (posters). */
export default function ApprovalsPage() {
  const { member: me } = useAuth();
  const scopes = ["form", "poster"].filter((s) => approverType(me, s));
  const { data: rows, loading } = useQueryData(() => (scopes.length ? query(collection(db, "requests"), where("scope", "in", scopes), orderBy("createdAt", "desc"), limit(200)) : null), [scopes.join()]);
  const [denyFor, setDenyFor] = useState(null); const [reason, setReason] = useState(""); const [issued, setIssued] = useState(null); const [busy, setBusy] = useState("");
  const [page, setPage] = useState(1);
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");
  const dp = usePaged(decided, 10, page);

  async function allow(r) {
    setBusy(r.id);
    try {
      const code = await approveRequest(me, r);
      if (code) setIssued({ code, r }); else toast.success("Approval recorded — a higher-ranked approver already issued the code.");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  }
  async function deny() {
    setBusy(denyFor.id);
    try { await denyRequest(me, denyFor, reason); toast.success("Denied — the requester sees your reason."); setDenyFor(null); setReason(""); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  }
  async function showCode(r) {
    try { const g = await fetchCodeForRequest(r.id); if (!g) return toast.error("No active code for this request."); setIssued({ code: g.code, r }); } catch (e) { toast.error(errMsg(e)); }
  }

  if (!scopes.length) return <EmptyState icon={ShieldCheck} title="You're not an approver" />;
  const card = (r) => {
    const myType = approverType(me, r.scope);
    const outranked = r.status === "allowed" && approverRank(r.decidedBy?.approverType) >= approverRank(myType);
    return <div key={r.id} className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2"><Badge variant="gold">{SCOPE_LABEL[r.scope]}</Badge><Badge variant="muted">{r.eventName || "General"}</Badge><Badge variant={reqStatusVariant[r.status]}>{r.status}</Badge><span className="ml-auto text-[12px] text-muted">{timeAgo(r.createdAt)}</span></div>
      <ActorCard actor={r.requester} label="Requested by" />
      <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm"><div className="text-[11px] font-bold uppercase tracking-wider text-muted">Reason</div>{r.reason}</div>
      {r.decidedBy && <ActorCard className="mt-3" compact actor={r.decidedBy} label={r.status === "denied" ? `Denied · ${r.decisionReason}` : "Allowed by (credited)"} at={r.decidedAt} />}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {(r.status === "pending" || (r.status === "allowed" && !outranked)) && <>
          {r.status === "pending" && <Button variant="danger" size="sm" onClick={() => setDenyFor(r)}><X /> Deny</Button>}
          <Button variant="success" size="sm" disabled={busy === r.id} onClick={() => allow(r)}>{busy === r.id ? <Spinner className="text-white" /> : <Check />} {r.status === "allowed" ? "Allow (higher rank)" : "Allow & issue code"}</Button>
        </>}
        {r.status === "allowed" && <Button variant="secondary" size="sm" onClick={() => showCode(r)}><Eye /> Show code</Button>}
      </div>
    </div>;
  };

  return <>
    <DashHeader eyebrow="APPROVALS" title="Permission requests." subtitle={`Allow issues a one-time code (valid ${LIMITS.codeValidityHours}h) with your role's prefix. If several approvers allow, the highest rank is credited: Admin > Club Representative > Team Lead.`} />
    {loading ? <Spinner /> : <Tabs defaultValue="pending">
      <TabsList><TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger><TabsTrigger value="decided">Decided ({decided.length})</TabsTrigger></TabsList>
      <TabsContent value="pending"><div className="grid gap-4 xl:grid-cols-2">{pending.map(card)}</div>{!pending.length && <EmptyState title="All caught up">No pending requests.</EmptyState>}</TabsContent>
      <TabsContent value="decided"><div className="grid gap-4 xl:grid-cols-2">{dp.rows.map(card)}</div><Pager page={dp.page} pages={dp.pages} onPage={setPage} /></TabsContent>
    </Tabs>}

    <Dialog open={!!denyFor} onOpenChange={(o) => !o && setDenyFor(null)}><DialogContent>
      <DialogTitle>Deny request</DialogTitle><DialogDescription>{denyFor?.requester?.name} will see this reason along with your name and photo.</DialogDescription>
      <Textarea className="mt-4" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. A registration form for this event already exists." />
      <div className="mt-4 flex justify-end"><Button variant="danger" disabled={!reason.trim() || busy} onClick={deny}><X /> Deny with reason</Button></div>
    </DialogContent></Dialog>

    <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}><DialogContent>{issued && <>
      <DialogTitle>One-time code for {issued.r.requester.name.split(" ")[0]}</DialogTitle>
      <DialogDescription>Valid for {countdown(LIMITS.codeValidityHours * 3600000)} · works once · only for {issued.r.requester.name}.</DialogDescription>
      <div className="my-5 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-bright bg-surface-2 p-5 font-mono text-2xl font-bold tracking-[2px] text-gold"><KeyRound />{issued.code}</div>
      <ShareButtons subject="Your AMAL permission code" email={issued.r.requester.email}
        text={`Hi ${issued.r.requester.name.split(" ")[0]}, your AMAL ${SCOPE_LABEL[issued.r.scope].toLowerCase()} request${issued.r.eventName ? ` for ${issued.r.eventName}` : ""} is approved.\n\nOne-time code: ${issued.code}\nValid for 24 hours. Enter it at ${SITE_URL}/dashboard/${issued.r.scope === "poster" ? "posters" : "forms/new"}`} />
    </>}</DialogContent></Dialog>
  </>;
}
