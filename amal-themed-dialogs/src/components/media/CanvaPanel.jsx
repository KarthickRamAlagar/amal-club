import { useCallback, useEffect, useState } from "react";
import { collection, query, where } from "firebase/firestore";
import { ExternalLink, Film, Image as ImageIcon, LogOut, PenLine, QrCode, RefreshCcw, Save, Search, Link2, Send, Trash2, FolderOpen, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Spinner, EmptyState } from "@/components/common/Primitives";
import { CanvaSaveDialog } from "./CanvaSaveDialog";
import { CANVA_PRESETS, canvaApi } from "@/lib/canva";
import { useAuth } from "@/context/AuthContext";
import { useQueryData } from "@/hooks/useFirestore";
import { mediaForEvent } from "@/services/media";
import { db } from "@/lib/firebase";
import { cdn } from "@/lib/image";
import { isAdmin } from "@/lib/permissions";
import { cn, errMsg, timeAgo } from "@/lib/utils";
import { confirmDialog } from "@/components/common/ConfirmDialog";

function CanvaMark({ size = 22 }) {
  return <span className="grid shrink-0 place-items-center rounded-full font-display font-extrabold text-white" style={{ width: size, height: size, fontSize: size * 0.5, background: "linear-gradient(135deg,#00c4cc,#7d2ae8)" }}>C</span>;
}

/** Everything Canva: connect, create a poster/video for the selected event, browse past designs, save to event. */
export function CanvaPanel({ ev }) {
  const { member: me } = useAuth();
  const [st, setSt] = useState(null);
  const [designs, setDesigns] = useState({ items: [], continuation: null, loading: false });
  const [q, setQ] = useState("");
  // Canva's API can't delete designs, so "delete" here = hide from this list (remembered on this device) + a shortcut to delete it in Canva
  const hideKey = `amal.canva.hidden.${me?.uid || "x"}`;
  const [hidden, setHidden] = useState(() => { try { return JSON.parse(localStorage.getItem(hideKey) || "[]"); } catch { return []; } });
  const [showHidden, setShowHidden] = useState(false);
  const [removing, setRemoving] = useState(null);
  const saveHidden = (list) => { setHidden(list); try { localStorage.setItem(hideKey, JSON.stringify(list)); } catch { /* private mode */ } };
  const [busy, setBusy] = useState("");
  const [saving, setSaving] = useState(null);
  const { data: sent } = useQueryData(() => (me?.uid && ev ? query(collection(db, "canvaAssets"), where("uid", "==", me.uid), where("eventId", "==", ev.slug)) : null), [me?.uid, ev?.slug]);
  const { data: eventMedia } = useQueryData(() => (ev ? mediaForEvent(ev.slug) : null), [ev?.slug]);

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
    if (!(await confirmDialog({ title: "Disconnect Canva?", description: "AMAL stops seeing your Canva designs. Everything you made stays in your Canva — you can connect again any time.", confirmText: "Disconnect", tone: "danger" }))) return;
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
  function report(r) {
    if (r.sent) toast.success(`In your Canva now: ${r.done.join(", ")}. Find them under Projects (left sidebar in the Canva editor).`, { duration: 9000 });
    if (r.pending?.length) toast(`Canva is still processing: ${r.pending.join(", ")} — videos can take a minute. Use "Check" in Files in my Canva.`, { duration: 9000 });
    if (r.failed?.length) toast.error(`Canva couldn't add: ${r.failed.map((f) => `${f.name} (${f.error})`).join("; ")}`, { duration: 12000 });
    if (!r.sent && !r.pending?.length && !r.failed?.length) toast.error("Nothing was sent.");
  }
  async function pushAssets() {
    if (!ev) return toast.error("Choose the event first.");
    setBusy("assets");
    try { report(await canvaApi("assets", { eventId: ev.slug })); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  }
  async function sendMedia(m) {
    setBusy(`m-${m.id}`);
    const t = m.kind === "video" ? toast.loading("Sending the video to Canva — this can take up to a minute…") : null;
    try { report(await canvaApi("sendMedia", { mediaId: m.id })); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); if (t) toast.dismiss(t); }
  }
  async function checkAsset(a) {
    setBusy(`a-${a.id}`);
    try { const r = await canvaApi("assetStatus", { id: a.id }); toast(r.status === "success" ? `${a.name} is ready in Canva → Projects.` : r.status === "failed" ? `Canva couldn't process ${a.name}${r.error ? `: ${r.error}` : "."}` : `${a.name} is still processing.`); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  }
  async function deleteAsset(a) {
    if (!(await confirmDialog({ title: `Delete “${a.name}” from your Canva?`, description: "It moves to your Canva Trash, so you can still restore it there. Designs that already use it keep it.", confirmText: "Delete", tone: "danger" }))) return;
    setBusy(`a-${a.id}`);
    try { await canvaApi("deleteAsset", { id: a.id }); toast.success(`Deleted "${a.name}" from your Canva.`); }
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

    {ev && <Card><CardHeader><div><CardTitle className="flex items-center gap-2"><FolderOpen size={18} className="text-brand-bright" /> Files in my Canva · {ev.name}</CardTitle>
      <CardDescription>What AMAL has put into your Canva for this event. In the Canva editor they're under <strong>Projects</strong> (left sidebar). Delete anything you no longer need.</CardDescription></div>
      <Button size="sm" variant="secondary" onClick={pushAssets} disabled={!!busy}>{busy === "assets" ? <Spinner /> : <QrCode />} Send QR + logo{ev.bannerUrl ? " + banner" : ""}</Button></CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-muted">Event posters &amp; videos → Canva</div>
          {!eventMedia.filter((m) => m.status !== "removed").length ? <p className="text-sm text-muted">Nothing saved to this event yet. Save a poster or a Video Studio reel first.</p>
            : <div className="space-y-2">{eventMedia.filter((m) => m.status !== "removed").map((m) => {
              const already = sent.some((a) => a.mediaId === m.id);
              return <div key={m.id} className="flex items-center gap-3 rounded-xl border border-line p-2">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">{(m.kind === "video" ? m.thumbUrl : m.url) && <img src={m.kind === "video" ? m.thumbUrl : cdn(m.url, 120)} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />}
                  {m.kind === "video" && <Film size={14} className="absolute bottom-1 right-1 text-white drop-shadow" />}</div>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{m.title || (m.kind === "video" ? "Event video" : "Event poster")}</div><div className="text-[11px] text-muted">{m.kind === "video" ? "Video" : "Poster"}{already ? " · already in your Canva" : ""}</div></div>
                <Button size="sm" variant={already ? "ghost" : "secondary"} onClick={() => sendMedia(m)} disabled={!!busy || /\.pdf($|\?)/i.test(m.url)} title={/\.pdf($|\?)/i.test(m.url) ? "PDFs can't be sent to Canva" : ""}>{busy === `m-${m.id}` ? <Spinner /> : <Send />} {already ? "Send again" : "Send to Canva"}</Button>
              </div>; })}</div>}
        </div>
        <div>
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-muted">Sent to my Canva</div>
          {!sent.length ? <p className="text-sm text-muted">Nothing sent yet for this event.</p>
            : <div className="space-y-2">{[...sent].sort((a, b) => b.createdAt - a.createdAt).map((a) => <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line p-2">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2">{a.preview ? <img src={a.preview.includes("res.cloudinary.com") ? cdn(a.preview, 120) : a.preview} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : a.kind === "qr" ? <QrCode size={20} className="text-muted" /> : a.type === "video" ? <Film size={20} className="text-muted" /> : <ImageIcon size={20} className="text-muted" />}</div>
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{a.name}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted"><Badge variant={a.status === "success" ? "ok" : a.status === "failed" ? "default" : "warn"}>{a.status === "success" ? "In Canva" : a.status === "failed" ? "Failed" : "Processing"}</Badge>{a.type === "video" ? "Video" : "Image"} · {timeAgo(a.createdAt)}</div></div>
              {a.status === "in_progress" && <Button size="sm" variant="ghost" onClick={() => checkAsset(a)} disabled={!!busy}>{busy === `a-${a.id}` ? <Spinner /> : <RefreshCcw />} Check</Button>}
              <Button size="sm" variant="ghost" onClick={() => deleteAsset(a)} disabled={!!busy} title="Delete from my Canva">{busy === `a-${a.id}` && a.status !== "in_progress" ? <Spinner /> : <Trash2 />}<span className="sr-only">Delete</span></Button>
            </div>)}</div>}
        </div>
      </CardContent></Card>}

    <Card><CardHeader><div><CardTitle>My Canva designs</CardTitle><CardDescription>Your past files from Canva. Open to keep editing, or save a finished one to an event.</CardDescription></div>
      <form onSubmit={(e) => { e.preventDefault(); loadDesigns(false); }} className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your designs" className="h-9 w-56" /><Button size="sm" variant="secondary" type="submit"><Search /></Button><Button size="sm" variant="ghost" type="button" onClick={() => loadDesigns(false)}><RefreshCcw /></Button></form>
    </CardHeader><CardContent>
      {designs.loading && !designs.items.length ? <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Loading designs…</div>
        : !designs.items.length ? <EmptyState icon={ImageIcon} title="No designs found." />
          : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {designs.items.filter((d) => showHidden || !hidden.includes(d.id)).map((d) => <div key={d.id} className={cn("overflow-hidden rounded-xl border border-line bg-surface-2", hidden.includes(d.id) && "opacity-50")}>
              <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-surface">{d.thumb ? <img src={d.thumb} alt="" className="h-full w-full object-contain" loading="lazy" /> : <ImageIcon className="text-muted" />}</div>
              <div className="space-y-2 p-3">
                <div className="truncate text-sm font-bold" title={d.title}>{d.title}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted">{d.pages > 1 && <Badge variant="muted">{d.pages} pages</Badge>}<span>edited {timeAgo(d.updatedAt)}</span></div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => openDesign(d)} disabled={!!busy}>{busy === d.id ? <Spinner /> : <PenLine />} Edit</Button>
                  <Button size="sm" onClick={() => setSaving({ designId: d.id, title: d.title, thumb: d.thumb, pages: d.pages })}><Save /> Save to event</Button>
                  {hidden.includes(d.id) ? <Button size="sm" variant="ghost" title="Show in this list again" onClick={() => saveHidden(hidden.filter((x) => x !== d.id))}><Eye /></Button>
                    : <Button size="sm" variant="ghost" title="Delete" onClick={() => setRemoving(d)}><Trash2 /><span className="sr-only">Delete</span></Button>}
                </div>
              </div>
            </div>)}
          </div>}
      {hidden.length > 0 && <div className="mt-3 text-[12px] text-muted"><button type="button" className="underline hover:text-fg" onClick={() => setShowHidden((v) => !v)}>{showHidden ? "Hide removed designs" : `Show ${hidden.length} removed design${hidden.length > 1 ? "s" : ""}`}</button></div>}
      {designs.continuation && <div className="mt-4 text-center"><Button variant="secondary" onClick={() => loadDesigns(true)} disabled={designs.loading}>{designs.loading ? <Spinner /> : null} Load more</Button></div>}
    </CardContent></Card>

    <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
      {removing && <DialogContent>
        <DialogTitle>Delete “{removing.title}”?</DialogTitle>
        <DialogDescription>Canva doesn't let other apps delete your designs — only you can, inside Canva. Choose what you'd like:</DialogDescription>
        <div className="mt-5 grid gap-2">
          <Button onClick={() => { saveHidden([...new Set([...hidden, removing.id])]); toast.success("Removed from this list. It's still in your Canva."); setRemoving(null); }}><EyeOff /> Remove from this list</Button>
          <Button variant="secondary" onClick={() => { const d = removing; setRemoving(null); openDesign(d); }}><ExternalLink /> Open in Canva to delete it</Button>
          <p className="text-[12px] text-muted">In Canva: <strong>File → Move to trash</strong>, or on the Canva home page right-click the design → <strong>Move to trash</strong>. Blank designs made from AMAL that are never edited are deleted by Canva automatically after 7 days.</p>
        </div>
      </DialogContent>}
    </Dialog>

    <CanvaSaveDialog open={!!saving} onOpenChange={(o) => !o && setSaving(null)} design={saving} eventId={ev?.slug} kind="poster" />
  </div>;
}
