import { Star } from "lucide-react";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Renders an AMAL form (own UI, not Google Forms). `values`/`onChange` optional for preview. */
export function FormRenderer({ fields, values = {}, onChange = () => {}, disabled }) {
  const set = (id, v) => onChange({ ...values, [id]: v });
  return <div className="space-y-4">{fields.map((f) => <Field key={f.id} label={f.label || "Untitled question"} required={f.required} hint={f.help}>
    {f.type === "textarea" ? <Textarea disabled={disabled} rows={3} value={values[f.id] || ""} onChange={(e) => set(f.id, e.target.value)} required={f.required} />
      : f.type === "select" ? <Select disabled={disabled} value={values[f.id] || ""} onChange={(e) => set(f.id, e.target.value)} required={f.required}><option value="">Choose…</option>{(f.options || []).map((o) => <option key={o}>{o}</option>)}</Select>
        : f.type === "radio" ? <div className="grid gap-2">{(f.options || []).map((o) => <label key={o} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm has-[:checked]:border-brand-bright">
          <input type="radio" name={f.id} disabled={disabled} checked={values[f.id] === o} onChange={() => set(f.id, o)} required={f.required} className="accent-[var(--red-bright)]" />{o}</label>)}</div>
          : f.type === "checkbox" ? <div className="grid gap-2">{(f.options || []).map((o) => { const arr = values[f.id] || []; return <label key={o} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm has-[:checked]:border-brand-bright">
            <input type="checkbox" disabled={disabled} checked={arr.includes(o)} onChange={(e) => set(f.id, e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} className="accent-[var(--red-bright)]" />{o}</label>; })}</div>
            : f.type === "rating" ? <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} disabled={disabled} onClick={() => set(f.id, n)} aria-label={`${n} stars`}><Star size={28} className={cn((values[f.id] || 0) >= n ? "fill-gold text-gold" : "text-muted")} /></button>)}</div>
              : <Input disabled={disabled} type={{ email: "email", phone: "tel", number: "number", date: "date" }[f.type] || "text"} value={values[f.id] || ""} onChange={(e) => set(f.id, e.target.value)} required={f.required} />}
  </Field>)}</div>;
}

export function validateAnswers(fields, values) {
  for (const f of fields) {
    const v = values[f.id];
    if (f.required && (v === undefined || v === "" || (Array.isArray(v) && !v.length))) return `"${f.label}" is required.`;
    if (v && f.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return `"${f.label}" must be an email.`;
  }
  return null;
}
