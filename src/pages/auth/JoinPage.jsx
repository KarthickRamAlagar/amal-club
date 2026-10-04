import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, KeyRound } from "lucide-react";
import { AuthShell } from "./AuthShell";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/common/Primitives";
import { getInvite, redeemInvite, amalIdAvailable } from "@/services/members";
import { roleLabel, teamName } from "@/lib/constants";
import { AMAL_ID_RE, errMsg } from "@/lib/utils";

export default function JoinPage() {
  const [params] = useSearchParams(); const nav = useNavigate();
  const [code, setCode] = useState(params.get("code") || ""); const [invite, setInvite] = useState(null);
  const [amalId, setAmalId] = useState(""); const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");

  async function check(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const inv = await getInvite(code); setInvite(inv); setAmalId(inv.name.toLowerCase().split(" ")[0].replace(/[^a-z0-9]/g, "") + ".amal"); }
    catch (er) { setErr(errMsg(er)); } finally { setBusy(false); }
  }
  async function create(e) {
    e.preventDefault(); setErr("");
    const id = amalId.trim().toLowerCase();
    if (!AMAL_ID_RE.test(id)) return setErr("AMAL ID: 4–24 characters, letters, numbers, dot, dash or underscore.");
    if (pw.length < 8) return setErr("Password must be at least 8 characters.");
    if (pw !== pw2) return setErr("Passwords don't match.");
    setBusy(true);
    try {
      if (!(await amalIdAvailable(id))) throw new Error("That AMAL ID is taken. Try another.");
      await redeemInvite(invite, { password: pw, amalId: id });
      nav("/dashboard/onboarding");
    } catch (er) { setErr(errMsg(er)); } finally { setBusy(false); }
  }

  return <AuthShell title={invite ? `Welcome, ${invite.name.split(" ")[0]}!` : "Join AMAL"} subtitle={invite ? "Create your AMAL ID and password. Next you'll complete your profile." : "Enter the invite code you received on WhatsApp or email."} art="Every leader starts with a first step.">
    {err && <div className="inline-alert error mt-2">{err}</div>}
    {!invite ? <form onSubmit={check} className="mt-2 flex flex-col gap-4">
      <Field label="Invite code"><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="AMAL-XXXX-XXXX" required className="font-mono tracking-wider" /></Field>
      <Button type="submit" size="lg" disabled={busy}>{busy ? <Spinner className="text-white" /> : <KeyRound />} Check code</Button>
      <Link to="/login" className="inline-link">Already a member? Sign in</Link>
    </form> : <form onSubmit={create} className="mt-2 flex flex-col gap-4">
      <div className="rounded-xl border border-line bg-surface-2 p-3 text-sm">
        <div className="flex flex-wrap gap-1.5"><Badge variant="gold">{roleLabel(invite.role)}</Badge><Badge variant="muted">{invite.team ? teamName(invite.team) : "Core committee"}</Badge></div>
        <div className="mt-2 text-muted">Account email: <strong className="text-fg">{invite.email}</strong></div>
        <div className="text-muted">Invited by {invite.createdBy?.name} ({invite.createdBy?.designation})</div>
      </div>
      <Field label="Choose your AMAL ID" hint="You'll sign in with this."><Input value={amalId} onChange={(e) => setAmalId(e.target.value.toLowerCase())} required /></Field>
      <Field label="Password"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required autoComplete="new-password" /></Field>
      <Field label="Confirm password"><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required autoComplete="new-password" /></Field>
      <Button type="submit" size="lg" disabled={busy}>{busy ? <Spinner className="text-white" /> : <Check />} Create account <ArrowRight /></Button>
    </form>}
  </AuthShell>;
}
