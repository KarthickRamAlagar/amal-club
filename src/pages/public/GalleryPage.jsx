import { ImageCard, PageShell } from "@/components/common/Primitives";
import { useEvents } from "@/hooks/useData";
import { IMAGES, TEAMS } from "@/lib/constants";

export default function GalleryPage() {
  const { data: events } = useEvents();
  const items = [
    ...events.filter((e) => e.bannerUrl).map((e) => ({ id: e.slug, title: e.name, sub: e.location, url: e.bannerUrl })),
    { id: "g1", title: "Together, we grow", sub: "AMAL moments", url: IMAGES.community },
    ...TEAMS.map((t) => ({ id: t.id, title: t.name, sub: "Team", url: t.imageUrl })),
  ];
  return <PageShell eyebrow="MOMENTS THAT MATTER" title="A little look at AMAL." subtitle="The people, ideas and shared moments that make this community." image={IMAGES.hero}>
    <div className="gallery-grid">{items.map((i) => <article className="gallery-item" key={i.id}><ImageCard src={i.url} alt={i.title} /><div><strong>{i.title}</strong><span>{i.sub}</span></div></article>)}</div>
  </PageShell>;
}
