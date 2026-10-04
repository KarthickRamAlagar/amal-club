import { useState } from "react";
import { Mail } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MemberCardDialog } from "./MemberCard";
import { roleLabel, teamName } from "@/lib/constants";
import { cn } from "@/lib/utils";

function Node({ m, onOpen, size = "md" }) {
  const big = size === "lg";
  return <button type="button" onClick={() => onOpen(m)}
    className={cn("glass group flex w-[230px] flex-col items-center gap-2 rounded-2xl p-4 text-center transition hover:-translate-y-1 hover:border-brand-bright", big && "w-[260px]")}>
    <Avatar src={m.photoUrl} name={m.name} size={big ? 76 : 60} ring />
    <div className="font-display text-[15px] font-extrabold leading-tight">{m.name}</div>
    <div className="text-[11px] font-bold uppercase tracking-[1.3px] text-brand-bright">{m.role === "lead" ? `${teamName(m.team)} Lead` : (m.designation || roleLabel(m.role))}</div>
    <div className="text-[12px] text-muted">{m.year || "—"}{m.department ? ` · ${m.department}` : ""}</div>
    {m.email && <div className="flex max-w-full items-center gap-1 truncate text-[11px] text-muted"><Mail size={11} /><span className="truncate">{m.email}</span></div>}
  </button>;
}

function Level({ title, people, onOpen, size }) {
  if (!people.length) return null;
  return <div className="tree-level flex flex-col items-center gap-3">
    <div className="text-[10px] font-bold uppercase tracking-[2px] text-muted">{title}</div>
    <div className="flex flex-wrap justify-center gap-4">{people.map((m) => <Node key={m.uid} m={m} onOpen={onOpen} size={size} />)}</div>
  </div>;
}

/** Admin → Club Representatives → Team Leads (landing page). */
export function ClubTree({ members }) {
  const [open, setOpen] = useState(null);
  const by = (r) => members.filter((m) => r.includes(m.role));
  return <div className="flex flex-col gap-14">
    <Level title="Faculty Admin" people={by(["admin"])} onOpen={setOpen} size="lg" />
    <Level title="President" people={by(["president"])} onOpen={setOpen} size="lg" />
    <Level title="Vice President · Treasurer" people={by(["vp", "treasurer"])} onOpen={setOpen} />
    <Level title="Team Leads" people={by(["lead"])} onOpen={setOpen} />
    <MemberCardDialog member={open} onOpenChange={setOpen} />
  </div>;
}

/** Team page: lead(s) on top, members below, click → member card. */
export function TeamTree({ members, mode = "tree" }) {
  const [open, setOpen] = useState(null);
  const leads = members.filter((m) => m.role === "lead");
  const rest = members.filter((m) => m.role !== "lead");
  if (mode === "list") return <>
    <div className="member-grid">{members.map((m) => <button type="button" className="member-card text-left" key={m.uid} onClick={() => setOpen(m)}>
      <Avatar src={m.photoUrl} name={m.name} size={54} /><div><strong>{m.name}</strong><span>{m.designation || roleLabel(m.role)}</span><small>{[m.year, m.department].filter(Boolean).join(" · ") || "AMAL member"}</small></div>
    </button>)}</div>
    <MemberCardDialog member={open} onOpenChange={setOpen} />
  </>;
  return <div className="flex flex-col gap-14">
    <Level title="Team Lead" people={leads} onOpen={setOpen} size="lg" />
    <Level title="Team Members" people={rest} onOpen={setOpen} />
    <MemberCardDialog member={open} onOpenChange={setOpen} />
  </div>;
}
