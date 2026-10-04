import { Mail, IdCard } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, fmtDateTime } from "@/lib/utils";

/** Photo on the left, then name, designation, team, email and AMAL ID — used for every log / decision. */
export function ActorCard({ actor, label, at, className, compact }) {
  if (!actor) return null;
  return <div className={cn("flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3", className)}>
    <Avatar src={actor.photoUrl} name={actor.name} size={compact ? 38 : 52} ring />
    <div className="min-w-0 flex-1">
      {label && <div className="text-[10px] font-bold uppercase tracking-[1.4px] text-brand-bright">{label}</div>}
      <div className="truncate font-display text-[15px] font-extrabold">{actor.name}</div>
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
        <Badge variant="gold">{actor.designation || actor.role}</Badge>
        {actor.teamName && actor.teamName !== "Core" && <Badge variant="muted">{actor.teamName}</Badge>}
      </div>
      {!compact && <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted">
        {actor.email && <span className="inline-flex items-center gap-1"><Mail size={12} />{actor.email}</span>}
        {actor.amalId && <span className="inline-flex items-center gap-1"><IdCard size={12} />{actor.amalId}</span>}
      </div>}
      {at && <div className="mt-0.5 text-[11px] text-muted">{fmtDateTime(at)}</div>}
    </div>
  </div>;
}
