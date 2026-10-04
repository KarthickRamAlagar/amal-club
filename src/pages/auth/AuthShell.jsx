import { ShieldCheck } from "lucide-react";
import { Eyebrow } from "@/components/common/Primitives";
import { IMAGES } from "@/lib/constants";

export function AuthShell({ title, subtitle, children, art = "Good work deserves good management." }) {
  return <div className="auth-wrap">
    <div className="auth-art" style={{ backgroundImage: `linear-gradient(180deg, rgba(20,6,12,.2), rgba(20,6,12,.85)), url("${IMAGES.stage}")`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="auth-art-copy"><ShieldCheck size={35} /><Eyebrow>AMAL CLUB · MEMBERS</Eyebrow><h1>{art}</h1><p>Manage events, people and the stories you share with your community.</p></div>
    </div>
    <div className="auth-card">
      <img src="/amal-logo.jpg" alt="" className="h-14 w-14 rounded-full bg-white" />
      <h2>{title}</h2>{subtitle && <p>{subtitle}</p>}
      {children}
    </div>
  </div>;
}
