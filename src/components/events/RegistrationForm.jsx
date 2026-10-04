import { useMemo, useState } from "react";
import { Plus, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/input";
import { ImageInput } from "@/components/common/ImageInput";
import { Spinner } from "@/components/common/Primitives";
import { createRegistration } from "@/services/registrations";
import { YEARS, DEPARTMENTS } from "@/lib/constants";
import { PHONE_RE, errMsg } from "@/lib/utils";

const blankMember = () => ({ name: "", email: "", phone: "", college: "", photoUrl: "" });

/** Team registration — used for online (event page) and on-spot (inside the chat). */
export function RegistrationForm({ ev, user, mode = "online", onDone, compact }) {
  const min = Math.max(1, ev.teamMin || 1), max = Math.max(min, ev.teamMax || 1);
  const [teamName, setTeamName] = useState("");
  const [leader, setLeader] = useState({ name: user.displayName || "", email: user.email || "", phone: "", college: "Amrita Vishwa Vidyapeetham, Bengaluru", collegeId: "", department: "", year: "", photoUrl: user.photoURL || "" });
  const [members, setMembers] = useState(() => Array.from({ length: min - 1 }, blankMember));
  const [busy, setBusy] = useState(false);
  const errors = useMemo(() => {
    const e = {};
    if (teamName.trim().length < 2) e.teamName = "Team name is required";
    if (!leader.name.trim()) e.name = "Required";
    if (!PHONE_RE.test(leader.phone)) e.phone = "Enter a valid phone number";
    members.forEach((m, i) => { if (!m.name.trim()) e[`m${i}`] = "Name required"; });
    return e;
  }, [teamName, leader, members]);

  async function submit(e) {
    e.preventDefault();
    if (Object.keys(errors).length) { toast.error("Please fill the required fields."); return; }
    setBusy(true);
    try {
      const id = await createRegistration(user, ev, { teamName, leader: { ...leader, email: user.email }, members }, mode);
      toast.success(ev.price ? "Registered! Pay and send the details in the chat within 5 hours." : "You're registered!");
      onDone?.(id);
    } catch (err) {
      toast.error(err.code === "permission-denied" ? "Registration is closed or seats are full." : errMsg(err));
    } finally { setBusy(false); }
  }
  const setL = (k) => (e) => setLeader({ ...leader, [k]: e.target.value });

  return <form onSubmit={submit} className="space-y-6">
    <Field label="Team name" required error={errors.teamName && teamName ? errors.teamName : null}><Input value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={60} placeholder="e.g. The Opposition Bench" /></Field>
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[1.4px] text-brand-bright">Team leader (you)</div>
      <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-[120px_1fr]"}`}>
        <ImageInput value={leader.photoUrl} onChange={(u) => setLeader({ ...leader, photoUrl: u })} kind="avatar" round label="Photo" className="w-24 sm:w-28" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" required><Input value={leader.name} onChange={setL("name")} /></Field>
          <Field label="Email"><Input value={user.email || ""} disabled /></Field>
          <Field label="Phone (WhatsApp)" required error={leader.phone && errors.phone}><Input value={leader.phone} onChange={setL("phone")} inputMode="tel" placeholder="+91 98xxxxxx" /></Field>
          <Field label="College"><Input value={leader.college} onChange={setL("college")} /></Field>
          <Field label="College ID / Roll no."><Input value={leader.collegeId} onChange={setL("collegeId")} placeholder="BL.EN.U4CSE24001" /></Field>
          <Field label="Department"><Select value={leader.department} onChange={setL("department")}><option value="">Select</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</Select></Field>
          <Field label="Year"><Select value={leader.year} onChange={setL("year")}><option value="">Select</option>{YEARS.map((d) => <option key={d}>{d}</option>)}</Select></Field>
        </div>
      </div>
    </div>
    {members.map((m, i) => <div key={i} className="rounded-2xl border border-line p-4">
      <div className="mb-3 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[1.4px] text-muted">Member {i + 2}</span>
        {1 + members.length > min && <button type="button" className="text-muted hover:text-brand-bright" onClick={() => setMembers(members.filter((_, k) => k !== i))} aria-label="Remove member"><Trash2 size={16} /></button>}</div>
      <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-[96px_1fr]"}`}>
        <ImageInput value={m.photoUrl} onChange={(u) => setMembers(members.map((x, k) => (k === i ? { ...x, photoUrl: u } : x)))} kind="avatar" round label="Photo" className="w-20" />
        <div className="grid gap-3 sm:grid-cols-2">
          {["name", "email", "phone", "college"].map((k) => <Field key={k} label={k[0].toUpperCase() + k.slice(1)} required={k === "name"} error={k === "name" && errors[`m${i}`] && m.name === "" ? null : null}>
            <Input value={m[k]} onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} type={k === "email" ? "email" : "text"} />
          </Field>)}
        </div>
      </div>
    </div>)}
    <div className="flex flex-wrap items-center justify-between gap-3">
      {1 + members.length < max ? <Button type="button" variant="secondary" onClick={() => setMembers([...members, blankMember()])}><Plus /> Add member ({1 + members.length}/{max})</Button> : <span className="text-sm text-muted">Team size {1 + members.length}/{max}</span>}
      <Button type="submit" size="lg" disabled={busy}>{busy ? <Spinner className="text-white" /> : <Send />} {mode === "onspot" ? "Register on spot" : "Register team"}{ev.price ? ` · ₹${ev.price}` : ""}</Button>
    </div>
  </form>;
}
