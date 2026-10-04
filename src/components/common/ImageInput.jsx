import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { uploadImage, cdn } from "@/lib/image";
import { Spinner } from "./Primitives";
import { cn } from "@/lib/utils";

/** Picks an image, compresses it to WebP (quality kept), uploads to Cloudinary, returns the public URL. */
export function ImageInput({ value, onChange, kind = "banner", label = "Upload image", round, className, aspect = "aspect-video" }) {
  const ref = useRef(); const [busy, setBusy] = useState(false);
  async function pick(e) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 15 * 1024 * 1024) { toast.error("Image is larger than 15 MB."); return; }
    setBusy(true);
    try { onChange(await uploadImage(f, { kind })); }
    catch (err) { toast.error(err.message); }
    finally { setBusy(false); e.target.value = ""; }
  }
  return <div className={cn("relative", className)}>
    <button type="button" onClick={() => ref.current.click()}
      className={cn("group relative grid w-full place-items-center overflow-hidden border border-dashed border-line bg-surface-2 text-muted transition hover:border-brand-bright",
        round ? "aspect-square rounded-full" : `${aspect} rounded-xl`)}>
      {value ? <img src={cdn(value, 900)} alt="" className="absolute inset-0 h-full w-full object-cover" />
        : <span className="flex flex-col items-center gap-1 p-3 text-center text-[12px]"><ImagePlus size={22} className="text-brand-bright" />{label}</span>}
      {busy && <span className="absolute inset-0 grid place-items-center bg-black/50"><Spinner /></span>}
      {value && !busy && <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-[11px] text-white opacity-0 transition group-hover:opacity-100">Change</span>}
    </button>
    {value && !round && <button type="button" onClick={() => onChange("")} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white" aria-label="Remove image"><X size={14} /></button>}
    <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
  </div>;
}
