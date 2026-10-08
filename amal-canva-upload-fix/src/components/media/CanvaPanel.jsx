import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Film, Image as ImageIcon, LogOut, PenLine, QrCode, RefreshCcw, Save, Search, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner, EmptyState } from "@/components/common/Primitives";
import { CanvaSaveDialog } from "./CanvaSaveDialog";
import { CANVA_PRESETS, canvaApi } from "@/lib/canva";
import { useAuth } from "@/context/AuthContext";
import { isAdmin } from "@/lib/permissions";
import { errMsg, timeAgo } from "@/lib/utils";

function CanvaMark({ size = 22 }) {
  return <span className="grid shrink-0 place-items-center rounded-full font-display font-extrabold text-white" style={{ width: size, height: size, fontSize: size * 0.5, background: "linear-gradient(135deg,#00c4cc,#7d2ae8)" }}>C</span>;
}

/** Everything Canva: connect, create a poster/video for the selected event, browse past designs, save to event. */
export function CanvaPanel({ ev }) {
  const { member: me } = useAuth();
  const [st, setSt] = useState(null);
  const [designs, setDesigns] = useState({ items: [], continuation: null, loading: false });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [saving, setSaving] = useState(null);

  const loadStatus = useCallback(() => canvaApi("status").then(setSt).catch((e) => setSt({ error: errMsg(e) })), []);
  const loadDesigns = useCallback(async (more = false) => {
    setDesigns((d) => ({ ...d, loading: true }));
    try {
      const r = await canvaApi("designs", { query: q || undefined, continuation: more ? designs.continuation : undefined });
      setDesigns((d) => ({ items: more ? [...d.items, ...r.items] : r.items, continuation: r.continuation, loading: false }));
    } catch (e) { toast.error(errMsg(e)); setDesigns((d) => ({ ...d, loading: false })); if (/connect/i.test(errMsg(e))) loadStatus(); }
  }, [q, designs.continuation, loadStatus]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { if (st?.connected) loadDesigns(false); }, [st?.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  async function connect() {
    setBusy("connect");
    try { const r = await canvaApi("connect", { returnTo: `/dashboard/media${ev ? `?event=${ev.slug}` : ""}` }); window.location.href = r.url; }
    catch (e) { toast.error(errMsg(e)); setBusy(""); }
  }
  async function disconnect() {
    if (!confirm("Disconnect your Canva account from AMAL? Your designs stay in Canva.")) return;
    await canvaApi("disconnect").catch(() => {}); setDesigns({ items: [], continuation: null }); loadStatus();
  }
  async function create(preset) {
    if (!ev) return toast.error("Choose the event first (top of the page).");
    setBusy(preset);
    try { const r = await canvaApi("create", { preset, eventId: ev.slug }); window.location.href = r.editUrl; }
    catch (e) { toast.error(errMsg(e)); setBusy(""); }
  }
  async function openDesign(d) {
    setBusy(d.id);
    try { const r = await canvaApi("open", { designId: d.id, eventId: ev?.slug, kind: kindOf(d) }); window.location.href = r.editUrl; }
    catch (e) { toast.error(errMsg(e)); setBusy(""); }
  }
  async function pushAssets() {
    if (!ev) return toast.error("Choose the event first.");
    setBusy("assets");
    try {
      const r = await canvaApi("assets", { eventId: ev.slug });
      if (r.sent) toast.success(`Added to your Canva uploads: ${r.done.join(", ")}. In the Canva editor open Uploads → Images (reload the editor if it was already open).`, { duration: 9000 });
      if (r.pending?.length) toast(`Canva is still processing: ${r.pending.join(", ")} — they'll appear in Uploads in a minute.`, { duration: 9000 });
      if (r.failed?.length) toast.error(`Canva couldn't add: ${r.failed.map((f) => `${f.name} (${f.error})`).join("; ")}`, { duration: 12000 });
      if (!r.sent && !r.pending?.length && !r.failed?.length) toast.error("Nothing was uploaded.");
    }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  }
  const kindOf = (d) => (d.width && d.height && d.types?.includes("video") ? "video" : "poster");

  if (!st) return <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-muted"><Spinner /> Checking Canva…</CardContent></Card>;
  if (st.error) return <Card><CardContent className="p-6 text-sm text-muted">Couldn't reach the Canva service: {st.error}</CardContent></Card>;
  if (!st.configured) return <Card><CardHeader><div><CardTitle className="flex items-center gap-2"><CanvaMark /> Canva isn't set up yet</CardTitle>
    <CardDescription>{isAdmin(me) ? "Register the AMAL app in the Canva Developer Portal and add its keys to Vercel (see the setup guide)." : "Ask the Admin to finish the Canva setup."}</CardDescription></div></CardHeader>
    {isAdmin(me) && <CardContent className="space-y-1 text-[13px] text-muted">
      <p>1. canva.com/developers → <strong>Your integrations → Create an integration</strong> (Public).</p>
      <p>2. Scopes: design:meta:read, design:content:read, design:content:write, asset:read, asset:write, profile:read.</p>
      <p>3. Redirect URL: <code>{window.location.origin}/api/canva/callback</code></p>
      <p>4. Return navigation URL: <code>{window.location.origin}/dashboard/media/canva-return</code></p>
      <p>5. Vercel env: <code>CANVA_CLIENT_ID</code>, <code>CANVA_CLIENT_SECRET</code> → redeploy.</p>
    </CardContent>}</Card>;

  if (!st.connected) return <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
    <CanvaMark size={54} />
    <h3 className="font-display text-xl font-extrabold">Connect your Canva account</h3>
    <p className="max-w-md text-sm text-muted">Sign in once with your own Canva (free or Pro). Your designs stay in your Canva — AMAL only lists them here and saves the final file you choose to the event.</p>
    <Button onClick={connect} disabled={busy === "connect"}>{busy === "connect" ? <Spinner className="text-white" /> : <Link2 />} Connect Canva</Button>
  </CardContent></Card>;

  return <div className="space-y-5">
    <Card><CardHeader>
      <div className="flex items-center gap-3"><CanvaMark size={36} /><div><CardTitle>Canva connected</CardTitle><CardDescription>{st.displayName ? `Signed in as ${st.displayName}` : "Your Canva account"} · designs are created and kept in your Canva.</CardDescription></div></div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={pushAssets} disabled={!ev || busy === "assets"}>{busy === "assets" ? <Spinner /> : <QrCode />} Send event QR + logo to my Canva</Button>
        <Button size="sm" variant="ghost" onClick={disconnect}><LogOut /> Disconnect</Button>
      </div>
    </CardHeader></Card>

    <div className="grid gap-5 lg:grid-cols-2">
      {[["poster", ImageIcon, "New poster"], ["video", Film, "New video"]].map(([k, I, label]) => <Card key={k}><CardHeader><div><CardTitle className="flex items-center gap-2"><I size={18} className="text-brand-bright" /> {label}</CardTitle>
        <CardDescription>{ev ? <>Opens a blank Canva design for <strong>{ev.name}</strong>. Press <em>Return</em> in Canva to come back and save it.</> : "Choose an event at the top first."}</CardDescription></div></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {CANVA_PRESETS[k].map(([id, name, size]) => <button key={id} type="button" disabled={!ev || !!busy} onClick={() => create(id)}
            className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 p-3 text-left text-sm transition hover:border-brand-bright disabled:opacity-50">
            <span><strong className="block">{name}</strong><span className="text-[11px] text-muted">{size}</span></span>{busy === id ? <Spinner /> : <ExternalLink size={15} className="text-muted" />}</button>)}
        </CardContent></Card>)}
    </div>

    <Card><CardHeader><div><CardTitle>My Canva designs</CardTitle><CardDescription>Your past files from Canva. Open to keep editing, or save a finished one to an event.</CardDescription></div>
      <form onSubmit={(e) => { e.preventDefault(); loadDesigns(false); }} className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your designs" className="h-9 w-56" /><Button size="sm" variant="secondary" type="submit"><Search /></Button><Button size="sm" variant="ghost" type="button" onClick={() => loadDesigns(false)}><RefreshCcw /></Button></form>
    </CardHeader><CardContent>
      {designs.loading && !designs.items.length ? <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Loading designs…</div>
        : !designs.items.length ? <EmptyState icon={ImageIcon} title="No designs found." />
          : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {designs.items.map((d) => <div key={d.id} className="overflow-hidden rounded-xl border border-line bg-surface-2">
              <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-surface">{d.thumb ? <img src={d.thumb} alt="" className="h-full w-full object-contain" loading="lazy" /> : <ImageIcon className="text-muted" />}</div>
              <div className="space-y-2 p-3">
                <div className="truncate text-sm font-bold" title={d.title}>{d.title}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted">{d.pages > 1 && <Badge variant="muted">{d.pages} pages</Badge>}<span>edited {timeAgo(d.updatedAt)}</span></div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => openDesign(d)} disabled={!!busy}>{busy === d.id ? <Spinner /> : <PenLine />} Edit</Button>
                  <Button size="sm" onClick={() => setSaving({ designId: d.id, title: d.title, thumb: d.thumb, pages: d.pages })}><Save /> Save to event</Button>
                </div>
              </div>
            </div>)}
          </div>}
      {designs.continuation && <div className="mt-4 text-center"><Button variant="secondary" onClick={() => loadDesigns(true)} disabled={designs.loading}>{designs.loading ? <Spinner /> : null} Load more</Button></div>}
    </CardContent></Card>

    <CanvaSaveDialog open={!!saving} onOpenChange={(o) => !o && setSaving(null)} design={saving} eventId={ev?.slug} kind="poster" />
  </div>;
}
