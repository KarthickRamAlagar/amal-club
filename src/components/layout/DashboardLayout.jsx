import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, UserPlus, CalendarDays, Table2, FileText, Clapperboard, NotebookPen, ShieldCheck, ScrollText,
  UserCog, RefreshCcw, LogOut, Lock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/ui/avatar";
import { PageLoader } from "@/components/common/Primitives";
import { approverType, canInvite, canReviewTeam, canCreateEvent, canSeeFormLogs, canSeeMediaLogs, canUseDocs, isAdmin, isOB } from "@/lib/permissions";
import { roleLabel, teamName } from "@/lib/constants";
import { firebaseReady } from "@/lib/firebase";
import { cn } from "@/lib/utils";

function items(m) {
  return [
    { to: "/dashboard", icon: LayoutDashboard, label: "Overview", end: true },
    { to: "/dashboard/events", icon: CalendarDays, label: canCreateEvent(m) ? "Events" : "Events", show: true },
    { to: "/dashboard/registrations", icon: Table2, label: "Registrations" },
    { to: "/dashboard/forms", icon: FileText, label: "Form creation" },
    { to: "/dashboard/media", icon: Clapperboard, label: "Media studio" },
    { to: "/dashboard/documentation", icon: NotebookPen, label: "Documentation", show: canUseDocs(m) },
    { to: "/dashboard/approvals", icon: ShieldCheck, label: "Approvals", show: !!approverType(m, "form") },
    { to: "/dashboard/members", icon: UserPlus, label: "Members & invites", show: canInvite(m) },
    { to: "/dashboard/year-review", icon: RefreshCcw, label: "Retain / Release", show: canReviewTeam(m, "technical") },
    { to: "/dashboard/logs", icon: ScrollText, label: "Activity logs", show: isAdmin(m) || isOB(m) || canSeeFormLogs(m) || canSeeMediaLogs(m) || m?.role === "lead" },
    { to: "/dashboard/profile", icon: UserCog, label: "My profile" },
  ].filter((i) => i.show !== false);
}

export function DashboardLayout() {
  const { user, member, loading, signOut } = useAuth();
  const loc = useLocation();
  if (!firebaseReady) return <div className="section"><div className="inline-alert">The dashboard needs Firebase. Add your keys to <code>.env</code> (see README).</div></div>;
  if (loading) return <PageLoader />;
  if (!user || !member) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (member.status !== "active") return <div className="section"><div className="inline-alert error"><Lock size={14} className="inline" /> Your AMAL membership was released for this academic year. You can still browse the public site.</div></div>;
  const onboarding = loc.pathname.startsWith("/dashboard/onboarding");
  if (!member.onboarded && !onboarding) return <Navigate to="/dashboard/onboarding" replace />;

  const nav = items(member);
  return <div className="min-h-[calc(100vh-82px)] md:grid md:grid-cols-[250px_minmax(0,1fr)]">
    <aside className="hidden flex-col gap-1 border-r border-line bg-surface p-4 md:flex">
      <div className="mb-3 flex items-center gap-3 border-b border-line px-2 pb-4">
        <Avatar src={member.photoUrl} name={member.name} size={44} ring />
        <div className="min-w-0"><div className="truncate font-display text-[14px] font-extrabold">{member.name}</div>
          <div className="truncate text-[11px] text-muted">{member.designation || roleLabel(member.role)}{member.team ? ` · ${teamName(member.team)}` : ""}</div></div>
      </div>
      {member.onboarded ? nav.map((i) => <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition", isActive ? "brand-gradient text-white" : "text-muted hover:bg-surface-2 hover:text-fg")}><i.icon size={17} />{i.label}</NavLink>)
        : <div className="rounded-lg bg-surface-2 p-3 text-[12px] text-muted">Complete onboarding to unlock the dashboard. You can browse the public site anytime.</div>}
      <div className="mt-auto border-t border-line pt-3">
        <div className="px-3 pb-2 text-[11px] text-muted">AMAL ID · <span className="font-mono">{member.amalId}</span></div>
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-muted hover:bg-surface-2 hover:text-fg"><LogOut size={17} /> Sign out</button>
      </div>
    </aside>
    {member.onboarded && <nav className="sticky top-[82px] z-30 flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2 md:hidden">
      {nav.map((i) => <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold", isActive ? "brand-gradient text-white" : "bg-surface-2 text-muted")}><i.icon size={14} />{i.label}</NavLink>)}
    </nav>}
    <main className="min-w-0 p-5 md:p-8 lg:p-10"><Outlet /></main>
  </div>;
}

export function DashHeader({ eyebrow, title, subtitle, action }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div><div className="eyebrow"><span />{eyebrow}</div><h1 className="mt-2 font-display text-[clamp(26px,3vw,38px)] font-extrabold leading-tight tracking-tight">{title}</h1>{subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}</div>
    {action}
  </div>;
}
