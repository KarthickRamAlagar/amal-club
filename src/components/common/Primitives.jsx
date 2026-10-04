import { LoaderCircle, Inbox } from "lucide-react";
import { IMAGES } from "@/lib/constants";
import { cdn } from "@/lib/image";
import { cn } from "@/lib/utils";

export const Eyebrow = ({ children, className }) => <div className={cn("eyebrow", className)}><span />{children}</div>;

export function SectionTitle({ eyebrow, title, subtitle, action }) {
  return <div className="section-title"><div>{eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}<h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}

export function ImageCard({ src, alt, className = "", w = 1200 }) {
  return <div className={`image-cover ${className}`} role="img" aria-label={alt || "AMAL Club"}
    style={{ backgroundImage: `linear-gradient(180deg, transparent 35%, rgba(16,9,13,.2)), url("${cdn(src, w) || IMAGES.community}")` }} />;
}

export function PageShell({ eyebrow, title, subtitle, image, children, wide }) {
  return <>
    <section className="page-hero" style={{ backgroundImage: `linear-gradient(90deg, var(--page-shade), rgba(20,5,10,.45)), url("${cdn(image, 1800) || IMAGES.hero}")` }}>
      <Eyebrow>{eyebrow}</Eyebrow><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}
    </section>
    <section className={cn("section page-content", wide && "max-w-none")}>{children}</section>
  </>;
}

export const Spinner = ({ className, size = 18 }) => <LoaderCircle size={size} className={cn("animate-spin text-brand-bright", className)} />;

export function PageLoader({ label = "Loading…" }) {
  return <div className="grid min-h-[40vh] place-items-center"><div className="flex items-center gap-3 text-sm text-muted"><Spinner />{label}</div></div>;
}

export function EmptyState({ icon: Icon = Inbox, title, children, action, className }) {
  return <div className={cn("flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line p-10 text-center", className)}>
    <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-brand-bright"><Icon size={22} /></span>
    <h3 className="font-display text-base font-extrabold">{title}</h3>
    {children && <p className="max-w-md text-sm text-muted">{children}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>;
}

export function Stat({ label, value, hint, icon: Icon }) {
  return <div className="rounded-2xl border border-line bg-surface p-5">
    <div className="flex items-center justify-between text-[12px] font-semibold text-muted">{label}{Icon && <Icon size={16} className="text-brand-bright" />}</div>
    <div className="mt-2 font-display text-3xl font-extrabold tracking-tight">{value}</div>
    {hint && <div className="mt-1 text-[12px] text-muted">{hint}</div>}
  </div>;
}

export function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return <div className="mt-4 flex items-center justify-end gap-2 text-sm">
    <button className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
    <span className="text-muted">Page {page} of {pages}</span>
    <button className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
  </div>;
}

export function usePaged(rows, size = 10, page = 1) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(page, pages);
  return { rows: rows.slice((p - 1) * size, p * size), pages, page: p };
}
