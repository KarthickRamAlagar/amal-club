import { Copy, Mail, MessageCircle, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** WhatsApp / Email / Copy — same pattern as MAOM invites. */
export function ShareButtons({ text, subject = "AMAL Club", email = "", phone = "" }) {
  const [copied, setCopied] = useState(false);
  const wa = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
  const mail = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  return <div className="flex flex-wrap gap-2">
    <Button asChild size="sm" className="bg-[#1f9e57] [background-image:none] shadow-none"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></Button>
    <Button asChild size="sm" variant="secondary"><a href={mail}><Mail /> Email</a></Button>
    <Button size="sm" variant="secondary" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
    </Button>
  </div>;
}
