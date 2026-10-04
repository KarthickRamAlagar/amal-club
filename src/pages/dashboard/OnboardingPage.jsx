import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ImageInput } from "@/components/common/ImageInput";
import { Spinner } from "@/components/common/Primitives";
import { useAuth } from "@/context/AuthContext";
import { completeOnboarding, getPrivate } from "@/services/members";
import { YEARS, DEPARTMENTS, roleLabel, teamName } from "@/lib/constants";
import { COLLEGE_ID_RE, PHONE_RE, errMsg } from "@/lib/utils";

export default function OnboardingPage() {
  const { member } = useAuth(); const nav = useNavigate(); const loc = useLocation();
  const isProfile = loc.pathname.endsWith("/profile");
  const [f, setF] = useState({ name: member.name || "", year: member.year || "", department: member.department || "", photoUrl: member.photoUrl || "", linkedin: member.linkedin || "", bio: member.bio || "" });
  const [p, setP] = useState({ collegeId: "", contact: "", collegeEmail: "" });
  const [busy, setBusy] = useState(false); const [touched, setTouched] = useState(false);
  useEffect(() => { getPrivate(member.uid).then((d) => setP((x) => ({ ...x, ...d }))).catch(() => {}); }, [member.uid]);

  const errors = {
    name: f.name.trim().length < 3 && "Full name required",
    year: !f.year && "Select your year",
    department: !f.department && "Select your department",
    photoUrl: !f.photoUrl && "Upload a photo",
    collegeId: !COLLEGE_ID_RE.test(p.collegeId.trim()) && "Must start with BL. and end with 4 digits (e.g. BL.EN.U4CSE24001)",
    contact: !PHONE_RE.test(p.contact.trim()) && "Enter a valid phone number",
    collegeEmail: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.collegeEmail.trim()) && "Enter your college email",
    linkedin: f.linkedin && !/^https?:\/\/(www\.)?linkedin\.com\//i.test(f.linkedin.trim()) && "Paste your full LinkedIn URL",
    bio: f.bio.trim().length < 20 && "Write at least 20 characters",
  };
  const bad = Object.values(errors).filter(Boolean).length;
  const err = (k) => touched && errors[k];

  async function save(e) {
    e.preventDefault(); setTouched(true);
    if (bad) return toast.error(`Fix ${bad} field${bad > 1 ? "s" : ""} to continue.`);
    setBusy(true);
    try {
      await completeOnboarding(member,
        { name: f.name.trim(), year: f.year, department: f.department, photoUrl: f.photoUrl, linkedin: f.linkedin.trim(), bio: f.bio.trim() },
        { collegeId: p.collegeId.trim().toUpperCase(), contact: p.contact.trim(), collegeEmail: p.collegeEmail.trim().toLowerCase() });
      toast.success(isProfile ? "Profile saved." : "Onboarding complete — welcome to AMAL!");
      if (!isProfile) nav("/dashboard");
    } catch (er) { toast.error(errMsg(er)); } finally { setBusy(false); }
  }
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value }); const sp = (k) => (e) => setP({ ...p, [k]: e.target.value });

  return <form onSubmit={save} className="mx-auto max-w-4xl">
    <DashHeader eyebrow={isProfile ? "MY PROFILE" : "STEP 2 OF 2 · ONBOARDING"} title={isProfile ? "Your AMAL card." : "Complete your AMAL profile."}
      subtitle={isProfile ? "This is what people see when they tap you in the team tree." : "You can browse the site now, but every AMAL action unlocks only after onboarding."}
      action={<div className="flex gap-1.5"><Badge variant="gold">{member.designation || roleLabel(member.role)}</Badge><Badge variant="muted">{member.team ? teamName(member.team) : "Core"}</Badge></div>} />
    <Card><CardContent className="grid gap-6 p-6 md:grid-cols-[180px_1fr]">
      <div className="flex flex-col items-center gap-2">
        <ImageInput value={f.photoUrl} onChange={(u) => setF({ ...f, photoUrl: u })} kind="avatar" round label="Upload photo" className="w-40" />
        {err("photoUrl") && <span className="text-[11px] text-brand-bright">{errors.photoUrl}</span>}
        <span className="text-center text-[11px] text-muted">Compressed automatically, quality kept.</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={err("name")} className="sm:col-span-2"><Input value={f.name} onChange={s("name")} /></Field>
        <Field label="Year" required error={err("year")}><Select value={f.year} onChange={s("year")}><option value="">Select year</option>{YEARS.map((y) => <option key={y}>{y}</option>)}</Select></Field>
        <Field label="Department" required error={err("department")}><Select value={f.department} onChange={s("department")}><option value="">Select department</option>{DEPARTMENTS.map((y) => <option key={y}>{y}</option>)}</Select></Field>
        <Field label="College ID number" required error={err("collegeId")} hint="Starts with BL. and ends with 4 digits"><Input value={p.collegeId} onChange={(e) => setP({ ...p, collegeId: e.target.value.toUpperCase() })} placeholder="BL.EN.U4CSE24001" className="font-mono" /></Field>
        <Field label="Contact number" required error={err("contact")}><Input value={p.contact} onChange={sp("contact")} inputMode="tel" placeholder="+91 98xxxxxxxx" /></Field>
        <Field label="College email" required error={err("collegeEmail")}><Input type="email" value={p.collegeEmail} onChange={sp("collegeEmail")} placeholder="bl.en.u4cse24001@bl.students.amrita.edu" /></Field>
        <Field label="LinkedIn profile" error={err("linkedin")}><Input value={f.linkedin} onChange={s("linkedin")} placeholder="https://linkedin.com/in/…" /></Field>
        <Field label="Short description" required error={err("bio")} hint={`${f.bio.length}/280`} className="sm:col-span-2"><Textarea value={f.bio} onChange={s("bio")} maxLength={280} rows={3} placeholder="What you do in AMAL, what you love working on…" /></Field>
        <div className="rounded-xl bg-surface-2 p-3 text-[12px] text-muted sm:col-span-2">College ID, contact and college email stay private (visible only to you and Club Representatives). Name, photo, year, department, LinkedIn and description appear on your member card.</div>
      </div>
    </CardContent></Card>
    <div className="mt-5 flex justify-end"><Button type="submit" size="lg" disabled={busy}>{busy ? <Spinner className="text-white" /> : isProfile ? <Save /> : <CheckCircle2 />} {isProfile ? "Save profile" : "Finish onboarding"}</Button></div>
  </form>;
}
