import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, Infinity as Inf, Gauge, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PermissionGate } from "@/components/forms/PermissionGate";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { Spinner } from "@/components/common/Primitives";
import { useAuth } from "@/context/AuthContext";
import { useEvents } from "@/hooks/useData";
import { eventPhase } from "@/services/events";
import { saveForm, getQuota, FIELD_TYPES } from "@/services/forms";
import { formCreationMode } from "@/lib/permissions";
import { LIMITS } from "@/lib/constants";
import { errMsg, randomToken } from "@/lib/utils";
import { cdn as cdnImg } from "@/lib/image";

const uid = () => randomToken(6).toLowerCase();
const PREFILL = [
  { id: uid(), type: "text", label: "Full name", required: true },
  { id: uid(), type: "email", label: "Email", required: true },
  { id: uid(), type: "phone", label: "Phone (WhatsApp)", required: true },
  { id: uid(), type: "text", label: "Team name", required: false },
];

export default function FormEditorPage() {
  const { member: me } = useAuth(); const nav = useNavigate();
  const { data: allEvents } = useEvents();
  const events = useMemo(() => allEvents.filter((e) => eventPhase(e) !== "past"), [allEvents]);
  const mode = formCreationMode(me);
  const [quota, setQuota] = useState(null); const [grant, setGrant] = useState(null);
  const [f, setF] = useState({ eventId: "", title: "", description: "", fields: PREFILL });
  const [preview, setPreview] = useState({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (mode === "quota") getQuota(me.uid).then(setQuota).catch(() => setQuota({ used: 0 })); }, [mode, me.uid]);
  const ev = events.find((e) => e.slug === f.eventId);

  // Prefill title/description from the selected event
  function pickEvent(slug) {
    const e = events.find((x) => x.slug === slug);
    setF((cur) => ({ ...cur, eventId: slug, title: e ? `${e.name} — Form` : cur.title, description: e ? e.shortDesc : cur.description }));
  }
  const needsCode = mode === "code" || (mode === "quota" && quota && quota.used >= LIMITS.formsPerDay);
  const setField = (i, patch) => setF({ ...f, fields: f.fields.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  const move = (i, d) => { const a = [...f.fields]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setF({ ...f, fields: a }); };

  async function save() {
    if (!ev) return toast.error("Select the event this form belongs to.");
    if (!f.title.trim()) return toast.error("Give the form a title.");
    if (!f.fields.length) return toast.error("Add at least one question.");
    if (f.fields.some((x) => !x.label.trim())) return toast.error("Every question needs a label.");
    if (f.fields.some((x) => ["select", "radio", "checkbox"].includes(x.type) && !(x.options || []).filter(Boolean).length)) return toast.error("Choice questions need options.");
    if (needsCode && !grant) return toast.error("Enter a permission code first.");
    setBusy(true);
    try {
      const id = await saveForm(me, { ...f, eventName: ev.name, fields: f.fields.map((x) => ({ ...x, options: (x.options || []).filter(Boolean) })) }, needsCode ? grant : null);
      toast.success("Form created and logged."); nav(`/dashboard/forms/${id}`);
    } catch (er) { toast.error(errMsg(er)); } finally { setBusy(false); }
  }

  return <>
    <DashHeader eyebrow="FORM CREATION" title="Build an event form." subtitle="Your own AMAL form, prefilled from the event you pick. It closes automatically when the event is completed."
      action={<div className="flex items-center gap-2">
        {mode === "unlimited" && <Badge variant="ok"><Inf size={12} /> Admin · no limit</Badge>}
        {mode === "quota" && quota && <Badge variant={needsCode ? "default" : "gold"}><Gauge size={12} /> {quota.used}/{LIMITS.formsPerDay} free forms today</Badge>}
        {mode === "code" && <Badge variant="warn"><KeyRound size={12} /> Needs permission code</Badge>}
        <Link to="/dashboard/forms" className="text-sm font-semibold text-muted">← Forms</Link></div>} />
    {needsCode && <div className="mb-5"><PermissionGate me={me} scope="form" events={events} grant={grant} onGrant={setGrant}
      reason={mode === "quota" ? `You've used your ${LIMITS.formsPerDay} free forms for today. Ask the Admin, a Club Representative or the Technical Team Lead for a one-time code.` : undefined} /></div>}

    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <Card><CardHeader><CardTitle>Form details</CardTitle></CardHeader><CardContent className="space-y-3">
          <Field label="Event" required><Select value={f.eventId} onChange={(e) => pickEvent(e.target.value)}><option value="">Select an upcoming event…</option>{events.map((e) => <option key={e.slug} value={e.slug}>{e.name}</option>)}</Select></Field>
          <Field label="Title" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={100} /></Field>
          <Field label="Description"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={500} /></Field>
        </CardContent></Card>
        {f.fields.map((x, i) => <Card key={x.id}><CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full brand-gradient text-[12px] font-bold text-white">{i + 1}</span>
            <Input value={x.label} onChange={(e) => setField(i, { label: e.target.value })} placeholder="Question" className="min-w-48 flex-1" />
            <Select value={x.type} onChange={(e) => setField(i, { type: e.target.value })} className="w-44">{FIELD_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select>
          </div>
          {["select", "radio", "checkbox"].includes(x.type) && <Field label="Options (one per line)"><Textarea rows={3} value={(x.options || []).join("\n")} onChange={(e) => setField(i, { options: e.target.value.split("\n") })} /></Field>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={!!x.required} onChange={(e) => setField(i, { required: e.target.checked })} className="accent-[var(--red-bright)]" /> Required</label>
            <div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp /></Button><Button size="icon" variant="ghost" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown /></Button>
              <Button size="icon" variant="ghost" onClick={() => setF({ ...f, fields: f.fields.filter((_, k) => k !== i) })} aria-label="Delete"><Trash2 /></Button></div>
          </div>
        </CardContent></Card>)}
        <Button variant="secondary" onClick={() => setF({ ...f, fields: [...f.fields, { id: uid(), type: "text", label: "", required: false }] })}><Plus /> Add question</Button>
      </div>

      <div className="space-y-4 xl:sticky xl:top-28 xl:self-start">
        <Card className="overflow-hidden"><div className="relative h-32 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(180deg,transparent,rgba(16,9,13,.85)),url("${cdnImg(ev?.bannerUrl, 900) || "/amal-logo.jpg"}")` }}>
          <img src="/amal-logo.jpg" alt="" className="absolute left-4 top-4 h-10 w-10 rounded-full bg-white" />
          <div className="absolute bottom-3 left-4 right-4 text-white"><div className="text-[10px] font-bold uppercase tracking-[1.5px] opacity-80">Live preview</div><div className="truncate font-display text-lg font-extrabold">{f.title || "Untitled form"}</div></div></div>
          <CardContent className="max-h-[60vh] overflow-y-auto p-5">{f.description && <p className="mb-4 text-sm text-muted">{f.description}</p>}<FormRenderer fields={f.fields} values={preview} onChange={setPreview} /></CardContent></Card>
        <Button size="lg" className="w-full" onClick={save} disabled={busy || (needsCode && !grant)}>{busy ? <Spinner className="text-white" /> : <Save />} Create form</Button>
      </div>
    </div>
  </>;
}
