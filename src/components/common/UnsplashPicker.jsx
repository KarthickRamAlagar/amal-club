import { useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { Spinner } from "./Primitives";

export function UnsplashPicker({ open, onOpenChange, initialQuery = "", onPick }) {
  const [q, setQ] = useState(initialQuery); const [rows, setRows] = useState([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function search(e) {
    e?.preventDefault(); if (!q.trim()) return;
    setBusy(true); setErr("");
    try { const r = await api(`unsplash?q=${encodeURIComponent(q)}`); setRows(r.results || []); }
    catch (er) { setErr(er.message); } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent wide>
      <DialogTitle>Pick from Unsplash</DialogTitle>
      <DialogDescription>Free, high-quality photos. Credit is saved with the event.</DialogDescription>
      <form onSubmit={search} className="mt-4 flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. parliament debate, leadership stage" /><Button type="submit">{busy ? <Spinner className="text-white" /> : <Search />} Search</Button></form>
      {err && <p className="mt-3 text-sm text-brand-bright">{err}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rows.map((p) => <button key={p.id} type="button" onClick={() => { onPick({ url: p.url, credit: `${p.author} on Unsplash` }); onOpenChange(false); }} className="group relative aspect-video overflow-hidden rounded-xl border border-line">
          <img src={p.thumb} alt={p.alt || ""} className="h-full w-full object-cover transition group-hover:scale-105" />
          <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1 text-left text-[10px] text-white">{p.author}</span>
        </button>)}
      </div>
    </DialogContent>
  </Dialog>;
}
