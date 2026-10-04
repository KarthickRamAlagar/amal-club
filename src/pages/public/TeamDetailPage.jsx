import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { List, Network } from "lucide-react";
import { ImageCard, SectionTitle, EmptyState } from "@/components/common/Primitives";
import { TeamTree } from "@/components/members/ClubTree";
import { Avatar } from "@/components/ui/avatar";
import { teamById } from "@/lib/constants";
import { useTeamMembers } from "@/hooks/useData";

export default function TeamDetailPage() {
  const { teamId } = useParams();
  const team = teamById(teamId);
  const [mode, setMode] = useState("tree");
  const { data: members, loading } = useTeamMembers(team?.id);
  if (!team) return <div className="section"><EmptyState title="Team not found" action={<Link className="button button-primary" to="/teams">All teams</Link>} /></div>;
  const lead = members.find((m) => m.role === "lead");
  return <>
    <section className="detail-hero"><ImageCard src={team.imageUrl} alt={team.name} />
      <div className="detail-hero-overlay"><Link className="back-link" to="/teams">← All teams</Link><span className="category">{team.category}</span><h1>{team.name}</h1><p>{team.summary}</p>
        <div className="detail-lead"><Avatar src={lead?.photoUrl} name={lead?.name || team.name} size={52} /><div><small>TEAM LEAD</small><strong>{lead?.name || "To be announced"}</strong><span>{lead ? [lead.year, lead.department].filter(Boolean).join(" · ") : ""}</span></div></div>
      </div>
    </section>
    <section className="section">
      <SectionTitle eyebrow="HOW WE WORK TOGETHER" title="The people behind the work." subtitle="Tap a member to open their card."
        action={<div className="view-switch"><button className={mode === "tree" ? "active" : ""} onClick={() => setMode("tree")}><Network size={16} /> Tree</button><button className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}><List size={16} /> List</button></div>} />
      {!loading && !members.length ? <EmptyState title="No members yet">Members appear here once they're invited and finish onboarding.</EmptyState> : <TeamTree members={members} mode={mode} />}
    </section>
  </>;
}
