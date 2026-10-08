import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Clapperboard, ExternalLink, Film, Images, UploadCloud, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { EmptyState } from "@/components/common/Primitives";
import { EventSelect } from "@/components/media/EventSelect";
import { CanvaPanel } from "@/components/media/CanvaPanel";
import { MediaGrid } from "@/components/media/MediaGrid";
import { UploadMediaDialog, DESKTOP_EDITORS } from "@/components/media/UploadMediaDialog";
import { useAuth } from "@/context/AuthContext";
import { useEvents } from "@/hooks/useData";
import { useQueryData } from "@/hooks/useFirestore";
import { mediaForEvent } from "@/services/media";
import { canCreateMedia } from "@/lib/permissions";

export default function MediaStudioPage() {
  const { member: me } = useAuth();
  const { data: events } = useEvents();
  const [params, setParams] = useSearchParams();
  const eventId = params.get("event") || "";
  const tab = params.get("tab") || (canCreateMedia(me) ? "canva" : "library");
  const ev = events.find((e) => e.slug === eventId) || null;
  const { data: media } = useQueryData(() => (eventId ? mediaForEvent(eventId) : null), [eventId]);
  const [upload, setUpload] = useState(false);
  const set = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); setParams(p, { replace: true }); };

  useEffect(() => { // result of the Canva sign-in redirect
    const c = params.get("canva");
    if (!c) return;
    if (c === "connected") toast.success("Canva connected.");
    else toast.error(`Canva sign-in didn't finish${params.get("reason") ? `: ${params.get("reason")}` : "."}`);
    const p = new URLSearchParams(params); p.delete("canva"); p.delete("reason"); setParams(p, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const creator = canCreateMedia(me);
  const live = media.filter((m) => m.status !== "removed");

  return <>
    <DashHeader eyebrow="MEDIA STUDIO" title="Posters & videos, saved to the event."
      subtitle="Design in Canva or edit video right here. Only the finished file is stored — it shows up in the event's poster & video section automatically." />

    <Card className="mb-5"><CardContent className="grid items-end gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_auto]">
      <Field label="Event"><EventSelect events={events} value={eventId} onChange={(v) => set("event", v)} /></Field>
      {ev && <div className="flex flex-wrap gap-2 text-[13px] text-muted"><span className="rounded-full bg-surface-2 px-3 py-2">{live.filter((m) => m.kind === "poster").length} posters</span><span className="rounded-full bg-surface-2 px-3 py-2">{live.filter((m) => m.kind === "video").length} videos</span>
        <Button asChild size="sm" variant="ghost"><Link to={`/events/${ev.slug}`}><ExternalLink /> Event page</Link></Button></div>}
    </CardContent></Card>

    {!creator && <div className="inline-alert mb-5">Creating media is for the Admin, Club Representatives, Team Leads and the Media &amp; Design team. You can browse what's been saved.</div>}

    <Tabs value={tab} onValueChange={(v) => set("tab", v)}>
      <TabsList>
        {creator && <TabsTrigger value="canva"><Wand2 size={15} className="mr-1.5 inline" />Canva</TabsTrigger>}
        {creator && <TabsTrigger value="video"><Film size={15} className="mr-1.5 inline" />Video Studio</TabsTrigger>}
        {creator && <TabsTrigger value="upload"><UploadCloud size={15} className="mr-1.5 inline" />Upload</TabsTrigger>}
        <TabsTrigger value="library"><Images size={15} className="mr-1.5 inline" />Event library</TabsTrigger>
      </TabsList>

      {creator && <TabsContent value="canva"><CanvaPanel ev={ev} /></TabsContent>}

      {creator && <TabsContent value="video">
        <Card><CardContent className="grid items-center gap-6 p-6 md:grid-cols-[1fr_auto]">
          <div><div className="flex items-center gap-2 font-display text-xl font-extrabold"><Clapperboard className="text-brand-bright" /> AMAL Video Studio</div>
            <p className="mt-2 max-w-2xl text-sm text-muted">Edit reels and event videos in your browser with the open-source ffmpeg engine. Trim and order your clips, add photos, a title and background music, then export an MP4 for Reels, Instagram or LinkedIn. Your clips never leave your device until you save the final video to the event.</p>
            <p className="mt-2 text-[12px] text-muted">For bigger edits, use Canva Video (Canva tab) or a desktop editor and upload the result.</p></div>
          <Button asChild size="lg"><Link to={`/dashboard/media/video${eventId ? `?event=${eventId}` : ""}`}><Film /> Open Video Studio</Link></Button>
        </CardContent></Card>
      </TabsContent>}

      {creator && <TabsContent value="upload">
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <Card><CardHeader><div><CardTitle>Upload a finished file</CardTitle><CardDescription>Posters, PDFs and videos made anywhere. Videos up to 100 MB.</CardDescription></div></CardHeader>
            <CardContent><Button onClick={() => setUpload(true)}><UploadCloud /> Upload to {ev ? ev.name : "an event"}</Button></CardContent></Card>
          <Card><CardHeader><div><CardTitle>Free &amp; open-source desktop editors</CardTitle><CardDescription>For longer films and heavy edits. Export MP4 (H.264) at 1080p, then upload here.</CardDescription></div></CardHeader>
            <CardContent className="space-y-2">{DESKTOP_EDITORS.map((d) => <a key={d.name} href={d.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 rounded-xl border border-line p-3 hover:border-brand-bright">
              <span><strong>{d.name}</strong><span className="block text-[12px] text-muted">{d.note}</span></span><ExternalLink size={15} className="mt-1 shrink-0 text-muted" /></a>)}</CardContent></Card>
        </div>
        <UploadMediaDialog open={upload} onOpenChange={setUpload} eventId={eventId} />
      </TabsContent>}

      <TabsContent value="library">
        {!eventId ? <EmptyState icon={Images} title="Choose an event to see its posters and videos." /> : <MediaGrid items={media} me={me} />}
      </TabsContent>
    </Tabs>
  </>;
}
