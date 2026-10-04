import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Clock3, MapPin, Users } from "lucide-react";
import { ImageCard } from "@/components/common/Primitives";
import { fmtDate, fmtTime } from "@/lib/utils";
import { registrationState } from "@/services/events";

export function EventCard({ event }) {
  const rs = registrationState(event);
  const to = `/events/${event.slug}`;
  return <article className="event-card fade-up">
    <Link className="event-image-button block" to={to} aria-label={`View ${event.name}`}>
      <ImageCard src={event.bannerUrl} alt={event.name} />
      <span className="date-pill"><CalendarDays size={13} />{fmtDate(event.startAt).toUpperCase()}</span>
    </Link>
    <div className="event-card-body">
      <span className="category">{rs.state === "closed" ? "PAST EVENT" : rs.label.toUpperCase()}</span>
      <h3>{event.name}</h3>
      <p>{event.shortDesc}</p>
      <div className="event-meta">
        <span><Clock3 size={14} />{fmtTime(event.startAt) || "Time TBA"}</span>
        <span><MapPin size={14} />{event.location || "Campus"}</span>
        {rs.state !== "closed" && <span><Users size={14} />{rs.onlineLeft ?? 0} seats left</span>}
      </div>
      <Link className="inline-link" to={to}>Event details <ArrowRight size={15} /></Link>
    </div>
  </article>;
}
