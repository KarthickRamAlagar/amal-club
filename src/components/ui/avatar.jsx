import { useState } from "react";
import { cn, initials } from "@/lib/utils";
import { cdn } from "@/lib/image";
export function Avatar({ src, name, size = 40, className, ring }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.36) };
  return src && !broken ? (
    <img src={cdn(src, size * 2)} alt={name || ""} style={style} onError={() => setBroken(true)}
      className={cn("shrink-0 rounded-full object-cover", ring && "ring-2 ring-brand-bright ring-offset-2 ring-offset-[var(--surface)]", className)} />
  ) : (
    <span style={style} className={cn("grid shrink-0 place-items-center rounded-full brand-gradient font-display font-extrabold text-white", ring && "ring-2 ring-gold", className)}>
      {initials(name)}
    </span>
  );
}
