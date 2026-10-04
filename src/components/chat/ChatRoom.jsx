import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { collection, limitToLast, orderBy, query, where } from "firebase/firestore";
import {
  ArrowLeft, AtSign, Check, CheckCheck, Clock, CreditCard, Home, MapPin, Navigation, Send, Users, X, Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useQueryData, useNow } from "@/hooks/useFirestore";
import { sendMessage, submitPayment } from "@/services/chat";
import { setRegistrationStatus, sweepExpired, effectiveStatus } from "@/services/registrations";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ImageInput } from "@/components/common/ImageInput";
import { Spinner } from "@/components/common/Primitives";
import { cn, countdown, fmtTime, fmtDate, toMillis, errMsg } from "@/lib/utils";
import { cdn } from "@/lib/image";
import { REG_STATUS } from "@/lib/constants";

const STATUS_BADGE = {
  pending_payment: ["warn", "Payment pending"], confirmed: ["ok", "Confirmed"], expired: ["muted", "Dropped (5h)"], rejected: ["default", "Rejected"],
};

/**
 * WhatsApp-style event chat.
 * Members: Admin, Club Representatives, all Team Leads + every registered team.
 */
export function ChatRoom({ ev, me, sender, staff, myReg }) {
  const now = useNow(30000);
  const { data: messages, loading } = useQueryData(
    () => query(collection(db, "events", ev.slug, "messages"), orderBy("createdAt", "asc"), limitToLast(400)), [ev.slug]);
  const { data: regs } = useQueryData(
    () => (staff ? query(collection(db, "registrations"), where("eventId", "==", ev.slug)) : null), [ev.slug, staff]);
  const regById = useMemo(() => Object.fromEntries(regs.map((r) => [r.id, r])), [regs]);
  const [text, setText] = useState(""); const [mentions, setMentions] = useState([]);
  const [picker, setPicker] = useState(false); const [addrOpen, setAddrOpen] = useState(false); const [payOpen, setPayOpen] = useState(false);
  const [panel, setPanel] = useState(false);
  const endRef = useRef(); const inputRef = useRef();
  const swept = useRef(0);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length]);
  // lazy 5-hour sweep from staff clients
  useEffect(() => {
    if (!staff || !regs.length || Date.now() - swept.current < 60000) return;
    swept.current = Date.now(); sweepExpired(me, regs).catch(() => {});
  }, [regs, staff, me]);

  const myStatus = myReg ? effectiveStatus(myReg) : null;
  const canWrite = staff || (myReg && [REG_STATUS.pending, REG_STATUS.confirmed].includes(myStatus));

  async function send(e) {
    e?.preventDefault();
    const t = text.trim(); if (!t) return;
    setText(""); setPicker(false); const ms = mentions.filter((m) => t.includes(`@${m.name}`)); setMentions([]);
    try { await sendMessage(ev.slug, sender, { type: "text", text: t, mentions: ms }); }
    catch (er) { toast.error(errMsg(er)); setText(t); }
  }
  function tag(r) { setText((s) => `${s.replace(/@$/, "")}${s && !s.endsWith(" ") && !s.endsWith("@") ? " " : ""}@${r.teamName} `); setMentions((m) => [...m, { uid: r.uid, name: r.teamName, regId: r.id }]); setPicker(false); setTimeout(() => inputRef.current?.focus(), 0); }
  function shareLocation() {
    if (!navigator.geolocation) return toast.error("Location isn't available on this device.");
    toast.message("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      (p) => sendMessage(ev.slug, sender, { type: "location", lat: p.coords.latitude, lng: p.coords.longitude, text: ev.location || "Venue" }).catch((e) => toast.error(errMsg(e))),
      () => toast.error("Location permission was denied."), { enableHighAccuracy: true, timeout: 12000 });
  }
  async function decide(reg, status) {
    const note = status === REG_STATUS.rejected ? prompt("Reason for rejecting (shown in chat):") : "";
    if (status === REG_STATUS.rejected && !note) return;
    try { await setRegistrationStatus(me, reg, status, note || ""); toast.success(status === REG_STATUS.confirmed ? `${reg.teamName} confirmed and tagged.` : "Updated."); }
    catch (e) { toast.error(errMsg(e)); }
  }

  const counts = useMemo(() => {
    const c = { confirmed: 0, pending_payment: 0, expired: 0, rejected: 0 };
    regs.forEach((r) => { c[effectiveStatus(r)] = (c[effectiveStatus(r)] || 0) + 1; }); return c;
  }, [regs, now]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="mx-auto grid h-[calc(100vh-82px)] max-w-[1400px] grid-cols-1 overflow-hidden md:grid-cols-[1fr_340px] md:border-x md:border-line">
    {/* ── Main chat ── */}
    <div className="flex min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <Link to={`/events/${ev.slug}`} className="text-muted hover:text-fg" aria-label="Back to event"><ArrowLeft size={20} /></Link>
        <img src="/amal-logo.jpg" alt="AMAL" className="h-11 w-11 rounded-full bg-white object-cover ring-2 ring-brand-bright" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[16px] font-extrabold">{ev.name} · AMAL</div>
          <div className="truncate text-[12px] text-muted">{staff ? `${regs.length} teams · ${counts.confirmed} confirmed · ${counts.pending_payment} pending` : "Organisers · Team leads · Registered teams"}</div>
        </div>
        <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setPanel(true)} aria-label="Details"><Users /></Button>
      </header>

      {!staff && myReg && <ParticipantStrip reg={myReg} status={myStatus} ev={ev} now={now} onPay={() => setPayOpen(true)} />}

      <div className="chat-wall min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6" onClick={() => setPicker(false)}>
        {loading && <div className="grid place-items-center py-10"><Spinner /></div>}
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <div className="mx-auto my-2 max-w-md rounded-xl bg-surface/90 px-4 py-2 text-center text-[12px] text-muted">
            🔒 This chat is for <strong>{ev.name}</strong>. Organisers will tag your team once payment is verified.
          </div>
          {messages.map((m, i) => <Message key={m.id} m={m} prev={messages[i - 1]} mine={m.sender?.uid === sender.uid} staff={staff}
            myUid={sender.uid} reg={m.regId ? regById[m.regId] : null} onDecide={decide} />)}
          <div ref={endRef} />
        </div>
      </div>

      {canWrite ? <form onSubmit={send} className="relative border-t border-line bg-surface p-3">
        {picker && staff && <div className="absolute bottom-full left-3 mb-2 max-h-64 w-72 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-2xl">
          {regs.filter((r) => effectiveStatus(r) !== "expired").map((r) => <button type="button" key={r.id} onClick={() => tag(r)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2">
            <Avatar src={r.leader?.photoUrl} name={r.teamName} size={28} /><span className="flex-1 truncate">{r.teamName}</span><Badge variant={STATUS_BADGE[effectiveStatus(r)]?.[0]}>{STATUS_BADGE[effectiveStatus(r)]?.[1]}</Badge>
          </button>)}
          {!regs.length && <p className="p-3 text-sm text-muted">No teams yet.</p>}
        </div>}
        <div className="flex items-end gap-2">
          {staff ? <div className="flex gap-1">
            <Button type="button" size="icon" variant="ghost" title="Tag a team" onClick={() => setPicker(!picker)}><AtSign /></Button>
            <Button type="button" size="icon" variant="ghost" title="Share live location" onClick={shareLocation}><Navigation /></Button>
            <Button type="button" size="icon" variant="ghost" title="Send address" onClick={() => setAddrOpen(true)}><Home /></Button>
          </div> : myStatus === REG_STATUS.pending && <Button type="button" variant="gold" size="sm" className="h-10" onClick={() => setPayOpen(true)}><CreditCard /> Payment</Button>}
          <Textarea ref={inputRef} value={text} rows={1} onChange={(e) => { setText(e.target.value); if (staff && e.target.value.endsWith("@")) setPicker(true); }}
            onKeyDown={(e) => { if (e.key === "Escape") setPicker(false); if (e.key === "Enter" && !e.shiftKey) send(e); }}
            placeholder="Type a message" style={{ minHeight: 44, height: 44 }} className="max-h-32 flex-1 rounded-2xl py-2.5" />
          <Button type="submit" size="icon" className="h-11 w-11 rounded-full" aria-label="Send"><Send /></Button>
        </div>
      </form> : <div className="border-t border-line bg-surface p-4 text-center text-sm text-muted">This chat is read-only for your registration status.</div>}
    </div>

    {/* ── Side panel ── */}
    <aside className={cn("min-h-0 overflow-y-auto border-l border-line bg-surface", panel ? "fixed inset-0 z-[80] block" : "hidden md:block")}>
      <div className="flex items-center justify-between border-b border-line p-4"><strong className="font-display">{staff ? "Teams" : "Event info"}</strong>
        <button className="md:hidden" onClick={() => setPanel(false)} aria-label="Close"><X size={18} /></button></div>
      {staff ? <TeamList regs={regs} now={now} onDecide={decide} ev={ev} /> : <EventInfo ev={ev} />}
    </aside>

    <AddressDialog open={addrOpen} onOpenChange={setAddrOpen} onSend={(t) => sendMessage(ev.slug, sender, { type: "address", text: t })} defaultValue={ev.location} />
    {myReg && <PaymentDialog open={payOpen} onOpenChange={setPayOpen} ev={ev} reg={myReg} sender={sender} />}
  </div>;
}

function ParticipantStrip({ reg, status, ev, now, onPay }) {
  const left = reg.expiresAt ? reg.expiresAt - now : 0;
  return <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-2 px-4 py-2.5 text-[13px]">
    <Badge variant={STATUS_BADGE[status]?.[0]}>{STATUS_BADGE[status]?.[1]}</Badge>
    <span className="text-muted">Team <strong className="text-fg">{reg.teamName}</strong></span>
    {status === REG_STATUS.pending && <>
      <span className="inline-flex items-center gap-1 text-warn"><Clock size={14} />{countdown(left)} left to verify</span>
      {reg.payment ? <span className="text-muted">Payment sent · waiting for organisers</span>
        : <Button size="sm" variant="gold" className="ml-auto" onClick={onPay}><CreditCard /> Pay ₹{ev.price} & send details</Button>}
    </>}
  </div>;
}

function Message({ m, prev, mine, staff, myUid, reg, onDecide }) {
  const showDay = !prev || fmtDate(prev.createdAt) !== fmtDate(m.createdAt);
  const grouped = prev && prev.sender?.uid === m.sender?.uid && prev.type !== "system" && toMillis(m.createdAt) - toMillis(prev.createdAt) < 300000;
  const tagged = (m.mentions || []).some((x) => x.uid === myUid);
  const day = showDay && m.createdAt && <div className="my-3 self-center rounded-lg bg-surface px-3 py-1 text-[11px] font-semibold text-muted">{fmtDate(m.createdAt)}</div>;
  if (m.type === "system") return <>{day}<div className={cn("my-1 self-center rounded-xl px-4 py-2 text-center text-[12.5px]", tagged ? "bg-[color-mix(in_oklab,var(--gold)_22%,transparent)] text-fg" : "bg-surface text-muted")}>{highlight(m.text, m.mentions)}</div></>;
  const s = m.sender || {};
  return <>{day}<div className={cn("flex gap-2", mine ? "flex-row-reverse" : "", grouped ? "mt-0" : "mt-2")}>
    <div className="w-8 shrink-0">{!grouped && !mine && <Avatar src={s.photoUrl} name={s.name} size={32} />}</div>
    <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2 shadow-sm", mine ? "bubble-out" : "bubble-in", tagged && !mine && "ring-2 ring-gold")}>
      {!grouped && !mine && <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[12px] font-bold">
        <span className={s.kind === "staff" ? "text-brand-bright" : "text-gold"}>{s.name}</span>
        {s.kind === "staff" ? <span className="text-[10px] font-semibold opacity-70">{s.designation}</span> : s.teamName && <span className="text-[10px] font-semibold opacity-70">{s.teamName}</span>}
      </div>}
      <Body m={m} mine={mine} staff={staff} reg={reg} onDecide={onDecide} />
      <div className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", mine ? "text-white/70" : "text-muted")}>{fmtTime(m.createdAt)}{mine && <CheckCheck size={12} />}</div>
    </div>
  </div></>;
}

function highlight(text = "", mentions = []) {
  if (!mentions?.length) return text;
  const names = mentions.map((x) => x.name).filter(Boolean).sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!names.length) return text;
  const parts = text.split(new RegExp(`(@(?:${names.join("|")}))`, "g"));
  return parts.map((p, i) => (p.startsWith("@") && names.some((n) => p === `@${n.replace(/\\/g, "")}`) ? <strong key={i} className="rounded bg-black/20 px-1 text-gold">{p}</strong> : p));
}

function Body({ m, mine, staff, reg, onDecide }) {
  if (m.type === "location") {
    const d = 0.004; const bbox = [m.lng - d, m.lat - d, m.lng + d, m.lat + d].join(",");
    return <div className="w-64 max-w-full overflow-hidden rounded-xl">
      <iframe title="Location" className="h-36 w-full border-0" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${m.lat},${m.lng}`} />
      <a href={`https://www.google.com/maps?q=${m.lat},${m.lng}`} target="_blank" rel="noreferrer" className={cn("flex items-center gap-1.5 px-2 py-2 text-[13px] font-semibold", mine ? "text-white" : "text-brand-bright")}><MapPin size={14} /> {m.text || "Shared location"} · Open in Maps</a>
    </div>;
  }
  if (m.type === "address") return <div className="flex gap-2 text-[14px]"><Home size={16} className="mt-0.5 shrink-0" /><div><div className="text-[11px] font-bold uppercase tracking-wider opacity-75">Address</div><div className="whitespace-pre-line">{m.text}</div>
    <a className={cn("mt-1 inline-block text-[12px] font-semibold underline", mine ? "text-white" : "text-brand-bright")} target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/${encodeURIComponent(m.text)}`}>Open in Maps</a></div></div>;
  if (m.type === "payment") {
    const st = reg ? effectiveStatus(reg) : null;
    return <div className="w-72 max-w-full space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-80"><CreditCard size={14} /> Payment details</div>
      <div className="text-[14px]"><strong>{m.teamName}</strong> · ₹{m.amount}</div>
      <div className="text-[13px]">UTR / Txn ID: <span className="font-mono">{m.utr}</span></div>
      {m.text && <div className="text-[13px] opacity-90">{m.text}</div>}
      {m.proofUrl && <a href={m.proofUrl} target="_blank" rel="noreferrer"><img src={cdn(m.proofUrl, 500)} alt="Payment screenshot" className="max-h-56 w-full rounded-lg object-cover" /></a>}
      {staff && reg && <div className="flex flex-wrap items-center gap-2 pt-1">
        {st === REG_STATUS.pending ? <>
          <Button size="sm" variant="success" onClick={() => onDecide(reg, REG_STATUS.confirmed)}><Check /> Confirm & tag</Button>
          <Button size="sm" variant="danger" onClick={() => onDecide(reg, REG_STATUS.rejected)}><X /> Reject</Button>
        </> : <Badge variant={STATUS_BADGE[st]?.[0]}>{STATUS_BADGE[st]?.[1]}{reg.decidedBy ? ` · ${reg.decidedBy.name}` : ""}</Badge>}
      </div>}
    </div>;
  }
  return <div className="whitespace-pre-wrap break-words text-[14px] leading-snug">{highlight(m.text, m.mentions)}</div>;
}

function TeamList({ regs, now, onDecide, ev }) {
  const [f, setF] = useState("all");
  const rows = regs.filter((r) => f === "all" || effectiveStatus(r) === f).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  return <div className="p-3">
    <div className="mb-3 flex flex-wrap gap-1">{[["all", "All"], ["pending_payment", "Pending"], ["confirmed", "Confirmed"], ["expired", "Dropped"]].map(([k, l]) =>
      <button key={k} onClick={() => setF(k)} className={cn("rounded-full px-3 py-1 text-[12px] font-semibold", f === k ? "brand-gradient text-white" : "bg-surface-2 text-muted")}>{l}</button>)}</div>
    <Link to={`/dashboard/registrations/${ev.slug}`} className="mb-3 block text-[12px] font-semibold text-brand-bright">Open full registrations table →</Link>
    <div className="space-y-2">{rows.map((r) => {
      const st = effectiveStatus(r);
      return <div key={r.id} className="rounded-xl border border-line p-3">
        <div className="flex items-center gap-2"><Avatar src={r.leader?.photoUrl} name={r.teamName} size={34} /><div className="min-w-0 flex-1"><div className="truncate text-[14px] font-bold">{r.teamName}</div><div className="truncate text-[11px] text-muted">{r.leader?.name} · {r.headcount} ppl · {r.mode}</div></div><Badge variant={STATUS_BADGE[st]?.[0]}>{STATUS_BADGE[st]?.[1]}</Badge></div>
        {st === REG_STATUS.pending && <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-warn"><Clock size={12} />{countdown(r.expiresAt - now)}{r.payment ? " · paid?" : ""}</span>
          <Button size="sm" variant="success" className="h-7 px-2" onClick={() => onDecide(r, REG_STATUS.confirmed)}><Check /> Confirm</Button>
        </div>}
      </div>;
    })}{!rows.length && <p className="p-3 text-sm text-muted">No teams here.</p>}</div>
  </div>;
}

function EventInfo({ ev }) {
  return <div className="space-y-4 p-4 text-sm">
    {ev.bannerUrl && <img src={cdn(ev.bannerUrl, 700)} alt="" className="aspect-video w-full rounded-xl object-cover" />}
    <div><div className="font-display text-lg font-extrabold">{ev.name}</div><div className="text-muted">{fmtDate(ev.startAt)} · {fmtTime(ev.startAt)} · {ev.location}</div></div>
    {ev.price > 0 && <PayBox ev={ev} />}
    {ev.rules && <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">Rules</div><ul className="list-disc space-y-1 pl-4 text-muted">{ev.rules.split("\n").filter(Boolean).map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
  </div>;
}

export function PayBox({ ev }) {
  return <div className="rounded-2xl border border-line bg-surface-2 p-4 text-center">
    <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Scan to pay ₹{ev.price}</div>
    {ev.paymentQrUrl ? <img src={cdn(ev.paymentQrUrl, 500)} alt="Payment QR" className="mx-auto mt-2 w-48 rounded-xl bg-white p-2" /> : <div className="mt-2 text-muted">QR not uploaded yet</div>}
    {ev.upiId && <div className="mt-2 font-mono text-[13px]">{ev.upiId}</div>}
  </div>;
}

function AddressDialog({ open, onOpenChange, onSend, defaultValue }) {
  const [v, setV] = useState(defaultValue || "");
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogTitle>Send address</DialogTitle><DialogDescription>Teams can open it straight in Google Maps.</DialogDescription>
    <Textarea className="mt-4" rows={4} value={v} onChange={(e) => setV(e.target.value)} placeholder="Amriteshwari Hall, Amrita Vishwa Vidyapeetham, Kasavanahalli, Bengaluru" />
    <div className="mt-4 flex justify-end"><Button onClick={async () => { if (!v.trim()) return; await onSend(v.trim()); onOpenChange(false); }}><Send /> Send</Button></div>
  </DialogContent></Dialog>;
}

function PaymentDialog({ open, onOpenChange, ev, reg, sender }) {
  const [utr, setUtr] = useState(""); const [proof, setProof] = useState(""); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  async function submit() {
    if (utr.trim().length < 6) return toast.error("Enter the UPI reference / transaction ID.");
    setBusy(true);
    try { await submitPayment(ev.slug, sender, reg, { utr, proofUrl: proof, note }); toast.success("Sent! Organisers will tag you once verified."); onOpenChange(false); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogTitle>Pay & send details</DialogTitle>
    <DialogDescription>Pay ₹{ev.price} using the QR, then send your team name and transaction ID. Verify within 5 hours or the team is dropped automatically.</DialogDescription>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <PayBox ev={ev} />
      <div className="space-y-3">
        <Field label="Team name"><Input value={reg.teamName} disabled /></Field>
        <Field label="UPI ref / Transaction ID" required><Input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="12-digit UTR" /></Field>
        <Field label="Screenshot (recommended)"><ImageInput value={proof} onChange={setProof} kind="proof" label="Upload screenshot" aspect="aspect-[4/3]" /></Field>
        <Field label="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </div>
    <div className="mt-5 flex justify-end"><Button onClick={submit} disabled={busy}>{busy ? <Spinner className="text-white" /> : <ImageIcon />} Send payment details</Button></div>
  </DialogContent></Dialog>;
}
