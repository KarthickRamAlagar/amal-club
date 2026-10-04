import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export async function qrDataUrl(text, { dark = "#1a0508", light = "#ffffff", width = 720 } = {}) {
  return QRCode.toDataURL(text, { width, margin: 1, errorCorrectionLevel: "M", color: { dark, light } });
}

export function QRCard({ url, title, caption, filename = "amal-qr.png" }) {
  const [src, setSrc] = useState("");
  useEffect(() => { qrDataUrl(url).then(setSrc); }, [url]);
  return <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-5 text-center">
    <div className="text-[11px] font-bold uppercase tracking-[1.4px] text-brand-bright">{title}</div>
    {src && <img src={src} alt={title} className="w-44 rounded-xl bg-white p-2" />}
    <div className="break-all text-[11px] text-muted">{url}</div>
    {caption && <div className="text-[12px] text-muted">{caption}</div>}
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" asChild><a href={src} download={filename}><Download /> PNG</a></Button>
      <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(url)}><Copy /> Link</Button>
    </div>
  </div>;
}
