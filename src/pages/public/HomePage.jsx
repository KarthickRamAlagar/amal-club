import { Link } from "react-router-dom";
import { Activity, ArrowRight, GraduationCap, HeartHandshake, Network, Sparkles } from "lucide-react";
import { Eyebrow, ImageCard, SectionTitle } from "@/components/common/Primitives";
import { EventCard } from "@/components/events/EventCard";
import { ClubTree } from "@/components/members/ClubTree";
import { useActiveMembers, useEvents } from "@/hooks/useData";
import { eventPhase } from "@/services/events";
import { IMAGES } from "@/lib/constants";
import { firebaseReady } from "@/lib/firebase";
import { DEMO_TREE } from "@/lib/demo";

export default function HomePage() {
  const { data: events } = useEvents();
  const { data: members } = useActiveMembers();
  const upcoming = events.filter((e) => eventPhase(e) !== "past").slice(0, 3);
  const tree = firebaseReady ? members.filter((m) => m.role !== "member") : DEMO_TREE;
  return <>
    <section className="hero">
      <div className="hero-backdrop" style={{ backgroundImage: `linear-gradient(90deg, var(--hero-shade) 0%, rgba(30,5,13,.65) 48%, rgba(30,5,13,.12) 100%), url("${IMAGES.hero}")` }} />
      <div className="hero-content">
        <Eyebrow>AMRITA MANAGEMENT &amp; LEADERSHIP CLUB</Eyebrow>
        <h1>Empowering<br /><em>tomorrow's</em> leaders.</h1>
        <p>Leadership, management and communication — learned by doing, at Amrita Vishwa Vidyapeetham, Bengaluru.</p>
        <div className="hero-actions">
          <Link className="button button-primary" to="/events">Explore events <ArrowRight size={17} /></Link>
          <Link className="button button-glass" to="/teams">Meet our teams</Link>
        </div>
        <div className="hero-proof"><img src="/amal-logo.jpg" alt="" className="h-11 w-11 rounded-full bg-white" /><span><strong>One AMAL community</strong><small>Empowered at Amrita, inspired for life.</small></span></div>
      </div>
      <div className="hero-stamp"><Sparkles size={18} /><span>Lead.<br />Manage. Speak.</span></div>
    </section>
    <section className="stats-strip">
      <div><strong>05</strong><span>Teams</span></div>
      <div><strong>{members.length || "∞"}</strong><span>Active members</span></div>
      <div><strong>{events.length || "—"}</strong><span>Events hosted</span></div>
      <div><strong>ONE</strong><span>AMAL community</span></div>
    </section>
    <section className="section">
      <SectionTitle eyebrow="WHO WE ARE" title="A student-led forge for leaders." subtitle="We run workshops, competitions and simulations that build leadership, management and communication skills." action={<Link className="button button-text" to="/about">Our story <ArrowRight size={16} /></Link>} />
      <div className="feature-grid">
        <article className="feature-card feature-main"><ImageCard src={IMAGES.community} alt="Students collaborating" /><div><span className="feature-icon"><HeartHandshake /></span><h3>Belong to something bigger.</h3><p>Find your people, learn by doing, and make every contribution count.</p><Link className="button button-text" to="/about">Discover AMAL <ArrowRight size={15} /></Link></div></article>
        <article className="feature-card"><div className="feature-icon"><GraduationCap /></div><h3>Workshops that stick.</h3><p>Innovate X, Mastering the Mic and more — hands-on, not lecture-only.</p><Link className="inline-link" to="/events">See events <ArrowRight size={15} /></Link></article>
        <article className="feature-card"><div className="feature-icon"><Activity /></div><h3>Real-world rehearsals.</h3><p>Mock Parliament and management games that put you in the room where decisions happen.</p><Link className="inline-link" to="/teams">Find your team <ArrowRight size={15} /></Link></article>
      </div>
    </section>
    <section className="section section-tint">
      <SectionTitle eyebrow="THE CLUB TREE" title="The people who lead AMAL." subtitle="Faculty admin, Club Representatives and Team Leads. Tap anyone to see their card." action={<Link className="button button-secondary" to="/teams"><Network size={16} /> All teams</Link>} />
      {tree.length ? <ClubTree members={tree} /> : <p className="text-sm text-muted">The club tree appears once members finish onboarding.</p>}
    </section>
    <section className="section">
      <SectionTitle eyebrow="UP NEXT" title="Gather. Compete. Lead." subtitle="Current and upcoming AMAL events. Past events live in their own tab." action={<Link className="button button-secondary" to="/events">All events <ArrowRight size={16} /></Link>} />
      <div className="event-grid">{upcoming.map((e) => <EventCard key={e.slug} event={e} />)}</div>
      {!upcoming.length && <p className="text-sm text-muted">No upcoming events right now — check back soon.</p>}
    </section>
    <section className="cta-band"><div><Eyebrow>YOUR NEXT CHAPTER STARTS HERE</Eyebrow><h2>Bring your curiosity.<br /><em>We'll bring the stage.</em></h2></div><Link className="button button-primary" to="/events">Find an event <ArrowRight size={16} /></Link></section>
  </>;
}
