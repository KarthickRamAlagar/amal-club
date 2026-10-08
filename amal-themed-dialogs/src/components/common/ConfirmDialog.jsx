import { useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * AMAL-themed replacements for the browser's confirm() / prompt().
 *   if (!(await confirmDialog({ title, description, confirmText: "Delete", tone: "danger" }))) return;
 *   const reason = await promptDialog({ title, label, placeholder, required: true }); // null when cancelled
 * <ConfirmHost /> is mounted once in main.jsx.
 */
let push = null;
const queue = [];
function open(req) {
  return new Promise((resolve) => {
    const item = { ...req, resolve };
    if (push) push(item); else queue.push(item);
  });
}
export const confirmDialog = (opts) => open({ kind: "confirm", ...opts });
export const promptDialog = (opts) => open({ kind: "prompt", ...opts });

export function ConfirmHost() {
  const [items, setItems] = useState([]);
  const [value, setValue] = useState("");
  const inputRef = useRef(null);
  const cur = items[0];

  useEffect(() => {
    push = (item) => setItems((l) => [...l, item]);
    if (queue.length) setItems((l) => [...l, ...queue.splice(0)]);
    return () => { push = null; };
  }, []);
  useEffect(() => { if (cur) { setValue(cur.defaultValue || ""); setTimeout(() => inputRef.current?.focus(), 60); } }, [cur]);

  function close(result) {
    if (!cur) return;
    cur.resolve(result);
    setItems((l) => l.slice(1));
  }
  if (!cur) return null;
  const danger = cur.tone === "danger";
  const isPrompt = cur.kind === "prompt";
  const ok = () => {
    if (isPrompt) { const v = value.trim(); if (cur.required && !v) { inputRef.current?.focus(); return; } close(v); }
    else close(true);
  };
  const Icon = danger ? AlertTriangle : HelpCircle;

  return <Dialog open onOpenChange={(o) => { if (!o) close(isPrompt ? null : false); }}>
    <DialogContent className="max-w-md" onOpenAutoFocus={(e) => { if (isPrompt) e.preventDefault(); }}>
      <div className="flex items-start gap-3.5">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", danger ? "bg-[#7a0f22]/40 text-brand-bright" : "bg-gold/15 text-gold")}><Icon size={20} /></span>
        <div className="min-w-0 flex-1 pt-0.5">
          <DialogTitle className="text-lg">{cur.title || (isPrompt ? "Add a note" : "Are you sure?")}</DialogTitle>
          {cur.description && <DialogDescription className="whitespace-pre-line">{cur.description}</DialogDescription>}
        </div>
      </div>
      {isPrompt && <form className="mt-4" onSubmit={(e) => { e.preventDefault(); ok(); }}>
        {cur.label && <label className="mb-1.5 block text-[13px] font-semibold">{cur.label}{cur.required && <span className="text-brand-bright"> *</span>}</label>}
        {cur.multiline ? <Textarea ref={inputRef} rows={3} value={value} onChange={(e) => setValue(e.target.value)} placeholder={cur.placeholder} maxLength={cur.maxLength || 500} />
          : <Input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder={cur.placeholder} maxLength={cur.maxLength || 500} type={cur.type || "text"} />}
        {cur.hint && <p className="mt-1.5 text-[12px] text-muted">{cur.hint}</p>}
      </form>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => close(isPrompt ? null : false)}>{cur.cancelText || "Cancel"}</Button>
        <Button variant={danger ? "danger" : "default"} onClick={ok} disabled={isPrompt && cur.required && !value.trim()}>{cur.confirmText || (isPrompt ? "Save" : "Confirm")}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
