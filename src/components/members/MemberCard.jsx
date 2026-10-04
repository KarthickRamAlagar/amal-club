import { Mail, Linkedin, GraduationCap, Building2, IdCard } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { teamName, roleLabel } from "@/lib/constants";

/** Separate profile card opened when a member is clicked in a team tree. */
export function MemberCardDialog({ member, onOpenChange }) {
  return <Dialog open={!!member} onOpenChange={(o) => !o && onOpenChange(null)}>
    <DialogContent className="max-w-md overflow-hidden p-0">
      {member && <>
        <div className="brand-gradient relative h-28">
          <img src="/amal-logo.jpg" alt="" className="absolute right-4 top-4 h-12 w-12 rounded-full opacity-90" />
        </div>
       <div className="relative z-10 -mt-14 px-6 pb-6">
          <Avatar src={member.photoUrl} name={member.name} size={104} className="border-4 border-[var(--surface)]" />
          <DialogTitle className="mt-3 text-2xl">{member.name}</DialogTitle>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="gold">{member.designation || roleLabel(member.role)}</Badge>
            <Badge variant="muted">{member.team ? teamName(member.team) : "Core committee"}</Badge>
          </div>
          {member.bio && <p className="mt-4 text-sm leading-relaxed text-muted">{member.bio}</p>}
          <div className="mt-5 grid gap-2 text-sm">
            {(member.year || member.department) && <div className="flex items-center gap-2"><GraduationCap size={16} className="text-brand-bright" />{[member.year, member.department].filter(Boolean).join(" · ")}</div>}
            {member.email && <a className="flex items-center gap-2 hover:text-brand-bright" href={`mailto:${member.email}`}><Mail size={16} className="text-brand-bright" />{member.email}</a>}
            {member.amalId && <div className="flex items-center gap-2"><IdCard size={16} className="text-brand-bright" />AMAL ID · {member.amalId}</div>}
            {member.linkedin && <a className="flex items-center gap-2 hover:text-brand-bright" href={member.linkedin} target="_blank" rel="noreferrer"><Linkedin size={16} className="text-brand-bright" />LinkedIn profile</a>}
            <div className="flex items-center gap-2 text-muted"><Building2 size={16} className="text-brand-bright" />Amrita Vishwa Vidyapeetham, Bengaluru</div>
          </div>
        </div>
      </>}
    </DialogContent>
  </Dialog>;
}
