import { useEffect, useMemo, useRef, useState } from "react";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Download, ImageUp, Plus, Save, Sparkles, Trash2, Wand2, Search } from "lucide-react";
import { toast } from "sonner";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Field, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ImageInput } from "@/components/common/ImageInput";
import { UnsplashPicker } from "@/components/common/UnsplashPicker";
import { Spinner, EmptyState } from "@/components/common/Primitives";
import { PermissionGate } from "@/components/forms/PermissionGate";
import { useAuth } from "@/context/AuthContext";
import { useEvents } from "@/hooks/useData";
import { useQueryData } from "@/hooks/useFirestore";
import { eventPhase } from "@/services/events";
import { savePoster } from "@/services/posters";
import { posterCreationMode } from "@/lib/permissions";
import { drawPoster, FORMATS } from "@/lib/poster";
import { uploadImage, dataUrlToBlob, cdn } from "@/lib/image";
import { api } from "@/lib/api";
import { db } from "@/lib/firebase";
import { SITE_URL } from "@/lib/constants";
import { cn, errMsg, timeAgo } from "@/lib/utils";

/** Instagram / LinkedIn poster studio — Media & Design team, Admin, Club Reps; others via permission code. */
export default function PostersPage() {
  const { member: me } = useAuth();
  const { data: all } = useEvents();
  const events = useMemo(() => all.filter((e) => eventPhase(e) !== "past"), [all]);
  const mode = posterCreationMode(me);
  const [grant, setGrant] = useState(null);
  const allowed = mode === "direct" || !!grant;
  const [d, setD] = useState({ eventId: "", format: "instagram", theme: "dark", bgSource: "event", backgroundUrl: "", tagline: "", judges: [], showRules: true, showSponsors: true, showJudges: true });
  const [busy, setBusy] = useState(""); const [unsplash, setUnsplash] = useState(false); const [aiStyle, setAiStyle] = useState("");
  const canvasRef = useRef(); const ev = events.find((e) => e.slug === d.eventId);
  const { data: posters } = useQueryData(() => query(collection(db, "posters"), orderBy("createdAt", "desc"), limit(24)), []);

  const payload = useMemo(() => ev && ({
    eventName: ev.name, tagline: d.tagline || ev.shortDesc, startAt: ev.startAt, location: ev.location, price: ev.price, prizes: ev.prizes,
    rules: (ev.rules || "").split("\n").map((r) => r.trim()).filter(Boolean), sponsors: ev.sponsors || [], judges: d.judges,
    registerUrl: `${SITE_URL}/form/${ev.slug}`, format: d.format, theme: d.theme,
    backgroundUrl: d.bgSource === "event" ? ev.bannerUrl : d.backgroundUrl,
    showRules: d.showRules, showSponsors: d.showSponsors, showJudges: d.showJudges,
  }), [ev, d]);

  useEffect(() => { // live redraw (debounced)
    if (!payload || !canvasRef.current) return;
    const id = setTimeout(() => drawPoster(canvasRef.current, payload).catch((e) => console.warn(e)), 250);
    return () => clearTimeout(id);
  }, [payload]);

  const pick = (slug) => { const e = events.find((x) => x.slug === slug); setD({ ...d, eventId: slug, tagline: e?.shortDesc || "", bgSource: "event" }); };
  async function aiBackground() {
    if (!ev) return toast.error("Pick an event first.");
    setBusy("bg");
    try {
      const r = await api("ai/image", { purpose: "poster", eventName: ev.name, description: ev.shortDesc, theme: d.theme, format: d.format, style: aiStyle, code: grant?.code });
      const url = await uploadImage(await dataUrlToBlob(r.image), { kind: "banner", folder: "amal/posters" });
      setD({ ...d, bgSource: "custom", backgroundUrl: url }); toast.success(`Artwork by ${r.provider}.`);
    } catch (e) { toast.error(e.message); } finally { setBusy(""); }
  }
  async function aiTagline() {
    if (!ev) return; setBusy("tag");
    try { const r = await api("ai/text", { purpose: "tagline", eventName: ev.name, description: ev.fullDesc || ev.shortDesc, code: grant?.code }); setD({ ...d, tagline: r.text }); }
    catch (e) { toast.error(e.message); } finally { setBusy(""); }
  }
  function download() {
    const a = document.createElement("a"); a.href = canvasRef.current.toDataURL("image/png"); a.download = `${ev.slug}-${d.format}-${d.theme}.png`; a.click();
  }
  async function save() {
    setBusy("save");
    try {
      const blob = await new Promise((r) => canvasRef.current.toBlob(r, "image/png"));
      const imageUrl = await uploadImage(blob, { kind: "poster", folder: "amal/posters" });
      await savePoster(me, { eventId: ev.slug, eventName: ev.name, format: d.format, theme: d.theme, imageUrl, judges: d.judges }, mode === "direct" ? null : grant);
      if (mode !== "direct") setGrant(null);
      toast.success("Poster saved to the gallery and logged.");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  }
  const setJ = (i, patch) => setD({ ...d, judges: d.judges.map((j, k) => (k === i ? { ...j, ...patch } : j)) });

  return <>
    <DashHeader eyebrow="MEDIA & DESIGN" title="Poster studio." subtitle="Pick an event — name, description, rules, prizes, sponsor logos and the registration link + QR are prefilled. AI paints the artwork; text and QR stay razor-sharp." />
    {!allowed && <div className="mb-5"><PermissionGate me={me} scope="poster" events={events} grant={grant} onGrant={setGrant} reason="Posters are the Media & Design team's work. Ask the Admin, a Club Representative or the Media & Design Team Lead for a one-time code." /></div>}
    {grant && <div className="mb-5"><PermissionGate me={me} scope="poster" events={events} grant={grant} onGrant={setGrant} /></div>}

    <div className={cn("grid gap-5 xl:grid-cols-[420px_1fr]", !allowed && "pointer-events-none opacity-40")}>
      <div className="space-y-4">
        <Card><CardHeader><CardTitle>1 · Event</CardTitle></CardHeader><CardContent className="space-y-3">
          <Select value={d.eventId} onChange={(e) => pick(e.target.value)}><option value="">Select an upcoming event…</option>{events.map((e) => <option key={e.slug} value={e.slug}>{e.name}</option>)}</Select>
          {ev && <div className="rounded-xl bg-surface-2 p-3 text-[12px] text-muted">Prefilled: {ev.rules ? `${ev.rules.split("\n").filter(Boolean).length} rules · ` : ""}{ev.sponsors?.length || 0} sponsors · {ev.prizes || "no prizes set"} · ₹{ev.price || 0}<br /><span className="font-mono text-fg">{SITE_URL}/form/{ev.slug}</span> (QR auto-generated)</div>}
          <Field label="Tagline"><div className="flex gap-2"><Textarea rows={2} value={d.tagline} onChange={(e) => setD({ ...d, tagline: e.target.value })} className="flex-1" />
            <Button size="icon" variant="secondary" onClick={aiTagline} disabled={!ev || busy === "tag"} title="Write with AI">{busy === "tag" ? <Spinner /> : <Wand2 />}</Button></div></Field>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>2 · Look</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">{["dark", "light"].map((t) => <button key={t} onClick={() => setD({ ...d, theme: t })} className={cn("rounded-xl border p-3 text-sm font-bold capitalize", d.theme === t ? "border-brand-bright brand-gradient text-white" : "border-line")}>{t} theme</button>)}</div>
          <Field label="Format"><Select value={d.format} onChange={(e) => setD({ ...d, format: e.target.value })}>{Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v.label} · {v.w}×{v.h}</option>)}</Select></Field>
          <Field label="Background"><div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant={d.bgSource === "event" ? "default" : "secondary"} onClick={() => setD({ ...d, bgSource: "event" })}>Event banner</Button>
            <Button size="sm" variant="secondary" onClick={() => setUnsplash(true)}><Search /> Unsplash</Button>
            <Button size="sm" variant="secondary" onClick={aiBackground} disabled={!ev || busy === "bg"}>{busy === "bg" ? <Spinner /> : <Sparkles />} AI art</Button>
          </div></Field>
          <Input value={aiStyle} onChange={(e) => setAiStyle(e.target.value)} placeholder="AI art hint (optional): e.g. Indian parliament dome, abstract" className="text-[13px]" />
          <div className="flex flex-wrap gap-3 text-sm text-muted">{[["showRules", "Rules"], ["showSponsors", "Sponsors"], ["showJudges", "Judges"]].map(([k, l]) => <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.checked })} className="accent-[var(--red-bright)]" />{l}</label>)}</div>
        </CardContent></Card>
        <Card><CardHeader><div><CardTitle>3 · Judges</CardTitle><CardDescription>Names and photos (compressed automatically).</CardDescription></div>
          <Button size="sm" variant="secondary" onClick={() => setD({ ...d, judges: [...d.judges, { name: "", title: "", photoUrl: "" }] })} disabled={d.judges.length >= 4}><Plus /> Add</Button></CardHeader>
          <CardContent className="space-y-3">{d.judges.map((j, i) => <div key={i} className="flex items-center gap-3">
            <ImageInput value={j.photoUrl} onChange={(u) => setJ(i, { photoUrl: u })} kind="avatar" round label="Photo" className="w-16 shrink-0" />
            <div className="flex-1 space-y-1.5"><Input value={j.name} onChange={(e) => setJ(i, { name: e.target.value })} placeholder="Judge name" /><Input value={j.title} onChange={(e) => setJ(i, { title: e.target.value })} placeholder="Title / organisation" className="h-9 text-[13px]" /></div>
            <Button size="icon" variant="ghost" onClick={() => setD({ ...d, judges: d.judges.filter((_, k) => k !== i) })} aria-label="Remove judge"><Trash2 /></Button>
          </div>)}{!d.judges.length && <p className="text-sm text-muted">No judges added.</p>}</CardContent></Card>
      </div>

      <div className="space-y-4">
        <Card className="overflow-hidden"><CardContent className="grid place-items-center bg-[repeating-conic-gradient(var(--surface-2)_0_25%,var(--surface)_0_50%)] bg-[length:24px_24px] p-6">
          {ev ? <canvas ref={canvasRef} className={cn("h-auto rounded-xl shadow-2xl", d.format === "linkedin" ? "w-full" : "w-full max-w-[460px]")} />
            : <EmptyState icon={ImageUp} title="Pick an event to start">The poster previews live as you change things.</EmptyState>}
        </CardContent></Card>
        {ev && <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={download}><Download /> Download PNG</Button><Button onClick={save} disabled={busy === "save"}>{busy === "save" ? <Spinner className="text-white" /> : <Save />} Save to gallery</Button></div>}
      </div>
    </div>

    <h2 className="mb-3 mt-10 font-display text-xl font-extrabold">Recent posters</h2>
    {!posters.length ? <EmptyState title="No posters yet" /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{posters.map((p) => <a key={p.id} href={p.imageUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-line bg-surface hover:border-brand-bright">
      <img src={cdn(p.imageUrl, 600)} alt={p.eventName} className="aspect-[4/5] w-full object-cover" />
      <div className="flex items-center gap-2 p-3 text-[12px]"><Avatar src={p.createdBy?.photoUrl} name={p.createdBy?.name} size={26} /><div className="min-w-0 flex-1"><div className="truncate font-bold">{p.eventName}</div><div className="truncate text-muted">{p.createdBy?.name} · {timeAgo(p.createdAt)}</div></div><Badge variant="muted">{p.format}</Badge></div>
    </a>)}</div>}
    <UnsplashPicker open={unsplash} onOpenChange={setUnsplash} initialQuery={ev?.name} onPick={({ url }) => setD({ ...d, bgSource: "custom", backgroundUrl: url })} />
  </>;
}
