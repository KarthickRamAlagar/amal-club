import { Select } from "@/components/ui/input";
import { eventPhase } from "@/services/events";
import { fmtDate, toMillis } from "@/lib/utils";

/** Upcoming / live events first, then past ones (newest first). */
export function sortEventsForPicker(events) {
  const live = events.filter((e) => eventPhase(e) !== "past").sort((a, b) => toMillis(a.startAt) - toMillis(b.startAt));
  const past = events.filter((e) => eventPhase(e) === "past").sort((a, b) => toMillis(b.startAt) - toMillis(a.startAt));
  return { live, past };
}

export function EventSelect({ events, value, onChange, placeholder = "Choose an event…", className }) {
  const { live, past } = sortEventsForPicker(events);
  return <Select value={value || ""} onChange={(e) => onChange(e.target.value)} className={className}>
    <option value="">{placeholder}</option>
    {live.length > 0 && <optgroup label="Upcoming & live">{live.map((e) => <option key={e.slug} value={e.slug}>{e.name} · {fmtDate(e.startAt)}</option>)}</optgroup>}
    {past.length > 0 && <optgroup label="Past">{past.map((e) => <option key={e.slug} value={e.slug}>{e.name} · {fmtDate(e.startAt)}</option>)}</optgroup>}
  </Select>;
}
