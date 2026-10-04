// import { useState } from "react";
// import { Link, NavLink, useNavigate } from "react-router-dom";
// import { ArrowRight, LayoutDashboard, LockKeyhole, LogOut, Menu, Moon, Sun, X } from "lucide-react";
// import { useTheme } from "@/context/ThemeContext";
// import { useAuth } from "@/context/AuthContext";
// import { Avatar } from "@/components/ui/avatar";

// const NAV = [["Home", "/"], ["About", "/about"], ["Teams", "/teams"], ["Events", "/events"], ["Gallery", "/gallery"]];

// export function Brand({ className = "" }) {
//   return <Link to="/" className={`brand ${className}`} aria-label="AMAL Club home">
//     <img src="/amal-logo.jpg" alt="" className="h-10 w-10 rounded-full bg-white object-cover" />
//     <span className="brand-copy"><strong>AMAL<span> CLUB</span></strong><small>MANAGEMENT · LEADERSHIP</small></span>
//   </Link>;
// }

// export function SiteHeader() {
//   const { theme, toggle } = useTheme();
//   const { user, member, signOut } = useAuth();
//   const [open, setOpen] = useState(false);
//   const nav = useNavigate();
//   return <header className="site-header">
//     <Brand />
//     <nav className={open ? "main-nav open" : "main-nav"} onClick={() => setOpen(false)}>
//       {NAV.map(([label, to]) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `border-0 bg-transparent text-[13px] ${isActive ? "nav-active text-fg" : "text-muted hover:text-fg"}`}>{label}</NavLink>)}
//       {member ? <NavLink to="/dashboard" className="nav-admin inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg"><LayoutDashboard size={14} /> Dashboard</NavLink>
//         : !user && <NavLink to="/login" className="nav-admin inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg"><LockKeyhole size={14} /> Member login</NavLink>}
//     </nav>
//     <div className="header-actions">
//       <button className="theme-toggle" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={toggle}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
//       {user ? <div className="flex items-center gap-2">
//         <button onClick={() => nav(member ? "/dashboard" : "/events")} className="rounded-full" aria-label="Account"><Avatar src={member?.photoUrl || user.photoURL} name={member?.name || user.displayName || user.email} size={36} /></button>
//         <button className="theme-toggle" aria-label="Sign out" onClick={() => { signOut(); nav("/"); }}><LogOut size={16} /></button>
//       </div> : <Link className="button button-primary header-cta" to="/events">Get involved <ArrowRight size={16} /></Link>}
//       <button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
//     </div>
//   </header>;
// }


import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import * as D from "@radix-ui/react-dialog";
import {
  ArrowRight, CalendarDays, Home, Images, Info, LayoutDashboard, LockKeyhole, LogOut, Menu, Moon, Sun, Users, X, KeyRound, ChevronRight,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/ui/avatar";
import { roleLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Home", to: "/", icon: Home },
  { label: "About", to: "/about", icon: Info },
  { label: "Teams", to: "/teams", icon: Users },
  { label: "Events", to: "/events", icon: CalendarDays },
  { label: "Gallery", to: "/gallery", icon: Images },
];

export function Brand({ className = "" }) {
  return <Link to="/" className={`brand ${className}`} aria-label="AMAL Club home">
    <img src="/amal-logo.jpg" alt="" className="h-10 w-10 rounded-full bg-white object-cover" />
    <span className="brand-copy"><strong>AMAL<span> CLUB</span></strong><small>MANAGEMENT · LEADERSHIP</small></span>
  </Link>;
}

export function SiteHeader() {
  const { theme, toggle } = useTheme();
  const { user, member, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate(); const { pathname } = useLocation();
  useEffect(() => { setOpen(false); }, [pathname]); // close on any route change

  const doSignOut = () => { setOpen(false); signOut(); nav("/"); };

  return <header className="site-header">
    <Brand />

    {/* Desktop nav */}
    <nav className="main-nav max-[760px]:hidden!">
      {NAV.map(({ label, to }) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `border-0 bg-transparent text-[13px] ${isActive ? "nav-active text-fg" : "text-muted hover:text-fg"}`}>{label}</NavLink>)}
      {member ? <NavLink to="/dashboard" className="nav-admin inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg"><LayoutDashboard size={14} /> Dashboard</NavLink>
        : !user && <NavLink to="/login" className="nav-admin inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg"><LockKeyhole size={14} /> Member login</NavLink>}
    </nav>

    <div className="header-actions">
      <button className="theme-toggle max-[760px]:hidden!" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={toggle}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
      {user ? <div className="flex items-center gap-2">
        <button onClick={() => nav(member ? "/dashboard" : "/events")} className="rounded-full" aria-label="Account"><Avatar src={member?.photoUrl || user.photoURL} name={member?.name || user.displayName || user.email} size={36} /></button>
        <button className="theme-toggle max-[760px]:hidden!" aria-label="Sign out" onClick={doSignOut}><LogOut size={16} /></button>
      </div> : <Link className="button button-primary header-cta" to="/events">Get involved <ArrowRight size={16} /></Link>}

      {/* Mobile drawer */}
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Trigger asChild><button className="mobile-menu" aria-label="Open menu"><Menu /></button></D.Trigger>
        <D.Portal>
          <D.Overlay className="drawer-overlay fixed inset-0 z-[95] bg-black/55 backdrop-blur-[2px]" />
          <D.Content className="drawer-panel fixed inset-y-0 right-0 z-[96] flex w-[min(86vw,340px)] flex-col border-l border-line bg-surface text-fg shadow-2xl outline-none" aria-describedby={undefined}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <D.Title className="flex items-center gap-2.5 font-display text-[15px] font-extrabold tracking-wide">
                <img src="/amal-logo.jpg" alt="" className="h-9 w-9 rounded-full bg-white" />AMAL <span className="text-brand-bright">CLUB</span>
              </D.Title>
              <D.Close className="grid h-10 w-10 place-items-center rounded-full border border-line text-muted hover:text-fg" aria-label="Close menu"><X size={18} /></D.Close>
            </div>

            {user && <Link to={member ? "/dashboard/profile" : "/events"} onClick={() => setOpen(false)} className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
              <Avatar src={member?.photoUrl || user.photoURL} name={member?.name || user.displayName || user.email} size={44} ring />
              <div className="min-w-0 flex-1"><div className="truncate font-display text-[15px] font-extrabold">{member?.name || user.displayName || "Participant"}</div>
                <div className="truncate text-[12px] text-muted">{member ? (member.designation || roleLabel(member.role)) : user.email}</div></div>
              <ChevronRight size={16} className="text-muted" />
            </Link>}

            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
              {NAV.map(({ label, to, icon: Icon }, i) => <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)}
                style={{ animationDelay: `${60 + i * 40}ms` }}
                className={({ isActive }) => cn("drawer-item mb-1 flex items-center gap-3.5 rounded-xl px-3 py-3 text-[15px] font-semibold no-underline transition",
                  isActive ? "brand-gradient text-white" : "text-fg hover:bg-surface-2")}>
                {({ isActive }) => <>
                  <span className={cn("grid h-9 w-9 place-items-center rounded-lg", isActive ? "bg-white/15" : "bg-surface-2 text-brand-bright")}><Icon size={18} /></span>
                  <span className="flex-1">{label}</span>
                  <ChevronRight size={16} className={isActive ? "text-white/80" : "text-muted"} />
                </>}
              </NavLink>)}
              <div className="my-3 border-t border-line" />
              {member ? <NavLink to="/dashboard" onClick={() => setOpen(false)} style={{ animationDelay: "280ms" }}
                className={({ isActive }) => cn("drawer-item flex items-center gap-3.5 rounded-xl px-3 py-3 text-[15px] font-semibold no-underline", isActive ? "brand-gradient text-white" : "text-fg hover:bg-surface-2")}>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-gold"><LayoutDashboard size={18} /></span><span className="flex-1">Dashboard</span><ChevronRight size={16} className="text-muted" />
              </NavLink> : !user && <>
                <NavLink to="/login" onClick={() => setOpen(false)} style={{ animationDelay: "280ms" }} className="drawer-item flex items-center gap-3.5 rounded-xl px-3 py-3 text-[15px] font-semibold text-fg no-underline hover:bg-surface-2">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-gold"><LockKeyhole size={18} /></span><span className="flex-1">Member login</span><ChevronRight size={16} className="text-muted" />
                </NavLink>
                <NavLink to="/join" onClick={() => setOpen(false)} style={{ animationDelay: "320ms" }} className="drawer-item flex items-center gap-3.5 rounded-xl px-3 py-3 text-[15px] font-semibold text-fg no-underline hover:bg-surface-2">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-gold"><KeyRound size={18} /></span><span className="flex-1">I have an invite code</span><ChevronRight size={16} className="text-muted" />
                </NavLink>
              </>}
            </nav>

            <div className="flex gap-2 border-t border-line p-4">
              <button onClick={toggle} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line text-[13px] font-semibold text-fg">
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}{theme === "dark" ? "Light mode" : "Dark mode"}</button>
              {user ? <button onClick={doSignOut} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#7a0f22] text-[13px] font-semibold text-white"><LogOut size={16} /> Sign out</button>
                : <Link to="/events" onClick={() => setOpen(false)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl brand-gradient text-[13px] font-bold text-white no-underline">Get involved <ArrowRight size={16} /></Link>}
            </div>
          </D.Content>
        </D.Portal>
      </D.Root>
    </div>
  </header>;
}
