import { Armchair, Award, Coffee, Cookie, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/common/Primitives";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/utils";

function Card({ icon: Icon, title, children, accent }) {
  return <div className="glass rounded-2xl p-5">
    <div className="flex items-center gap-2"><span className={`grid h-9 w-9 place-items-center rounded-xl ${accent || "brand-gradient"} text-white`}><Icon size={18} /></span><h4 className="font-display text-[15px] font-extrabold">{title}</h4></div>
    <div className="mt-3 text-sm">{children}</div>
  </div>;
}
const Items = ({ items = [] }) => <ul className="space-y-1.5">{items.map((i, k) => <li key={k} className="flex justify-between gap-3 border-b border-line pb-1.5 last:border-0"><span className="text-muted">{i.item}</span><strong>{i.quantity}{i.unit ? ` ${i.unit}` : ""}</strong></li>)}</ul>;

/** AI planning cards: seating, snacks, beverages, certificates — shown on the event page for staff. */
export function PredictionCards({ event, canRun }) {
  const [busy, setBusy] = useState(false);
  const p = event.prediction;
  async function run() {
    setBusy(true);
    try { await api("ai/predict", { eventId: event.slug }); toast.success("Prediction updated."); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }
  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><div className="eyebrow"><span />AI PLANNING</div><h3 className="font-display text-2xl font-extrabold">Tomorrow, predicted.</h3>
        <p className="text-sm text-muted">{p ? `Based on ${p.inputs?.teams ?? 0} online teams (${p.inputs?.people ?? 0} people) + ${p.inputs?.onspotExpected ?? 0} expected on-spot · ${p.provider || "AI"} · ${fmtDateTime(p.generatedAt)}` : "Runs automatically after registration closes (12:05 AM on event day), or run it now."}</p></div>
      {canRun && <Button onClick={run} disabled={busy}>{busy ? <Spinner className="text-white" /> : <Sparkles />} {p ? "Re-run prediction" : "Predict now"}</Button>}
    </div>
    {p && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card icon={Users} title="Expected turnout" accent="bg-[#5b2bd1]"><div className="font-display text-4xl font-extrabold">{p.expectedAttendees}</div><p className="mt-1 text-muted">{p.summary}</p></Card>
      <Card icon={Armchair} title="Seating"><div className="font-display text-3xl font-extrabold">{p.seating?.totalSeats} seats</div><p className="mt-1 text-muted">{p.seating?.layout}</p>{p.seating?.notes && <p className="mt-2 text-[12px] text-muted">{p.seating.notes}</p>}</Card>
      <Card icon={Cookie} title="Snacks" accent="bg-[#c27a12]"><Items items={p.snacks} /></Card>
      <Card icon={Coffee} title="Beverages" accent="bg-[#0f7a68]"><Items items={p.beverages} /></Card>
      <Card icon={Award} title="Certificates" accent="bg-gold !text-[#2a0a12]"><Items items={p.certificates} /></Card>
      {p.tips?.length > 0 && <div className="glass rounded-2xl p-5 sm:col-span-2 xl:col-span-3"><h4 className="font-display font-extrabold">Notes for the team</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{p.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
    </div>}
  </div>;
}
