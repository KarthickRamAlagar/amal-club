import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ImageCard, PageShell } from "@/components/common/Primitives";
import { Avatar } from "@/components/ui/avatar";
import { TEAMS, IMAGES } from "@/lib/constants";
import { useActiveMembers } from "@/hooks/useData";

export default function TeamsPage() {
  const { data: members } = useActiveMembers();
  return <PageShell eyebrow="PEOPLE MAKE AMAL" title="Find your people." subtitle="Five teams, one shared purpose. Explore who does what." image={IMAGES.community}>
    <div className="team-grid">{TEAMS.map((t) => {
      const lead = members.find((m) => m.team === t.id && m.role === "lead");
      const count = members.filter((m) => m.team === t.id).length;
      return <Link className="team-card no-underline text-inherit" key={t.id} to={`/teams/${t.id}`}>
        <ImageCard src={t.imageUrl} alt={t.name} />
        <div className="team-card-content">
          <span className="category">{t.category} · {count} members</span><h3>{t.name}</h3><p>{t.summary}</p>
          <div className="team-card-footer"><span className="lead-mini"><Avatar src={lead?.photoUrl} name={lead?.name || t.name} size={34} /><span><small>TEAM LEAD</small><strong>{lead?.name || "To be announced"}</strong></span></span><span className="round-arrow"><ArrowRight size={17} /></span></div>
        </div>
      </Link>;
    })}</div>
  </PageShell>;
}
