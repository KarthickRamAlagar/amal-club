import { Film, Image as ImageIcon } from "lucide-react";
import { Eyebrow } from "@/components/common/Primitives";
import { MediaGrid } from "@/components/media/MediaGrid";
import { useQueryData } from "@/hooks/useFirestore";
import { mediaForEvent } from "@/services/media";

/** Public "Posters & videos" section on an event page — fills automatically when the Media team saves to the event. */
export function EventMediaSection({ ev }) {
  const { data } = useQueryData(() => mediaForEvent(ev.slug, { publicOnly: true }), [ev.slug]);
  const posters = data.filter((m) => m.kind === "poster"); const videos = data.filter((m) => m.kind === "video");
  if (!data.length) return null;
  return <section className="section" id="media">
    <Eyebrow>POSTERS &amp; VIDEOS</Eyebrow>
    <h2 className="mt-2 font-display text-[clamp(24px,3vw,34px)] font-extrabold tracking-tight">From the AMAL Media team.</h2>
    {videos.length > 0 && <div className="mt-6"><h3 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold"><Film size={18} className="text-brand-bright" /> Videos</h3><MediaGrid items={videos} publicView /></div>}
    {posters.length > 0 && <div className="mt-8"><h3 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold"><ImageIcon size={18} className="text-brand-bright" /> Posters</h3><MediaGrid items={posters} publicView /></div>}
  </section>;
}
