import { useState } from "react";
import { Download, Eye, EyeOff, ExternalLink, Film, Image as ImageIcon, PenLine, Trash2, FileText, Play } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/common/Primitives";
import { updateMedia } from "@/services/media";
import { canvaApi } from "@/lib/canva";
import { canCreateMedia, isAdmin, isOB, isLead } from "@/lib/permissions";
import { cdn } from "@/lib/image";
import { errMsg, fmtDateTime, toMillis } from "@/lib/utils";
import { confirmDialog } from "@/components/common/ConfirmDialog";

const SOURCE = { canva: ["Canva", "gold"], studio: ["Video Studio", "ok"], upload: ["Upload", "muted"] };
const isPdf = (m) => /\.pdf($|\?)/i.test(m.url) || m.fileType === "application/pdf";
export const downloadUrl = (url) => (url?.includes("res.cloudinary.com") ? url.replace("/upload/", "/upload/fl_attachment/") : url);
const fmtBytes = (b) => (!b ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const fmtDur = (s) => (!s ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);

/** Posters & videos saved to an event. `me` enables management controls. */
export function MediaGrid({ items, me, empty = "Nothing saved to this event yet.", publicView = false }) {
  const [view, setView] = useState(null);
  const rows = [...items].filter((m) => m.status !== "removed").sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  if (!rows.length) return <EmptyState icon={ImageIcon} title={empty} />;
  const canManage = (m) => me && canCreateMedia(me) && (m.createdBy?.uid === me.uid || isAdmin(me) || isOB(me) || isLead(me));

  async function act(m, patch, type, msg) {
    try { await updateMedia(me, m, patch, type); toast.success(msg); } catch (e) { toast.error(errMsg(e)); }
  }
  async function reopen(m) {
    try { const r = await canvaApi("open", { designId: m.canva.designId, eventId: m.eventId, kind: m.kind }); window.location.href = r.editUrl; }
    catch (e) { toast.error(errMsg(e)); }
  }

  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((m) => <div key={m.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
        <button type="button" onClick={() => setView(m)} className="group relative block aspect-[4/5] w-full overflow-hidden bg-surface-2" aria-label={`Open ${m.title || m.kind}`}>
          {isPdf(m) ? <div className="grid h-full place-items-center text-muted"><FileText size={42} /><span className="text-xs">PDF</span></div>
            : <img src={m.kind === "video" ? m.thumbUrl : cdn(m.url, 700)} alt="" className="h-full w-full object-contain transition group-hover:scale-[1.02]" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />}
          {m.kind === "video" && <span className="absolute inset-0 grid place-items-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-black/55 text-white backdrop-blur"><Play size={22} /></span></span>}
          <span className="absolute left-2 top-2 flex gap-1">
            <Badge variant={m.kind === "video" ? "default" : "gold"}>{m.kind === "video" ? <><Film size={11} className="mr-1 inline" />Video</> : "Poster"}</Badge>
            {!publicView && m.visibility === "internal" && <Badge variant="muted"><EyeOff size={11} className="mr-1 inline" />Team only</Badge>}
          </span>
        </button>
        <div className="space-y-2 p-3">
          <div className="truncate font-bold" title={m.title}>{m.title || (m.kind === "video" ? "Event video" : "Event poster")}</div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            {!publicView && <Badge variant={SOURCE[m.source]?.[1] || "muted"}>{SOURCE[m.source]?.[0] || m.source}</Badge>}
            {m.width && m.height && <span>{m.width}×{m.height}</span>}{m.duration && <span>· {fmtDur(m.duration)}</span>}{m.bytes && <span>· {fmtBytes(m.bytes)}</span>}
          </div>
          {!publicView && <div className="flex items-center gap-2 text-[11px] text-muted"><Avatar src={m.createdBy?.photoUrl} name={m.createdBy?.name} size={20} /><span className="truncate">{m.createdBy?.name} · {fmtDateTime(m.createdAt)}</span></div>}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Button asChild size="sm" variant="secondary"><a href={downloadUrl(m.url)} download><Download /> Download</a></Button>
            {!publicView && m.canva?.designId && me && canCreateMedia(me) && <Button size="sm" variant="secondary" onClick={() => reopen(m)}><PenLine /> Edit in Canva</Button>}
            {!publicView && canManage(m) && <>
              <Button size="sm" variant="ghost" onClick={() => act(m, { visibility: m.visibility === "public" ? "internal" : "public" }, m.visibility === "public" ? "media.hide" : "media.show", m.visibility === "public" ? "Hidden from the public event page." : "Now shown on the public event page.")}>
                {m.visibility === "public" ? <><EyeOff /> Hide</> : <><Eye /> Show</>}</Button>
              <Button size="sm" variant="ghost" onClick={async () => (await confirmDialog({ title: `Remove “${m.title || (m.kind === "video" ? "this video" : "this poster")}” from the event?`, description: "It disappears from the event page and the dashboard. The stored file isn't deleted, so the Admin can still find it in the activity log.", confirmText: "Remove", tone: "danger" })) && act(m, { status: "removed" }, "media.remove", "Removed from the event.")}><Trash2 /></Button>
            </>}
          </div>
        </div>
      </div>)}
    </div>

    <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
      {view && <DialogContent wide>
        <DialogTitle>{view.title || (view.kind === "video" ? "Event video" : "Event poster")}</DialogTitle>
        <DialogDescription>{view.eventName}{view.width ? ` · ${view.width}×${view.height}` : ""}</DialogDescription>
        <div className="mt-4 grid max-h-[70vh] place-items-center overflow-auto rounded-xl bg-black/80">
          {view.kind === "video" ? <video src={view.url} poster={view.thumbUrl} controls playsInline className="max-h-[68vh] w-auto" />
            : isPdf(view) ? <iframe src={view.url} title="PDF" className="h-[68vh] w-full bg-white" />
              : <img src={cdn(view.url, 1600)} alt="" className="max-h-[68vh] w-auto" />}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild><a href={downloadUrl(view.url)} download><Download /> Download original</a></Button>
          <Button asChild variant="secondary"><a href={view.url} target="_blank" rel="noreferrer"><ExternalLink /> Open in new tab</a></Button>
        </div>
      </DialogContent>}
    </Dialog>
  </>;
}
