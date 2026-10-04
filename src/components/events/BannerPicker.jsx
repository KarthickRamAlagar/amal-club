import { useState } from "react";
import { doc } from "firebase/firestore";
import { ImagePlus, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageInput } from "@/components/common/ImageInput";
import { UnsplashPicker } from "@/components/common/UnsplashPicker";
import { Spinner } from "@/components/common/Primitives";
import { useDocData } from "@/hooks/useFirestore";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { db } from "@/lib/firebase";
import { uploadImage, dataUrlToBlob } from "@/lib/image";
import { LIMITS } from "@/lib/constants";
import { monthKey } from "@/lib/utils";

/** Event banner: upload, Unsplash, or AI (max 2 per Admin / Club Rep per month, enforced server-side). */
export function BannerPicker({ value, onChange, eventName, description }) {
  const { member } = useAuth();
  const [unsplash, setUnsplash] = useState(false); const [style, setStyle] = useState("cinematic, crimson and gold stage lighting"); const [busy, setBusy] = useState(false);
  const { data: quota } = useDocData(() => doc(db, "aiQuota", member.uid), [member.uid]);
  const used = quota?.month === monthKey() ? quota.banners || 0 : 0;
  const left = Math.max(0, LIMITS.aiBannersPerMonth - used);

  async function generate() {
    if (!eventName?.trim()) return toast.error("Add the event name first.");
    setBusy(true);
    try {
      const r = await api("ai/image", { purpose: "banner", eventName, description, style });
      const url = await uploadImage(await dataUrlToBlob(r.image), { kind: "banner" });
      onChange({ url, source: "ai", credit: `AI · ${r.provider}` });
      toast.success(`Banner generated with ${r.provider}. ${r.remaining} AI banner${r.remaining === 1 ? "" : "s"} left this month.`);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  return <div className="space-y-3">
    <ImageInput value={value} onChange={(url) => onChange({ url, source: "upload", credit: "" })} kind="banner" label="Upload banner (16:9 recommended)" />
    <div className="grid gap-2 sm:grid-cols-2">
      <Button type="button" variant="secondary" onClick={() => setUnsplash(true)}><Search /> Pick from Unsplash</Button>
      <Button type="button" variant="secondary" onClick={generate} disabled={busy || left <= 0}>{busy ? <Spinner /> : <Sparkles />} Generate with AI ({left}/{LIMITS.aiBannersPerMonth} left)</Button>
    </div>
    <Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="AI style hint" className="text-[13px]" />
    <UnsplashPicker open={unsplash} onOpenChange={setUnsplash} initialQuery={eventName} onPick={({ url, credit }) => onChange({ url, source: "unsplash", credit })} />
  </div>;
}

export function SponsorRow({ s, onChange, onRemove }) {
  const [pick, setPick] = useState(false);
  return <div className="flex items-start gap-3 rounded-xl border border-line p-3">
    <ImageInput value={s.logoUrl} onChange={(u) => onChange({ ...s, logoUrl: u })} kind="logo" label="Logo" aspect="aspect-square" className="w-20 shrink-0" />
    <div className="flex-1 space-y-2">
      <Input value={s.name} onChange={(e) => onChange({ ...s, name: e.target.value })} placeholder="Sponsor name" />
      <div className="flex gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setPick(true)}><ImagePlus /> Unsplash</Button><Button type="button" size="sm" variant="ghost" onClick={onRemove}>Remove</Button></div>
    </div>
    <UnsplashPicker open={pick} onOpenChange={setPick} initialQuery={`${s.name} logo`} onPick={({ url }) => onChange({ ...s, logoUrl: url })} />
  </div>;
}
