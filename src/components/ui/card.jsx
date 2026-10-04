import { cn } from "@/lib/utils";
export const Card = ({ className, ...p }) => <div className={cn("rounded-2xl border border-line bg-surface shadow-[var(--shadow)]", className)} {...p} />;
export const CardHeader = ({ className, ...p }) => <div className={cn("flex flex-wrap items-start justify-between gap-3 p-5 pb-3", className)} {...p} />;
export const CardTitle = ({ className, ...p }) => <h3 className={cn("font-display text-[17px] font-extrabold tracking-tight", className)} {...p} />;
export const CardDescription = ({ className, ...p }) => <p className={cn("mt-1 text-[13px] text-muted", className)} {...p} />;
export const CardContent = ({ className, ...p }) => <div className={cn("p-5 pt-2", className)} {...p} />;
