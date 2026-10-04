import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Brand } from "./SiteHeader";

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="footer-top">
      <Brand className="footer-brand" />
      <p>Amrita Management &amp; Leadership Club<br />Amrita Vishwa Vidyapeetham, Bengaluru.</p>
      <div className="footer-links">{[["Home", "/"], ["About", "/about"], ["Teams", "/teams"], ["Events", "/events"], ["Gallery", "/gallery"]].map(([l, to]) => <Link key={to} to={to}>{l}</Link>)}</div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} AMAL Club. Empowered at Amrita, inspired for life.</span><span>Made with care <span className="footer-heart">♥</span></span><Link to="/login">Member access <ArrowRight size={13} /></Link></div>
  </footer>;
}
