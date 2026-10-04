import { useState } from "react";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { KeyRound, Send, ShieldCheck, ShieldX, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ActorCard } from "@/components/common/ActorCard";
import { Spinner } from "@/components/common/Primitives";
import { useQueryData } from "@/hooks/useFirestore";
import { createRequest, checkCode } from "@/services/requests";
import { db } from "@/lib/firebase";
import { errMsg, timeAgo, countdown, toMillis } from "@/lib/utils";

const WHO = { form: "Admin, a Club Representative or the Technical Team Lead", poster: "Admin, a Club Representative or the Media & Design Team Lead" };

/**
 * Request → approver allows (one-time code, 24h) or denies (with reason) → requester enters code.
 * Calls onGrant({code, requestId}) once a valid code is entered.
 */
export function PermissionGate({ me, scope, events, grant, onGrant, reason: why }) {
  const [ev, setEv] = useState(""); const [reason, setReason] = useState(""); const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [view, setView] = useState(null);
  const { data: mine } = useQueryData(() => query(collection(db, "requests"), where("requester.uid", "==", me.uid), where("scope", "==", scope), orderBy("createdAt", "desc"), limit(6)), [me.uid, scope]);
  const pending = mine.find((r) => r.status === "pending");

  async function request(e) {
    e.preventDefault();
    if (reason.trim().length < 10) return toast.error("Explain why in at least 10 characters.");
    setBusy(true);
    try { await createRequest(me, { scope, reason, event: events.find((x) => x.slug === ev) }); toast.success("Request sent to approvers."); setReason(""); }
    catch (er) { toast.error(errMsg(er)); } finally { setBusy(false); }
  }
  async function redeem(e) {
    e.preventDefault(); setBusy(true);
    try { const g = await checkCode(me, code, scope); onGrant({ code: g.code, requestId: g.requestId, issuedBy: g.issuedBy }); toast.success("Code accepted — you can create now."); }
    catch (er) { toast.error(errMsg(er)); } finally { setBusy(false); }
  }

  if (grant) return <Card className="border-[color-mix(in_oklab,#3ccf8e_40%,transparent)]"><CardContent className="flex flex-wrap items-center gap-3 p-4">
    <CheckCircle2 className="text-ok" /><div className="flex-1 text-sm"><strong>Permission code {grant.code}</strong> will be used when you save. <span className="text-muted">One-time · issued by {grant.issuedBy?.name}</span></div>
    <Button size="sm" variant="ghost" onClick={() => onGrant(null)}>Remove</Button>
  </CardContent></Card>;

  return <Card><CardContent className="grid gap-5 p-5 lg:grid-cols-2">
    <div>
      <div className="flex items-center gap-2 font-display text-[16px] font-extrabold"><ShieldCheck className="text-brand-bright" size={18} /> Permission needed</div>
      <p className="mt-1 text-sm text-muted">{why || `Ask ${WHO[scope]} for a one-time code (valid 24 hours).`}</p>
      {pending ? <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2 p-3 text-sm"><Clock size={16} className="text-warn" /> Request pending · sent {timeAgo(pending.createdAt)}</div>
        : <form onSubmit={request} className="mt-4 space-y-3">
          <Field label="For which event?"><Select value={ev} onChange={(e) => setEv(e.target.value)}><option value="">General / not event-specific</option>{events.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}</Select></Field>
          <Field label="Reason" required><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={scope === "form" ? "e.g. Feedback form for Mock Parliament judges" : "e.g. LinkedIn poster for Innovate X sponsors"} /></Field>
          <Button type="submit" disabled={busy}>{busy ? <Spinner className="text-white" /> : <Send />} Request permission</Button>
        </form>}
      <form onSubmit={redeem} className="mt-5 flex gap-2 border-t border-line pt-4">
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={scope === "form" ? "ADMIN-AMAL-1234 / OB-AMAL-123456 / TTL-AMAL-1234" : "ADMIN-… / OB-… / MTL-AMAL-1234"} className="font-mono" />
        <Button type="submit" variant="secondary" disabled={busy || !code}><KeyRound /> Use code</Button>
      </form>
    </div>
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[1.4px] text-muted">Your recent requests</div>
      <div className="space-y-2">{mine.map((r) => <button key={r.id} onClick={() => setView(r)} className="flex w-full items-center justify-between gap-2 rounded-xl border border-line p-3 text-left text-sm hover:border-brand-bright">
        <span className="min-w-0 truncate">{r.eventName || "General"} · <span className="text-muted">{r.reason}</span></span>
        <Badge variant={{ pending: "warn", allowed: "ok", denied: "default", used: "muted" }[r.status]}>{r.status}</Badge></button>)}
        {!mine.length && <p className="text-sm text-muted">No requests yet.</p>}</div>
    </div>
    <RequestDecisionDialog request={view} onOpenChange={setView} />
  </CardContent></Card>;
}

/** Shown to the requester for both Allowed and Denied: who decided, with photo, name, email, AMAL ID, designation, team. */
export function RequestDecisionDialog({ request: r, onOpenChange }) {
  return <Dialog open={!!r} onOpenChange={(o) => !o && onOpenChange(null)}><DialogContent>{r && <>
    <div className="flex items-center gap-3">
      {r.status === "denied" ? <ShieldX className="text-brand-bright" size={30} /> : r.status === "pending" ? <Clock className="text-warn" size={30} /> : <ShieldCheck className="text-ok" size={30} />}
      <div><DialogTitle>{r.status === "denied" ? "Request denied" : r.status === "pending" ? "Waiting for a decision" : r.status === "used" ? "Permission used" : "Request allowed"}</DialogTitle>
        <DialogDescription>{r.scope === "poster" ? "Poster creation" : "Form creation"} · {r.eventName || "General"}</DialogDescription></div>
    </div>
    <div className="mt-4 rounded-xl bg-surface-2 p-3 text-sm"><div className="text-[11px] font-bold uppercase tracking-wider text-muted">Your reason</div>{r.reason}</div>
    {r.decidedBy && <ActorCard className="mt-4" actor={r.decidedBy} label={r.status === "denied" ? "Denied by" : "Allowed by"} at={r.decidedAt} />}
    {r.status === "denied" && <div className="mt-3 rounded-xl border border-brand-bright/40 bg-[color-mix(in_oklab,var(--red)_10%,transparent)] p-3 text-sm"><div className="text-[11px] font-bold uppercase tracking-wider text-brand-bright">Reason for denial</div>{r.decisionReason}</div>}
    {r.status === "allowed" && <p className="mt-3 text-sm text-muted">Ask <strong className="text-fg">{r.decidedBy?.name}</strong> for your one-time code. It expires in {countdown((r.codeExpiresAt || 0) - Date.now())}.</p>}
    {r.approvals?.length > 1 && <div className="mt-4 space-y-2"><div className="text-[11px] font-bold uppercase tracking-wider text-muted">All approvals</div>{r.approvals.map((a, i) => <ActorCard key={i} actor={a} compact at={a.at} />)}</div>}
  </>}</DialogContent></Dialog>;
}

export const reqStatusVariant = { pending: "warn", allowed: "ok", denied: "default", used: "muted" };
export const sortNewest = (rows) => [...rows].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
