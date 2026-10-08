import { useEffect, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Spinner } from "@/components/common/Primitives";
import { EventSelect } from "./EventSelect";
import { MAX_IMAGE_MB, MAX_VIDEO_MB, prepareImage, saveMedia, uploadMediaFile } from "@/services/media";
import { useAuth } from "@/context/AuthContext";
import { useEvents } from "@/hooks/useData";
import { errMsg } from "@/lib/utils";

export const DESKTOP_EDITORS = [
  { name: "Shotcut", url: "https://shotcut.org/download/", note: "Free & open source (Windows, macOS, Linux). Great for reels: trims, transitions, text, colour." },
  { name: "Kdenlive", url: "https://kdenlive.org/en/download/", note: "Free & open source, multi-track timeline, titles and effects — for longer event films." },
  { name: "OpenShot", url: "https://www.openshot.org/download/", note: "Free & open source, the simplest of the three for beginners." },
];

/** Upload a finished poster / video made anywhere (Shotcut, Kdenlive, phone apps…) to an event. */
export function UploadMediaDialog({ open, onOpenChange, eventId: initialEvent, onSaved }) {
  const { member: me } = useAuth();
  const { data: events } = useEvents();
  const [eventId, setEventId] = useState(initialEvent || "");
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [editor, setEditor] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [busy, setBusy] = useState("");
  const input = useRef(null);
  useEffect(() => { if (open) { setEventId(initialEvent || ""); setFile(null); setTitle(""); setBusy(""); } }, [open, initialEvent]);
  const ev = events.find((e) => e.slug === eventId);
  const isVideo = file?.type?.startsWith("video/");

  function pick(f) {
    if (!f) return;
    const ok = f.type.startsWith("image/") || f.type.startsWith("video/") || f.type === "application/pdf";
    if (!ok) return toast.error("Choose an image, PDF or video file.");
    if (f.type.startsWith("video/") && f.size > MAX_VIDEO_MB * 1048576) return toast.error(`Videos must be under ${MAX_VIDEO_MB} MB (free Cloudinary limit). Export at 1080p or 720p and try again.`);
    if (f.type === "application/pdf" && f.size > MAX_IMAGE_MB * 1048576) return toast.error(`PDFs must be under ${MAX_IMAGE_MB} MB.`);
    setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 120));
  }

  async function go() {
    if (!ev || !file) return;
    try {
      setBusy("Preparing…");
      const src = isVideo ? file : await prepareImage(file);
      const up = await uploadMediaFile(src, { kind: isVideo ? "video" : "poster", eventId: ev.slug, onProgress: (p) => setBusy(`Uploading ${Math.round(p * 100)}%…`) });
      setBusy("Saving…");
      await saveMedia(me, ev, { kind: isVideo ? "video" : "poster", source: "upload", format: up.format, title, url: up.url, width: up.width, height: up.height, bytes: up.bytes, duration: up.duration, fileType: file.type, editor: editor || null, visibility });
      toast.success(`Saved to ${ev.name}.`); onSaved?.(); onOpenChange(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  }

  return <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
    <DialogContent>
      <DialogTitle>Upload a finished poster or video</DialogTitle>
      <DialogDescription>For files made in Shotcut, Kdenlive, OpenShot or any other app. Only the final file is stored.</DialogDescription>
      <div className="mt-5 grid gap-3">
        <Field label="Event" required><EventSelect events={events} value={eventId} onChange={setEventId} /></Field>
        <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
          className="grid place-items-center gap-1 rounded-xl border-2 border-dashed border-line bg-surface-2 p-6 text-center text-sm hover:border-brand-bright">
          <UploadCloud className="text-brand-bright" />
          {file ? <><strong className="break-all">{file.name}</strong><span className="text-muted">{(file.size / 1048576).toFixed(1)} MB</span></> : <><strong>Choose or drop a file</strong><span className="text-muted">PNG, JPG, WebP, PDF or MP4/MOV/WebM · videos up to {MAX_VIDEO_MB} MB</span></>}
        </button>
        <input ref={input} type="file" hidden accept="image/*,video/*,application/pdf" onChange={(e) => pick(e.target.files?.[0])} />
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Made with"><Select value={editor} onChange={(e) => setEditor(e.target.value)}><option value="">—</option>{DESKTOP_EDITORS.map((d) => <option key={d.name}>{d.name}</option>)}<option>Canva (downloaded)</option><option>Phone app</option><option>Other</option></Select></Field>
          <Field label="Who can see it"><Select value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="public">Public event page</option><option value="internal">Team only</option></Select></Field>
        </div>
        <Button onClick={go} disabled={!!busy || !file || !eventId}>{busy ? <><Spinner className="text-white" /> {busy}</> : <><UploadCloud /> Upload &amp; save to event</>}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
