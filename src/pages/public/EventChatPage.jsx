import { Link, useParams, useSearchParams } from "react-router-dom";
import { doc } from "firebase/firestore";
import { QrCode } from "lucide-react";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { RegistrationForm } from "@/components/events/RegistrationForm";
import { SignInCard } from "@/components/events/GoogleGate";
import { PageLoader, EmptyState } from "@/components/common/Primitives";
import { useEvent } from "@/hooks/useData";
import { useDocData } from "@/hooks/useFirestore";
import { useAuth } from "@/context/AuthContext";
import { senderOf } from "@/services/chat";
import { regId } from "@/services/registrations";
import { registrationState } from "@/services/events";
import { db } from "@/lib/firebase";

export default function EventChatPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const onspot = params.get("onspot") === "1";
  const { data: ev, loading } = useEvent(slug);
  const { user, member, staff, loading: authLoading } = useAuth();
  const { data: myReg, loading: regLoading } = useDocData(() => (user && slug && !staff ? doc(db, "registrations", regId(slug, user.uid)) : null), [user?.uid, slug, staff]);

  if (loading || authLoading || (user && !staff && regLoading)) return <PageLoader label="Opening chat…" />;
  if (!ev) return <div className="section"><EmptyState title="Event not found" /></div>;
  if (!user) return <div className="section"><SignInCard title={onspot ? "Register on spot" : "Sign in to open the event chat"}>{onspot ? "Sign in with Google, send your team details and pay — all in one place." : undefined}</SignInCard></div>;

  if (staff) return <ChatRoom ev={ev} me={member} sender={senderOf(member, user)} staff />;
  if (myReg) return <ChatRoom ev={ev} me={null} sender={{ ...senderOf(null, user), teamName: myReg.teamName }} myReg={myReg} />;

  const rs = registrationState(ev);
  const onspotOpen = rs.state === "onspot" || rs.state === "full";
  if (onspot && onspotOpen && (rs.onspotLeft ?? 0) > 0) return <section className="section">
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3"><img src="/amal-logo.jpg" alt="" className="h-12 w-12 rounded-full bg-white" /><div><div className="eyebrow"><span />ON-SPOT REGISTRATION</div><h1 className="font-display text-2xl font-extrabold">{ev.name}</h1><p className="text-sm text-muted">{rs.onspotLeft} on-spot seats left. Fill this in, then pay in the chat.</p></div></div>
      <div className="form-card"><RegistrationForm ev={ev} user={user} mode="onspot" /></div>
    </div>
  </section>;

  return <div className="section"><EmptyState icon={QrCode} title={onspot ? "On-spot registration isn't open" : "Register to join the chat"}
    action={<Link className="button button-primary" to={`/events/${slug}`}>Go to event</Link>}>
    {onspot ? (rs.state === "open" ? "Online registration is still open — register from the event page." : "On-spot seats are full or the event has ended.") : "The event chat opens once your team is registered."}
  </EmptyState></div>;
}
