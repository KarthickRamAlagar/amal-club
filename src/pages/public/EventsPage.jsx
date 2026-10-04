import { CalendarClock, History } from "lucide-react";
import { PageShell, PageLoader, EmptyState } from "@/components/common/Primitives";
import { EventCard } from "@/components/events/EventCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEvents } from "@/hooks/useData";
import { eventPhase } from "@/services/events";
import { IMAGES } from "@/lib/constants";
import { toMillis } from "@/lib/utils";

export default function EventsPage() {
  const { data: events, loading } = useEvents();
  const current = events.filter((e) => eventPhase(e) !== "past");
  const past = events.filter((e) => eventPhase(e) === "past").sort((a, b) => toMillis(b.startAt) - toMillis(a.startAt));
  return <PageShell eyebrow="MARK YOUR CALENDAR" title="Make time for good things." subtitle="Workshops, competitions and simulations that bring the AMAL community closer." image={IMAGES.stage}>
    {loading ? <PageLoader /> : <Tabs defaultValue="current">
      <TabsList><TabsTrigger value="current"><CalendarClock size={14} className="mr-1 inline" /> Current &amp; upcoming ({current.length})</TabsTrigger><TabsTrigger value="past"><History size={14} className="mr-1 inline" /> Past events ({past.length})</TabsTrigger></TabsList>
      <TabsContent value="current">{current.length ? <div className="event-grid">{current.map((e) => <EventCard key={e.slug} event={e} />)}</div> : <EmptyState icon={CalendarClock} title="Nothing scheduled yet">New events appear here as soon as they're announced.</EmptyState>}</TabsContent>
      <TabsContent value="past">{past.length ? <div className="event-grid">{past.map((e) => <EventCard key={e.slug} event={e} />)}</div> : <EmptyState icon={History} title="No past events yet" />}</TabsContent>
    </Tabs>}
  </PageShell>;
}
