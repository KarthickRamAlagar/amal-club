import { useEffect, useState } from "react";
import { CheckCircle2, Download, Save } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Spinner } from "@/components/common/Primitives";
import { EventSelect } from "./EventSelect";
import { canvaApi, waitForExport } from "@/lib/canva";
import { saveMedia, uploadMediaFile } from "@/services/media";
import { useAuth } from "@/context/AuthContext";
import { useEvents } from "@/hooks/useData";
import { errMsg } from "@/lib/utils";

const POSTER_SIZES = [["", "Canva design size (original)"], ["1080", "1080 px wide (Instagram)"], ["1600", "1600 px wide (sharper)"], ["2160", "2160 px wide (HD print/screens)"]];
const VIDEO_Q = [["vertical_1080p", "Vertical 1080p (Reels / Shorts)"], ["vertical_720p", "Vertical 720p (smaller file)"], ["horizontal_1080p", "Horizontal 1080p (LinkedIn / YouTube)"], ["horizontal_720p", "Horizontal 720p"], ["horizontal_4k", "Horizontal 4K"], ["vertical_4k", "Vertical 4K"]];

/**
 * Export a Canva design at the size the member picks → hand them the download →
 * copy the same file to Cloudinary → save it to the event's Poster/Video section.
 */
export function CanvaSaveDialog({ open, onOpenChange, design, eventId: initialEvent, kind: initialKind = "poster", onSaved }) {
  const { member: me } = useAuth();
  const { data: events } = useEvents();
  const [eventId, setEventId] = useState(initialEvent || "");
  const [kind, setKind] = useState(initialKind);
  const [fmt, setFmt] = useState(initialKind === "video" ? "mp4" : "png");
  const [width, setWidth] = useState("");
  const [quality, setQuality] = useState("vertical_1080p");
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [pages, setPages] = useState("1");
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => { if (open) { setEventId(initialEvent || ""); setKind(initialKind); setFmt(initialKind === "video" ? "mp4" : "png"); setTitle(design?.title || ""); setDone(null); setBusy(""); setPages("1"); } }, [open, design?.designId, initialEvent, initialKind]);
  useEffect(() => { setFmt(kind === "video" ? "mp4" : "png"); }, [kind]);
  const ev = events.find((e) => e.slug === eventId);

  async function go() {
    if (!ev) return toast.error("Choose the event this belongs to.");
    try {
      setBusy("Asking Canva to export…");
      const pageList = design?.pages > 1 && pages !== "all" ? [Number(pages) || 1] : undefined;
      const job = await canvaApi("export", { designId: design.designId, type: fmt, width: fmt === "png" || fmt === "jpg" ? width || undefined : undefined, quality: fmt === "mp4" ? quality : 92, pages: pageList });
      const urls = job.status === "success" ? job.urls : await waitForExport(job.jobId, { onTick: (i) => setBusy(`Canva is rendering${".".repeat((i % 3) + 1)} ${kind === "video" ? "(videos take a minute or two)" : ""}`) });
      const saved = [];
      for (let i = 0; i < urls.length; i++) {
        setBusy(`Saving ${urls.length > 1 ? `page ${i + 1}/${urls.length} ` : ""}to the event…`);
        let up;
        try { up = await uploadMediaFile(urls[i], { kind, eventId: ev.slug }); }
        catch { // fall back to downloading in the browser, then uploading the bytes
          const blob = await (await fetch(urls[i])).blob();
          up = await uploadMediaFile(blob, { kind, eventId: ev.slug, onProgress: (p) => setBusy(`Uploading ${Math.round(p * 100)}%…`) });
        }
        await saveMedia(me, ev, {
          kind, source: "canva", format: fmt, title: urls.length > 1 ? `${title} · page ${i + 1}` : title,
          url: up.url, width: up.width, height: up.height, bytes: up.bytes, duration: up.duration,
          fileType: fmt === "pdf" ? "application/pdf" : fmt === "mp4" ? "video/mp4" : `image/${fmt}`,
          visibility, canva: { designId: design.designId, title: design.title || "" },
        });
        saved.push({ canvaUrl: urls[i], url: up.url });
      }
      setDone(saved); setBusy("");
      toast.success(`Saved to ${ev.name}.`); onSaved?.();
    } catch (e) { setBusy(""); toast.error(errMsg(e)); }
  }

  return <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
    <DialogContent>
      <DialogTitle>Download &amp; save to event</DialogTitle>
      <DialogDescription>Canva exports the design in the size you choose. You get the download, and the same file appears in the event's {kind === "video" ? "video" : "poster"} section. The editable design stays in your Canva.</DialogDescription>
      {design?.thumb && <img src={design.thumb} alt="" className="mx-auto mt-4 max-h-44 rounded-lg border border-line object-contain" />}
      {done ? <div className="mt-5 space-y-3">
        <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-3 text-sm font-semibold text-ok"><CheckCircle2 size={18} /> Saved to {ev?.name}.</div>
        {done.map((d, i) => <Button key={d.url} asChild variant="secondary" className="w-full"><a href={d.canvaUrl} target="_blank" rel="noreferrer" download><Download /> Download {done.length > 1 ? `page ${i + 1}` : "file"} (Canva link, valid 24 h)</a></Button>)}
        <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
      </div> : <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label="Event" required className="sm:col-span-2"><EventSelect events={events} value={eventId} onChange={setEventId} /></Field>
        <Field label="Type"><Select value={kind} onChange={(e) => setKind(e.target.value)}><option value="poster">Poster / image</option><option value="video">Video</option></Select></Field>
        <Field label="Format"><Select value={fmt} onChange={(e) => setFmt(e.target.value)}>
          {kind === "video" ? <option value="mp4">MP4 video</option> : <><option value="png">PNG (best quality)</option><option value="jpg">JPG (smaller)</option><option value="pdf">PDF (print)</option><option value="gif">GIF (animated)</option></>}
        </Select></Field>
        {kind === "video" ? <Field label="Video size" className="sm:col-span-2"><Select value={quality} onChange={(e) => setQuality(e.target.value)}>{VIDEO_Q.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          : (fmt === "png" || fmt === "jpg") && <Field label="Image size" className="sm:col-span-2" hint="Free Canva accounts can't upscale much past the design size."><Select value={width} onChange={(e) => setWidth(e.target.value)}>{POSTER_SIZES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>}
        {design?.pages > 1 && <Field label="Pages" className="sm:col-span-2"><Select value={pages} onChange={(e) => setPages(e.target.value)}>
          {Array.from({ length: design.pages }, (_, i) => <option key={i} value={String(i + 1)}>Page {i + 1}</option>)}<option value="all">All {design.pages} pages</option></Select></Field>}
        <Field label="Title" className="sm:col-span-2"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
        <Field label="Who can see it" className="sm:col-span-2"><Select value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="public">Public — shown on the event page</option><option value="internal">Team only — dashboard</option></Select></Field>
        <Button className="sm:col-span-2" onClick={go} disabled={!!busy || !eventId}>{busy ? <><Spinner className="text-white" /> {busy}</> : <><Save /> Export, download &amp; save</>}</Button>
      </div>}
    </DialogContent>
  </Dialog>;
}
