import { Link } from "react-router-dom";
import { ArrowRight, Linkedin } from "lucide-react";
import { Brand } from "./SiteHeader";

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="footer-top">
      <Brand className="footer-brand" />
      <p>Amrita Management &amp; Leadership Club<br />Amrita Vishwa Vidyapeetham, Bengaluru.</p>
      <div className="footer-links">{[["Home", "/"], ["About", "/about"], ["Teams", "/teams"], ["Events", "/events"], ["Gallery", "/gallery"]].map(([l, to]) => <Link key={to} to={to}>{l}</Link>)}</div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} AMAL Club. Empowered at Amrita, inspired for life.</span><a href="https://www.linkedin.com/in/karthi21903/" target="_blank" rel="noopener noreferrer" aria-label="Developed by Karthickramalagar on LinkedIn" className="group">Developed by <strong className="text-fg">Karthickramalagar</strong><span className="grid h-6 w-6 place-items-center rounded-md bg-[#0a66c2] text-white transition group-hover:scale-110"><Linkedin size={13} strokeWidth={2.4} /></span></a><Link to="/login">Member access <ArrowRight size={13} /></Link></div>
  </footer>;
}
