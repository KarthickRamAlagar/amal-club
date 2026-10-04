import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn("field", className)} {...p} />;
});
export const Textarea = forwardRef(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn("field", className)} {...p} />;
});
export const Select = forwardRef(function Select({ className, children, ...p }, ref) {
  return <select ref={ref} className={cn("field", className)} {...p}>{children}</select>;
});
export function Label({ className, children, hint, required, ...p }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-[12px] font-semibold text-muted", className)} {...p}>
      {children}
      {hint && <span className="text-[11px] font-normal opacity-80">{hint}</span>}
    </label>
  );
}
export function Field({ label, hint, required, error, className, children }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <span className="text-[12px] font-semibold text-muted">{label}{required && <span className="text-brand-bright"> *</span>}</span>}
      {children}
      {error ? <span className="text-[11px] text-brand-bright">{error}</span> : hint ? <span className="text-[11px] text-muted opacity-80">{hint}</span> : null}
    </div>
  );
}
