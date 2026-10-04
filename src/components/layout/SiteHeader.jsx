import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ArrowRight, LayoutDashboard, LockKeyhole, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/ui/avatar";

const NAV = [["Home", "/"], ["About", "/about"], ["Teams", "/teams"], ["Events", "/events"], ["Gallery", "/gallery"]];

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
  const nav = useNavigate();
  return <header className="site-header">
    <Brand />
    <nav className={open ? "main-nav open" : "main-nav"} onClick={() => setOpen(false)}>
      {NAV.map(([label, to]) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `border-0 bg-transparent text-[13px] ${isActive ? "nav-active text-fg" : "text-muted hover:text-fg"}`}>{label}</NavLink>)}
      {member ? <NavLink to="/dashboard" className="nav-admin inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg"><LayoutDashboard size={14} /> Dashboard</NavLink>
        : !user && <NavLink to="/login" className="nav-admin inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg"><LockKeyhole size={14} /> Member login</NavLink>}
    </nav>
    <div className="header-actions">
      <button className="theme-toggle" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={toggle}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
      {user ? <div className="flex items-center gap-2">
        <button onClick={() => nav(member ? "/dashboard" : "/events")} className="rounded-full" aria-label="Account"><Avatar src={member?.photoUrl || user.photoURL} name={member?.name || user.displayName || user.email} size={36} /></button>
        <button className="theme-toggle" aria-label="Sign out" onClick={() => { signOut(); nav("/"); }}><LogOut size={16} /></button>
      </div> : <Link className="button button-primary header-cta" to="/events">Get involved <ArrowRight size={16} /></Link>}
      <button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    </div>
  </header>;
}
