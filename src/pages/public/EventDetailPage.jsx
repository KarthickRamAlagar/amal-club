import { Link, useParams } from "react-router-dom";
import {
  ArrowRight, CalendarDays, Clock3, MapPin, Users, Trophy, IndianRupee, ScrollText, MessagesSquare,
  LayoutDashboard, QrCode, TimerOff, Handshake,
} from "lucide-react";
import { doc } from "firebase/firestore";
import { Eyebrow, ImageCard, PageLoader, EmptyState } from "@/components/common/Primitives";
import { PredictionCards } from "@/components/events/PredictionCards";
import { EventMediaSection } from "@/components/events/EventMediaSection";
import { Badge } from "@/components/ui/badge";
import { useEvent } from "@/hooks/useData";
import { useDocData, useNow } from "@/hooks/useFirestore";
import { useAuth } from "@/context/AuthContext";
import { registrationState, eventPhase } from "@/services/events";
import { regId, effectiveStatus } from "@/services/registrations";
import { db } from "@/lib/firebase";
import { countdown, fmtDate, fmtDateTime, fmtTime } from "@/lib/utils";
import { cdn } from "@/lib/image";

const STATUS_COPY = {
  pending_payment: ["warn", "Payment pending — send details in the chat"],
  confirmed: ["ok", "Confirmed — you're in!"],
  expired: ["muted", "Dropped — payment wasn't verified within 5 hours"],
  rejected: ["default", "Registration rejected"],
};

export default function EventDetailPage() {
  const { slug } = useParams();
  const { data: ev, loading } = useEvent(slug);
  const { user, staff, ready } = useAuth();
  const now = useNow(30000);
  const { data: myReg } = useDocData(() => (user && slug ? doc(db, "registrations", regId(slug, user.uid)) : null), [user?.uid, slug]);

  if (loading) return <PageLoader />;
  if (!ev) return <div className="section"><EmptyState title="Event not found" action={<Link className="button button-primary" to="/events">All events</Link>}>This link may be old or the event was removed.</EmptyState></div>;

  const rs = registrationState(ev, now);
  const phase = eventPhase(ev, now);
  const rules = (ev.rules || "").split("\n").map((r) => r.trim()).filter(Boolean);
  const status = myReg ? effectiveStatus(myReg) : null;

  return <>
    <section className="event-detail-top">
      <ImageCard src={ev.bannerUrl} alt={ev.name} w={1600} />
      <div className="event-detail-heading">
        <Link className="back-link" to="/events">← All events</Link>
        <span className="category">{phase === "past" ? "PAST EVENT" : rs.label.toUpperCase()}</span>
        <h1>{ev.name}</h1>
        <p>{ev.shortDesc}</p>
        <div className="event-meta large">
          <span><CalendarDays size={17} />{fmtDate(ev.startAt)}</span>
          <span><Clock3 size={17} />{fmtTime(ev.startAt) || "Time TBA"}</span>
          <span><MapPin size={17} />{ev.location || "Campus"}</span>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          <div>
            <Eyebrow>ABOUT THE EVENT</Eyebrow>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-muted">{ev.fullDesc || ev.shortDesc}</p>
          </div>
          {rules.length > 0 && <div>
            <Eyebrow>RULES &amp; REGULATIONS</Eyebrow>
            <ol className="mt-3 space-y-2">{rules.map((r, i) => <li key={i} className="flex gap-3 rounded-xl border border-line bg-surface p-3 text-sm"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full brand-gradient text-[11px] font-bold text-white">{i + 1}</span>{r}</li>)}</ol>
          </div>}
          {ev.sponsors?.length > 0 && <div>
            <Eyebrow>SPONSORED BY</Eyebrow>
            <div className="mt-3 flex flex-wrap gap-3">{ev.sponsors.map((s) => <div key={s.name} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
              {s.logoUrl ? <img src={cdn(s.logoUrl, 120)} alt="" className="h-9 w-9 rounded-lg bg-white object-contain p-1" /> : <Handshake size={20} className="text-brand-bright" />}
              <span className="font-semibold">{s.name}</span></div>)}</div>
          </div>}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="glass rounded-2xl p-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info icon={IndianRupee} label="Entry fee" value={ev.price ? `₹${ev.price} / team` : "Free"} />
              <Info icon={Users} label="Team size" value={ev.teamMin === ev.teamMax ? `${ev.teamMax}` : `${ev.teamMin}–${ev.teamMax}`} />
              <Info icon={ScrollText} label="Online seats left" value={`${rs.onlineLeft ?? 0} / ${ev.onlineIntake || 0}`} />
              <Info icon={QrCode} label="On-spot seats" value={`${rs.onspotLeft ?? 0} / ${ev.onspotIntake || 0}`} />
              {ev.prizes && <div className="col-span-2"><Info icon={Trophy} label="Prizes" value={ev.prizes} /></div>}
            </div>

            <div className="mt-5 border-t border-line pt-5">
              {status ? <div className="space-y-3">
                <Badge variant={STATUS_COPY[status]?.[0]}>{STATUS_COPY[status]?.[1]}</Badge>
                <p className="text-sm text-muted">Team <strong className="text-fg">{myReg.teamName}</strong> · {myReg.mode === "onspot" ? "On-spot" : "Online"}</p>
                {status !== "expired" && status !== "rejected" && <Link className="button button-primary w-full" to={`/events/${ev.slug}/chat`}><MessagesSquare size={16} /> Open event chat</Link>}
              </div>
                : rs.state === "open" ? <div className="space-y-3">
                  <p className="text-sm text-muted">Online registration closes <strong className="text-fg">{fmtDateTime(rs.closes)}</strong> · {countdown(rs.closes - now)} left</p>
                  <Link className="button button-primary w-full !h-12 text-[14px]" to={`/events/${ev.slug}/register`}>CLICK TO REGISTER THE EVENT <ArrowRight size={16} /></Link>
                </div>
                  : rs.state === "full" ? <OnspotCard ev={ev} title="Online seats are full" />
                    : rs.state === "onspot" ? <OnspotCard ev={ev} title="Online registration has closed" />
                      : <div className="flex items-center gap-2 text-sm text-muted"><TimerOff size={16} /> This event is over. Thanks to everyone who joined!</div>}
            </div>
          </div>
          {ready && <Link className="button button-secondary w-full" to={`/dashboard/events/${ev.slug}`}><LayoutDashboard size={16} /> Manage in dashboard</Link>}
        </aside>
      </div>
    </section>

    <EventMediaSection ev={ev} />
    {staff && phase !== "past" && <section className="section section-tint"><PredictionCards event={ev} canRun={staff} /></section>}
  </>;
}

function Info({ icon: Icon, label, value }) {
  return <div className="rounded-xl bg-surface-2 p-3"><div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted"><Icon size={13} className="text-brand-bright" />{label}</div><div className="mt-1 font-display font-extrabold">{value}</div></div>;
}

function OnspotCard({ ev, title }) {
  return <div className="rounded-2xl border border-[color-mix(in_oklab,var(--gold)_45%,transparent)] bg-[color-mix(in_oklab,var(--gold)_10%,transparent)] p-4">
    <div className="flex items-center gap-2 font-display font-extrabold text-gold"><QrCode size={18} /> {title}</div>
    <p className="mt-2 text-sm text-muted">You're requested to register <strong className="text-fg">on spot</strong> at the venue. Scan the AMAL QR at the desk — it opens the event chat where you send your team details and pay.</p>
    <Link className="button button-secondary mt-3 w-full" to={`/events/${ev.slug}/chat?onspot=1`}>I'm at the venue — register on spot</Link>
  </div>;
}
