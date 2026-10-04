import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { ImageCard, PageShell } from "@/components/common/Primitives";
import { IMAGES } from "@/lib/constants";

export default function AboutPage() {
  return <PageShell eyebrow="THE AMAL WAY" title="Empowering leaders, inspiring change." subtitle="A dynamic student-led organization at Amrita Vishwa Vidyapeetham, Bengaluru." image={IMAGES.community}>
    <div className="about-layout">
      <div>
        <h2>A place to lead, not just participate.</h2>
        <p>The Amrita Management and Leadership (AMAL) Club fosters leadership, management and communication skills among students through interactive workshops, engaging competitions and real-world simulations.</p>
        <p>We aim to empower students to unlock their full potential in personal and professional spheres — whether you plan an event, build a tool, design a campaign or take the mic.</p>
        <Link className="button button-primary" to="/teams">Explore our teams <ArrowRight size={16} /></Link>
      </div>
      <ImageCard src={IMAGES.stage} alt="AMAL event on stage" className="about-image" />
    </div>
    <div className="values-grid">{[["Leadership", "Step up, take ownership, bring people with you."], ["Management", "Plan, organise and deliver — on time."], ["Communication", "Speak with confidence, persuade with power."], ["Community", "Leave people and places better."]].map(([t, d]) => <article className="value-card" key={t}><span className="feature-icon"><Sparkles /></span><h3>{t}</h3><p>{d}</p></article>)}</div>
  </PageShell>;
}
