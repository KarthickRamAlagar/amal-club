import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDown, ArrowLeft, ArrowUp, Clapperboard, Download, Film, Music2, Plus, Save, Scissors, Square, Trash2, Volume2, VolumeX, X,
} from "lucide-react";
import { toast } from "sonner";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState, Spinner } from "@/components/common/Primitives";
import { EventSelect } from "@/components/media/EventSelect";
import { useAuth } from "@/context/AuthContext";
import { useEvents } from "@/hooks/useData";
import { FORMATS, MAX_INPUT_MB, MAX_TOTAL_SECONDS, cancelFFmpeg, getFFmpeg, probeWithFFmpeg, readVideoMeta, renderVideo } from "@/lib/videoEngine";
import { MAX_VIDEO_MB, saveMedia, uploadMediaFile } from "@/services/media";
import { canCreateMedia } from "@/lib/permissions";
import { cn, errMsg, fmtDate } from "@/lib/utils";

let uid = 0;
const nextId = () => `c${++uid}`;
const secs = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const clipLen = (c) => (c.type === "image" ? c.still : Math.max(0, c.end - c.start));

export default function VideoStudioPage() {
  const { member: me } = useAuth();
  const { data: events } = useEvents();
  const [params] = useSearchParams();
  const [eventId, setEventId] = useState(params.get("event") || "");
  const ev = events.find((e) => e.slug === eventId) || null;

  const [clips, setClips] = useState([]);
  const [sel, setSel] = useState(null);
  const [opt, setOpt] = useState({ format: "reel", quality: "720", fit: "blur", bg: "#0f0408", fade: true, title: { text: "", sub: "", seconds: 3 }, caption: "", logo: true, music: null });
  const [titleTouched, setTitleTouched] = useState(false);
  const [render, setRender] = useState({ busy: false, stage: "", p: 0 });
  const [out, setOut] = useState(null); // { blob, url }
  const [save, setSave] = useState({ title: "", visibility: "public", busy: "" });
  const fileIn = useRef(null); const musicIn = useRef(null); const player = useRef(null);

  // default title from the event
  useEffect(() => {
    if (ev && !titleTouched) setOpt((o) => ({ ...o, title: { ...o.title, text: ev.name, sub: `${fmtDate(ev.startAt)} · ${ev.location || "Amrita Bengaluru"}` }, caption: o.caption || "AMAL · Amrita Bengaluru" }));
    if (ev) setSave((s) => ({ ...s, title: s.title || `${ev.name} – highlights` }));
  }, [ev?.slug]); // eslint-disable-line react-hooks/exhaustive-deps
  // warm up the engine in the background
  useEffect(() => { getFFmpeg().catch(() => {}); }, []);
  useEffect(() => () => { clips.forEach((c) => URL.revokeObjectURL(c.url)); if (out) URL.revokeObjectURL(out.url); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const total = useMemo(() => clips.reduce((s, c) => s + clipLen(c), 0), [clips]);
  const inputMB = useMemo(() => clips.reduce((s, c) => s + c.file.size, 0) / 1048576 + (opt.music?.file?.size || 0) / 1048576, [clips, opt.music]);
  const current = clips.find((c) => c.id === sel) || null;

  async function addFiles(list) {
    const added = [];
    for (const f of Array.from(list || [])) {
      if (f.type.startsWith("video/")) {
        const m = await readVideoMeta(f);
        let duration = m.duration, noPreview = false;
        if (!duration) { // browser can't decode it (e.g. iPhone HEVC) — ffmpeg still can
          const t = toast.loading(`Reading ${f.name}…`);
          try { duration = (await probeWithFFmpeg(f)).duration; noPreview = true; toast.dismiss(t); } catch { toast.dismiss(t); }
          if (!duration) { toast.error(`${f.name}: this file couldn't be read. Export it as MP4 and try again.`); URL.revokeObjectURL(m.url); continue; }
        }
        added.push({ id: nextId(), type: "video", file: f, name: f.name, url: m.url, thumb: m.thumb, duration, start: 0, end: Math.min(duration, 60), muted: false, noPreview });
      } else if (f.type.startsWith("image/")) {
        added.push({ id: nextId(), type: "image", file: f, name: f.name, url: URL.createObjectURL(f), thumb: "", duration: 0, still: 3, start: 0, end: 0 });
      } else toast.error(`${f.name}: only videos and photos.`);
    }
    if (added.length) { setClips((c) => [...c, ...added]); setSel((s) => s || added[0].id); setOut(null); }
  }
  const patch = (id, p) => { setClips((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c))); setOut(null); };
  const move = (i, d) => { setOut(null); setClips((cs) => { const a = [...cs]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; }); };
  const remove = (id) => { setClips((cs) => cs.filter((c) => c.id !== id)); if (sel === id) setSel(null); setOut(null); };

  // keep the preview player inside the trim range
  useEffect(() => {
    const v = player.current; if (!v || current?.type !== "video") return;
    const onTime = () => { if (v.currentTime >= current.end) { v.pause(); v.currentTime = current.start; } if (v.currentTime < current.start - 0.05) v.currentTime = current.start; };
    v.addEventListener("timeupdate", onTime); return () => v.removeEventListener("timeupdate", onTime);
  }, [current?.id, current?.start, current?.end, current?.type]);

  async function exportVideo() {
    if (!clips.length) return toast.error("Add at least one clip or photo.");
    if (total > MAX_TOTAL_SECONDS) return toast.error(`Keep it under ${MAX_TOTAL_SECONDS / 60} minutes — trim some clips. For longer films use Canva or a desktop editor.`);
    if (inputMB > MAX_INPUT_MB) return toast.error(`Your clips add up to ${Math.round(inputMB)} MB. Keep it under ${MAX_INPUT_MB} MB (browser memory).`);
    if (out) URL.revokeObjectURL(out.url);
    setOut(null); setRender({ busy: true, stage: "Starting…", p: 0 });
    try {
      const blob = await renderVideo(clips, opt, { onStage: (stage) => setRender((r) => ({ ...r, stage })), onProgress: (p) => setRender((r) => ({ ...r, p })) });
      setOut({ blob, url: URL.createObjectURL(blob) });
      toast.success("Video ready.");
    } catch (e) {
      if (!/terminate|abort/i.test(String(e?.message))) toast.error(errMsg(e));
    } finally { setRender({ busy: false, stage: "", p: 0 }); }
  }
  function cancel() { cancelFFmpeg(); setRender({ busy: false, stage: "", p: 0 }); toast("Export cancelled."); }

  async function saveToEvent() {
    if (!ev) return toast.error("Choose the event this video belongs to.");
    if (out.blob.size > MAX_VIDEO_MB * 1048576) return toast.error(`This video is ${(out.blob.size / 1048576).toFixed(0)} MB — over the ${MAX_VIDEO_MB} MB limit. Export at 720p or shorten it.`);
    try {
      setSave((s) => ({ ...s, busy: "Uploading 0%…" }));
      const up = await uploadMediaFile(new File([out.blob], `${ev.slug}-video.mp4`, { type: "video/mp4" }), { kind: "video", eventId: ev.slug, onProgress: (p) => setSave((s) => ({ ...s, busy: `Uploading ${Math.round(p * 100)}%…` })) });
      setSave((s) => ({ ...s, busy: "Saving…" }));
      await saveMedia(me, ev, { kind: "video", source: "studio", format: opt.format, title: save.title || `${ev.name} video`, url: up.url, width: up.width, height: up.height, bytes: up.bytes, duration: up.duration || total, fileType: "video/mp4", editor: "AMAL Video Studio", visibility: save.visibility });
      toast.success(`Saved to ${ev.name}'s videos.`);
    } catch (e) { toast.error(errMsg(e)); } finally { setSave((s) => ({ ...s, busy: "" })); }
  }

  if (!canCreateMedia(me)) return <EmptyState title="Video Studio is for the Admin, Club Representatives, Team Leads and the Media & Design team." />;
  const [W, H] = FORMATS[opt.format][opt.quality];
  const setO = (p) => { setOpt((o) => ({ ...o, ...p })); setOut(null); };

  return <>
    <DashHeader eyebrow="VIDEO STUDIO · OPEN-SOURCE FFMPEG" title="Cut a reel in your browser." subtitle="Clips stay on your device while you edit. Only the finished MP4 is uploaded — when you save it to the event."
      action={<Button asChild variant="secondary"><Link to={`/dashboard/media${eventId ? `?event=${eventId}` : ""}`}><ArrowLeft /> Media studio</Link></Button>} />

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
      {/* ── left: clips + preview ── */}
      <div className="space-y-5">
        <Card><CardHeader><div><CardTitle className="flex items-center gap-2"><Film size={18} className="text-brand-bright" /> Clips &amp; photos</CardTitle>
          <CardDescription>{clips.length ? `${clips.length} item${clips.length > 1 ? "s" : ""} · ${secs(total)} total` : "Add videos (MP4, MOV, WebM) and photos. Drag & drop works too."}</CardDescription></div>
          <Button onClick={() => fileIn.current?.click()}><Plus /> Add clips / photos</Button>
          <input ref={fileIn} type="file" multiple hidden accept="video/*,image/*" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </CardHeader>
          <CardContent onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
            {!clips.length ? <button type="button" onClick={() => fileIn.current?.click()} className="grid w-full place-items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-surface-2 p-10 text-sm text-muted hover:border-brand-bright">
              <Clapperboard className="text-brand-bright" size={30} /><strong className="text-fg">Drop your event clips and photos here</strong>Order them, trim, then export.</button>
              : <ol className="space-y-2">{clips.map((c, i) => <li key={c.id} onClick={() => setSel(c.id)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-2 transition", sel === c.id ? "border-brand-bright bg-surface-2" : "border-line hover:border-brand-bright/50")}>
                <span className="w-5 text-center text-[12px] font-bold text-muted">{i + 1}</span>
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-black">{c.type === "image" ? <img src={c.url} alt="" className="h-full w-full object-cover" /> : c.thumb ? <img src={c.thumb} alt="" className="h-full w-full object-cover" /> : null}</div>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{c.name}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted"><Badge variant={c.type === "image" ? "gold" : "muted"}>{c.type === "image" ? "Photo" : "Video"}</Badge>
                    {c.type === "video" ? <span><Scissors size={11} className="inline" /> {secs(c.start)} → {secs(c.end)} ({secs(clipLen(c))})</span> : <span>{c.still}s on screen</span>}
                    {c.muted && <span><VolumeX size={11} className="inline" /> muted</span>}</div></div>
                <div className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, 1)} disabled={i === clips.length - 1} aria-label="Move down"><ArrowDown /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(c.id)} aria-label="Remove"><Trash2 /></Button>
                </div>
              </li>)}</ol>}
          </CardContent></Card>

        {current && <Card><CardHeader><div><CardTitle>Trim · {current.name}</CardTitle><CardDescription>{current.type === "video" ? "Play, then set the start and end points." : "How long this photo stays on screen."}</CardDescription></div>
          <Button size="sm" variant="ghost" onClick={() => setSel(null)}><X /></Button></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid place-items-center overflow-hidden rounded-xl bg-black">
              {current.type === "video" && current.noPreview ? <p className="p-8 text-center text-sm text-white/80">Your browser can't preview this format, but the Video Studio can still cut it — use the sliders below.</p>
                : current.type === "video" ? <video ref={player} key={current.id} src={current.url} controls playsInline className="max-h-[360px] w-auto" onLoadedMetadata={(e) => { e.currentTarget.currentTime = current.start; }} />
                : <img src={current.url} alt="" className="max-h-[360px] w-auto" />}
            </div>
            {current.type === "video" ? <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={`Start · ${secs(current.start)}`}><input type="range" min={0} max={current.duration} step={0.1} value={current.start} className="w-full accent-[var(--red-bright)]" onChange={(e) => patch(current.id, { start: Math.min(+e.target.value, current.end - 0.3) })} /></Field>
                <Field label={`End · ${secs(current.end)}`}><input type="range" min={0} max={current.duration} step={0.1} value={current.end} className="w-full accent-[var(--red-bright)]" onChange={(e) => patch(current.id, { end: Math.max(+e.target.value, current.start + 0.3) })} /></Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => player.current && patch(current.id, { start: Math.min(player.current.currentTime, current.end - 0.3) })}>Set start at playhead</Button>
                <Button size="sm" variant="secondary" onClick={() => player.current && patch(current.id, { end: Math.max(player.current.currentTime, current.start + 0.3) })}>Set end at playhead</Button>
                <Button size="sm" variant="ghost" onClick={() => patch(current.id, { start: 0, end: current.duration })}>Use full clip</Button>
                <Button size="sm" variant="ghost" onClick={() => patch(current.id, { muted: !current.muted })}>{current.muted ? <><Volume2 /> Unmute</> : <><VolumeX /> Mute clip sound</>}</Button>
              </div>
            </> : <Field label={`On screen · ${current.still}s`}><input type="range" min={1} max={10} step={0.5} value={current.still} className="w-full accent-[var(--red-bright)]" onChange={(e) => patch(current.id, { still: +e.target.value })} /></Field>}
          </CardContent></Card>}

        {(render.busy || out) && <Card><CardHeader><div><CardTitle>{render.busy ? "Exporting…" : "Your video"}</CardTitle><CardDescription>{render.busy ? render.stage : `${W}×${H} · ${(out.blob.size / 1048576).toFixed(1)} MB · ${secs(total)}`}</CardDescription></div>
          {render.busy && <Button size="sm" variant="danger" onClick={cancel}><Square /> Cancel</Button>}</CardHeader>
          <CardContent className="space-y-4">
            {render.busy ? <><div className="h-3 overflow-hidden rounded-full bg-surface-2"><div className="h-full brand-gradient transition-all" style={{ width: `${Math.round(render.p * 100)}%` }} /></div>
              <p className="text-[12px] text-muted">{Math.round(render.p * 100)}% · keep this tab open. 720p is much faster than 1080p in the browser.</p></>
              : <>
                <div className="grid place-items-center overflow-hidden rounded-xl bg-black"><video src={out.url} controls playsInline className="max-h-[420px] w-auto" /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Event" required className="sm:col-span-2"><EventSelect events={events} value={eventId} onChange={setEventId} /></Field>
                  <Field label="Title"><Input value={save.title} onChange={(e) => setSave((s) => ({ ...s, title: e.target.value }))} maxLength={120} /></Field>
                  <Field label="Who can see it"><Select value={save.visibility} onChange={(e) => setSave((s) => ({ ...s, visibility: e.target.value }))}><option value="public">Public event page</option><option value="internal">Team only</option></Select></Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="secondary"><a href={out.url} download={`${ev?.slug || "amal"}-video.mp4`}><Download /> Download MP4</a></Button>
                  <Button onClick={saveToEvent} disabled={!!save.busy || !eventId}>{save.busy ? <><Spinner className="text-white" /> {save.busy}</> : <><Save /> Save to event</>}</Button>
                </div>
              </>}
          </CardContent></Card>}
      </div>

      {/* ── right: settings ── */}
      <div className="space-y-5">
        <Card><CardHeader><CardTitle>Output</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Event" className="sm:col-span-2"><EventSelect events={events} value={eventId} onChange={setEventId} /></Field>
          <Field label="Format" className="sm:col-span-2"><Select value={opt.format} onChange={(e) => setO({ format: e.target.value })}>{Object.entries(FORMATS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</Select></Field>
          <Field label="Quality" hint={`${W}×${H}`}><Select value={opt.quality} onChange={(e) => setO({ quality: e.target.value })}><option value="720">720p · fast</option><option value="1080">1080p · sharper, slower</option></Select></Field>
          <Field label="Fit clips"><Select value={opt.fit} onChange={(e) => setO({ fit: e.target.value })}><option value="blur">Whole clip · blurred background</option><option value="cover">Fill frame (crop edges)</option><option value="pad">Whole clip · crimson bars</option></Select></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={opt.fade} onChange={(e) => setO({ fade: e.target.checked })} className="accent-[var(--red-bright)]" /> Fade between clips</label>
        </CardContent></Card>

        <Card><CardHeader><div><CardTitle>Title &amp; text</CardTitle><CardDescription>Shown at the start; uses the AMAL Manrope font.</CardDescription></div></CardHeader><CardContent className="grid gap-3">
          <Field label="Title"><Input value={opt.title.text} maxLength={60} onChange={(e) => { setTitleTouched(true); setO({ title: { ...opt.title, text: e.target.value } }); }} placeholder="Event name" /></Field>
          <Field label="Sub-line (gold)"><Input value={opt.title.sub} maxLength={70} onChange={(e) => { setTitleTouched(true); setO({ title: { ...opt.title, sub: e.target.value } }); }} placeholder="Date · venue" /></Field>
          <Field label={`Title on screen · ${opt.title.seconds}s`}><input type="range" min={1} max={8} step={0.5} value={opt.title.seconds} className="w-full accent-[var(--red-bright)]" onChange={(e) => setO({ title: { ...opt.title, seconds: +e.target.value } })} /></Field>
          <Field label="Bottom caption (whole video)"><Input value={opt.caption} maxLength={70} onChange={(e) => setO({ caption: e.target.value })} placeholder="e.g. Register: amal-club.vercel.app" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={opt.logo} onChange={(e) => setO({ logo: e.target.checked })} className="accent-[var(--red-bright)]" /> AMAL logo badge (top-right)</label>
        </CardContent></Card>

        <Card><CardHeader><div><CardTitle className="flex items-center gap-2"><Music2 size={18} className="text-brand-bright" /> Music</CardTitle><CardDescription>Use music you have the rights to (e.g. YouTube Audio Library, Pixabay Music).</CardDescription></div></CardHeader><CardContent className="grid gap-3">
          {opt.music ? <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 p-3 text-sm"><span className="truncate">{opt.music.file.name}</span><Button size="sm" variant="ghost" onClick={() => setO({ music: null })}><X /></Button></div>
            : <Button variant="secondary" onClick={() => musicIn.current?.click()}><Music2 /> Add a music track</Button>}
          <input ref={musicIn} type="file" hidden accept="audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setO({ music: { file: f, volume: 0.8, keepClipAudio: false } }); e.target.value = ""; }} />
          {opt.music && <>
            <Field label={`Music volume · ${Math.round(opt.music.volume * 100)}%`}><input type="range" min={0.1} max={1.5} step={0.05} value={opt.music.volume} className="w-full accent-[var(--red-bright)]" onChange={(e) => setO({ music: { ...opt.music, volume: +e.target.value } })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={opt.music.keepClipAudio} onChange={(e) => setO({ music: { ...opt.music, keepClipAudio: e.target.checked } })} className="accent-[var(--red-bright)]" /> Keep the clips' own sound under the music</label>
          </>}
        </CardContent></Card>

        <Button size="lg" className="w-full" onClick={exportVideo} disabled={render.busy || !clips.length}>{render.busy ? <><Spinner className="text-white" /> {Math.round(render.p * 100)}%</> : <><Clapperboard /> Export MP4 ({secs(total)})</>}</Button>
        <p className="text-center text-[11px] text-muted">Runs on your device with ffmpeg.wasm (LGPL, open source). Up to {MAX_TOTAL_SECONDS / 60} min · first export downloads the engine (~30 MB, cached after).</p>
      </div>
    </div>
  </>;
}
