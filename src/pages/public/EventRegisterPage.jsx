import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { doc } from "firebase/firestore";
import { ShieldCheck, Timer, Wallet } from "lucide-react";
import { Eyebrow, PageLoader, EmptyState } from "@/components/common/Primitives";
import { RegistrationForm } from "@/components/events/RegistrationForm";
import { SignInCard } from "@/components/events/GoogleGate";
import { useEvent } from "@/hooks/useData";
import { useDocData } from "@/hooks/useFirestore";
import { useAuth } from "@/context/AuthContext";
import { registrationState } from "@/services/events";
import { regId } from "@/services/registrations";
import { db } from "@/lib/firebase";
import { fmtDateTime } from "@/lib/utils";

export default function EventRegisterPage() {
  const { slug } = useParams(); const nav = useNavigate();
  const { data: ev, loading } = useEvent(slug);
  const { user, loading: authLoading } = useAuth();
  const { data: existing, loading: regLoading } = useDocData(() => (user && slug ? doc(db, "registrations", regId(slug, user.uid)) : null), [user?.uid, slug]);
  if (loading || authLoading || (user && regLoading)) return <PageLoader />;
  if (!ev) return <div className="section"><EmptyState title="Event not found" /></div>;
  if (existing) return <Navigate to={`/events/${slug}/chat`} replace />;
  const rs = registrationState(ev);
  return <section className="section registration-section">
    <div className="registration-copy">
      <Link className="back-link" to={`/events/${slug}`}>← {ev.name}</Link>
      <Eyebrow>BE PART OF IT</Eyebrow><h2>Save your team's spot.</h2>
      <p>Register your team, then pay using the event QR and send the payment details in the event chat.</p>
      <div className="mt-5 space-y-3">
        <div className="notice-card"><Timer /><div><strong>Online registration closes {fmtDateTime(rs.closes)}</strong><span>After that, you can register on spot at the venue.</span></div></div>
        {ev.price > 0 && <div className="notice-card"><Wallet /><div><strong>Pay ₹{ev.price} within 5 hours</strong><span>Unverified teams are dropped automatically after 5 hours.</span></div></div>}
        <div className="notice-card"><ShieldCheck /><div><strong>Only AMAL organisers see your details</strong><span>Used to coordinate this event.</span></div></div>
      </div>
    </div>
    <div className="form-card registration-form">
      {!user ? <SignInCard title="Sign in to register" />
        : rs.state !== "open" ? <EmptyState title={rs.state === "full" ? "Online seats are full" : "Online registration is closed"} action={<Link className="button button-primary" to={`/events/${slug}`}>Back to event</Link>}>You can still register on spot at the venue if seats remain.</EmptyState>
          : <RegistrationForm ev={ev} user={user} onDone={() => nav(`/events/${slug}/chat`)} />}
    </div>
  </section>;
}
