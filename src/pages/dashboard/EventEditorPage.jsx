import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Save, Lock } from "lucide-react";
import { toast } from "sonner";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/input";
import { ImageInput } from "@/components/common/ImageInput";
import { ActorCard } from "@/components/common/ActorCard";
import { BannerPicker, SponsorRow } from "@/components/events/BannerPicker";
import { Spinner, PageLoader, EmptyState } from "@/components/common/Primitives";
import { useAuth } from "@/context/AuthContext";
import { useEvent } from "@/hooks/useData";
import { createEvent, updateEvent } from "@/services/events";
import { canCreateEvent, canEditEvent } from "@/lib/permissions";
import { errMsg, registrationClosesAt, fmtDateTime } from "@/lib/utils";

const toLocalInput = (ms) => { if (!ms) return ""; const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const EMPTY = { name: "", shortDesc: "", fullDesc: "", rules: "", location: "", startAt: "", endAt: "", price: 0, onlineIntake: 40, onspotIntake: 10, teamMin: 1, teamMax: 4, sponsors: [], prizes: "", upiId: "", paymentQrUrl: "", bannerUrl: "", bannerSource: "upload", bannerCredit: "" };

export default function EventEditorPage() {
  const { slug } = useParams(); const nav = useNavigate();
  const { member: me } = useAuth();
  const { data: ev, loading } = useEvent(slug);
  const [f, setF] = useState(EMPTY); const [busy, setBusy] = useState(false);
  useEffect(() => { if (ev) setF({ ...EMPTY, ...ev, startAt: toLocalInput(ev.startAt), endAt: toLocalInput(ev.endAt), sponsors: ev.sponsors || [] }); }, [ev?.slug]); // eslint-disable-line

  if (slug && loading) return <PageLoader />;
  if (!canCreateEvent(me)) return <EmptyState icon={Lock} title="Only the Admin and Club Representatives create events">Team leads can still disable events and manage registrations.</EmptyState>;
  if (slug && ev && !canEditEvent(me, ev)) return <div className="max-w-xl"><EmptyState icon={Lock} title="This event is locked to a senior role">Once a senior creates an event, only equal or higher ranks can edit it.</EmptyState><ActorCard className="mt-4" actor={ev.createdBy} label="Created by" at={ev.createdAt} /></div>;

  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    if (!f.startAt) return toast.error("Set the event date & time.");
    if (!f.bannerUrl) return toast.error("Add an event banner.");
    if (f.price > 0 && !f.paymentQrUrl) return toast.error("Paid events need a payment QR.");
    setBusy(true);
    try {
      const payload = { ...f, startAt: new Date(f.startAt).getTime(), endAt: f.endAt ? new Date(f.endAt).getTime() : null };
      if (ev) { await updateEvent(me, ev, payload); toast.success("Event updated."); nav(`/dashboard/events/${ev.slug}`); }
      else { const id = await createEvent(me, payload); toast.success("Event created and logged."); nav(`/dashboard/events/${id}`); }
    } catch (er) { toast.error(errMsg(er)); } finally { setBusy(false); }
  }
  const closes = f.startAt ? registrationClosesAt(new Date(f.startAt).getTime()) : 0;

  return <form onSubmit={save} className="mx-auto max-w-6xl">
    <DashHeader eyebrow="EVENT REGISTRATION" title={ev ? `Edit ${ev.name}` : "Create an upcoming event."} subtitle="Everything here feeds the event page, the poster studio and the registration form." action={<Link to="/dashboard/events" className="text-sm font-semibold text-muted">← Events</Link>} />
    <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
      <div className="space-y-5">
        <Card><CardHeader><CardTitle>Basics</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Event name" required className="sm:col-span-2"><Input value={f.name} onChange={s("name")} required maxLength={80} placeholder="Mock Parliament '26" /></Field>
          <Field label="Short description" required className="sm:col-span-2" hint={`${f.shortDesc.length}/160 · shown on cards & posters`}><Input value={f.shortDesc} onChange={s("shortDesc")} required maxLength={160} /></Field>
          <Field label="Full description" required className="sm:col-span-2"><Textarea value={f.fullDesc} onChange={s("fullDesc")} rows={6} required /></Field>
          <Field label="Starts" required><Input type="datetime-local" value={f.startAt} onChange={s("startAt")} required /></Field>
          <Field label="Ends (optional)"><Input type="datetime-local" value={f.endAt || ""} onChange={s("endAt")} /></Field>
          <Field label="Location / venue" required className="sm:col-span-2"><Input value={f.location} onChange={s("location")} required placeholder="Amriteshwari Hall" /></Field>
          {closes > 0 && <p className="rounded-lg bg-surface-2 p-3 text-[12px] text-muted sm:col-span-2">Online registration will open now and close at <strong className="text-fg">{fmtDateTime(closes)}</strong> (11:50 PM the night before). After that the page shows the on-spot registration card.</p>}
        </CardContent></Card>
        <Card><CardHeader><div><CardTitle>Rules &amp; regulations</CardTitle><CardDescription>One rule per line — prefilled into posters.</CardDescription></div></CardHeader><CardContent>
          <Textarea value={f.rules} onChange={s("rules")} rows={6} placeholder={"Teams of 2–4\nFormal attire is mandatory\nBills must be submitted by 9 AM"} />
        </CardContent></Card>
        <Card><CardHeader><div><CardTitle>Sponsors</CardTitle><CardDescription>Logo from upload or Unsplash.</CardDescription></div><Button type="button" size="sm" variant="secondary" onClick={() => setF({ ...f, sponsors: [...f.sponsors, { name: "", logoUrl: "" }] })}><Plus /> Add sponsor</Button></CardHeader>
          <CardContent className="space-y-3">{f.sponsors.map((sp, i) => <SponsorRow key={i} s={sp} onChange={(v) => setF({ ...f, sponsors: f.sponsors.map((x, k) => (k === i ? v : x)) })} onRemove={() => setF({ ...f, sponsors: f.sponsors.filter((_, k) => k !== i) })} />)}
            {!f.sponsors.length && <p className="text-sm text-muted">No sponsors added.</p>}</CardContent></Card>
      </div>
      <div className="space-y-5">
        <Card><CardHeader><CardTitle>Event banner</CardTitle></CardHeader><CardContent>
          <BannerPicker value={f.bannerUrl} eventName={f.name} description={f.shortDesc} onChange={({ url, source, credit }) => setF({ ...f, bannerUrl: url, bannerSource: source, bannerCredit: credit })} />
          {f.bannerCredit && <p className="mt-2 text-[11px] text-muted">Credit: {f.bannerCredit}</p>}
        </CardContent></Card>
        <Card><CardHeader><div><CardTitle>Intake &amp; teams</CardTitle><CardDescription>Shown on the event page and posters.</CardDescription></div></CardHeader><CardContent className="grid grid-cols-2 gap-3">
          <Field label="Online intake (teams)" required><Input type="number" min={0} value={f.onlineIntake} onChange={s("onlineIntake")} /></Field>
          <Field label="On-spot intake (teams)" required><Input type="number" min={0} value={f.onspotIntake} onChange={s("onspotIntake")} /></Field>
          <Field label="Min team size"><Input type="number" min={1} value={f.teamMin} onChange={s("teamMin")} /></Field>
          <Field label="Max team size"><Input type="number" min={1} value={f.teamMax} onChange={s("teamMax")} /></Field>
          <Field label="Prizes" className="col-span-2"><Input value={f.prizes} onChange={s("prizes")} placeholder="₹12,000 prize pool" /></Field>
        </CardContent></Card>
        <Card><CardHeader><div><CardTitle>Price &amp; payment</CardTitle><CardDescription>Teams pay via this QR and send details in the chat.</CardDescription></div></CardHeader><CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><Field label="Price per team (₹)"><Input type="number" min={0} value={f.price} onChange={s("price")} /></Field><Field label="UPI ID"><Input value={f.upiId} onChange={s("upiId")} placeholder="amalclub@upi" /></Field></div>
          <Field label="Payment QR code"><ImageInput value={f.paymentQrUrl} onChange={(u) => setF({ ...f, paymentQrUrl: u })} kind="logo" label="Upload payment QR" aspect="aspect-square" className="w-44" /></Field>
        </CardContent></Card>
        {ev?.createdBy && <ActorCard actor={ev.createdBy} label="Created by" at={ev.createdAt} />}
      </div>
    </div>
    <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t border-line bg-[var(--bg)]/90 py-4 backdrop-blur"><Button type="submit" size="lg" disabled={busy}>{busy ? <Spinner className="text-white" /> : <Save />} {ev ? "Save changes" : "Create event"}</Button></div>
  </form>;
}
