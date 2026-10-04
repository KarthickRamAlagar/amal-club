import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { AuthShell } from "./AuthShell";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Spinner } from "@/components/common/Primitives";
import { setupFirstAdmin } from "@/services/members";
import { AMAL_ID_RE, errMsg } from "@/lib/utils";

/** One-time: creates the first Faculty Admin. Locked forever once /config/setup exists. */
export default function SetupPage() {
  const [f, setF] = useState({ name: "", email: "", amalId: "", password: "" }); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const nav = useNavigate();
  async function submit(e) {
    e.preventDefault(); setErr("");
    if (!AMAL_ID_RE.test(f.amalId)) return setErr("AMAL ID: 4–24 lowercase letters, numbers, . _ -");
    if (f.password.length < 8) return setErr("Password must be at least 8 characters.");
    setBusy(true);
    try { await setupFirstAdmin(f); nav("/dashboard/onboarding"); } catch (er) { setErr(errMsg(er)); } finally { setBusy(false); }
  }
  const set = (k) => (e) => setF({ ...f, [k]: k === "amalId" ? e.target.value.toLowerCase() : e.target.value });
  return <AuthShell title="First-time setup" subtitle="Create the Faculty Admin account. This page locks itself after the first use." art="Set up AMAL in one minute.">
    {err && <div className="inline-alert error mt-2">{err}</div>}
    <form onSubmit={submit} className="mt-2 flex flex-col gap-4">
      <Field label="Full name"><Input value={f.name} onChange={set("name")} required placeholder="Prof. Sriram Devanathan" /></Field>
      <Field label="Email"><Input type="email" value={f.email} onChange={set("email")} required /></Field>
      <Field label="AMAL ID"><Input value={f.amalId} onChange={set("amalId")} required placeholder="admin.amal" /></Field>
      <Field label="Password"><Input type="password" value={f.password} onChange={set("password")} required autoComplete="new-password" /></Field>
      <Button type="submit" size="lg" disabled={busy}>{busy ? <Spinner className="text-white" /> : <ShieldCheck />} Create admin</Button>
    </form>
  </AuthShell>;
}
