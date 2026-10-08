import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, PenLine, Save } from "lucide-react";
import { toast } from "sonner";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoader, EmptyState } from "@/components/common/Primitives";
import { CanvaSaveDialog } from "@/components/media/CanvaSaveDialog";
import { canvaApi } from "@/lib/canva";
import { useEvents } from "@/hooks/useData";
import { errMsg } from "@/lib/utils";

/** Canva's "Return" button lands here with ?correlation_jwt=… — we verify it on the server, then offer "Save to event". */
export default function CanvaReturnPage() {
  const [params] = useSearchParams();
  const { data: events } = useEvents();
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const jwt = params.get("correlation_jwt");

  useEffect(() => {
    if (!jwt) { setErr("This page opens when you press Return in the Canva editor."); return; }
    canvaApi("return", { jwt }).then((r) => { setInfo(r); setSaving(true); }).catch((e) => setErr(errMsg(e)));
  }, [jwt]);

  if (err) return <EmptyState title="Couldn't read the Canva design" action={<Button asChild variant="secondary"><Link to="/dashboard/media"><ArrowLeft /> Media studio</Link></Button>}>{err}</EmptyState>;
  if (!info) return <PageLoader label="Getting your design from Canva…" />;
  const ev = events.find((e) => e.slug === info.eventId);
  const back = `/dashboard/media?${new URLSearchParams({ ...(info.eventId ? { event: info.eventId } : {}), tab: "library" })}`;

  async function reopen() {
    try { const r = await canvaApi("open", { designId: info.designId, eventId: info.eventId, kind: info.kind }); window.location.href = r.editUrl; } catch (e) { toast.error(errMsg(e)); }
  }

  return <>
    <DashHeader eyebrow="BACK FROM CANVA" title={info.title} subtitle={ev ? `For ${ev.name}` : "Pick the event when you save."} />
    <Card><CardContent className="grid items-center gap-6 p-6 md:grid-cols-[280px_1fr]">
      {info.thumb ? <img src={info.thumb} alt="" className="w-full rounded-xl border border-line object-contain" /> : <div className="aspect-[4/5] rounded-xl bg-surface-2" />}
      <div className="space-y-3">
        <p className="text-sm text-muted">Happy with it? Export it at the size you want — you get the download, and the same file is saved to the event's {info.kind === "video" ? "videos" : "posters"}. Not finished? Jump back into Canva.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setSaving(true)}><Save /> Download &amp; save to event</Button>
          <Button variant="secondary" onClick={reopen}><PenLine /> Keep editing in Canva</Button>
          <Button variant="ghost" asChild><Link to={back}><ArrowLeft /> Media studio</Link></Button>
        </div>
      </div>
    </CardContent></Card>
    <CanvaSaveDialog open={saving} onOpenChange={setSaving} design={info} eventId={info.eventId || ""} kind={info.kind} />
  </>;
}
