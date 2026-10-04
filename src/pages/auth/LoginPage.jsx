import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { LogIn, Eye, EyeOff, KeyRound } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { toast } from "sonner";
import { AuthShell } from "./AuthShell";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Spinner } from "@/components/common/Primitives";
import { signInMember, resolveLoginEmail } from "@/services/members";
import { useAuth } from "@/context/AuthContext";
import { auth, firebaseReady } from "@/lib/firebase";
import { errMsg } from "@/lib/utils";

export default function LoginPage() {
  const { member, loading } = useAuth();
  const [id, setId] = useState(""); const [pw, setPw] = useState(""); const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const nav = useNavigate(); const loc = useLocation();
  if (!loading && member) return <Navigate to={loc.state?.from || "/dashboard"} replace />;
  async function submit(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await signInMember(id, pw); nav(loc.state?.from || "/dashboard"); }
    catch (er) { setErr(errMsg(er)); } finally { setBusy(false); }
  }
  async function reset() {
    if (!id) return toast.error("Enter your AMAL ID or email first.");
    try { await sendPasswordResetEmail(auth, await resolveLoginEmail(id)); toast.success("Password reset email sent."); } catch (e) { toast.error(errMsg(e)); }
  }
  return <AuthShell title="Welcome back." subtitle="Sign in with your AMAL ID (or email) and password.">
    <form onSubmit={submit} className="mt-2 flex flex-col gap-4">
      {!firebaseReady && <div className="inline-alert">Preview mode: add Firebase keys to enable sign-in.</div>}
      {err && <div className="inline-alert error">{err}</div>}
      <Field label="AMAL ID or email"><Input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" required placeholder="e.g. kanishka.amal" /></Field>
      <Field label="Password"><div className="relative"><Input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
        <button type="button" className="absolute right-3 top-3 text-muted" onClick={() => setShow(!show)} aria-label="Show password">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></Field>
      <Button type="submit" size="lg" disabled={busy}>{busy ? <Spinner className="text-white" /> : <LogIn />} Sign in</Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <Link to="/join" className="inline-flex items-center gap-1 font-semibold text-brand-bright"><KeyRound size={14} /> I have an invite code</Link>
        <button type="button" onClick={reset} className="text-muted hover:text-fg">Forgot password?</button>
      </div>
      <Link to="/" className="inline-link">← Return to public site</Link>
    </form>
  </AuthShell>;
}
