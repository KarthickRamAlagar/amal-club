import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc } from "firebase/firestore";
import { CheckCircle2, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormRenderer, validateAnswers } from "@/components/forms/FormRenderer";
import { PageLoader, EmptyState, Spinner } from "@/components/common/Primitives";
import { useDocData } from "@/hooks/useFirestore";
import { useEvent } from "@/hooks/useData";
import { useAuth } from "@/context/AuthContext";
import { submitFormResponse } from "@/services/forms";
import { eventPhase } from "@/services/events";
import { db } from "@/lib/firebase";
import { errMsg } from "@/lib/utils";
import { cdn } from "@/lib/image";

export default function PublicFormPage() {
  const { formId } = useParams(); const { user } = useAuth();
  const { data: form, loading } = useDocData(() => doc(db, "forms", formId), [formId]);
  const { data: ev } = useEvent(form?.eventId);
  const [vals, setVals] = useState({}); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  if (loading) return <PageLoader />;
  if (!form) return <div className="section"><EmptyState title="Form not found" /></div>;
  const closed = form.status !== "in_use" || (ev && eventPhase(ev) === "past");
  async function submit(e) {
    e.preventDefault(); const er = validateAnswers(form.fields, vals); if (er) return toast.error(er);
    setBusy(true); try { await submitFormResponse(form, vals, user?.uid || null); setDone(true); } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); }
  }
  return <section className="section"><div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface">
    <div className="relative h-44 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(180deg,transparent,rgba(16,9,13,.9)),url("${cdn(ev?.bannerUrl, 1200) || ""}")` }}>
      <img src="/amal-logo.jpg" alt="AMAL" className="absolute left-5 top-5 h-12 w-12 rounded-full bg-white" />
      <div className="absolute bottom-4 left-5 right-5 text-white"><div className="text-[11px] font-bold uppercase tracking-[1.6px] opacity-80">{form.eventName}</div><h1 className="font-display text-2xl font-extrabold">{form.title}</h1></div>
    </div>
    <div className="p-6">
      {closed ? <EmptyState icon={Lock} title="This form is closed">The event is completed, so this form no longer accepts responses.{ev && <><br /><Link className="text-brand-bright" to={`/events/${ev.slug}`}>View event</Link></>}</EmptyState>
        : done ? <EmptyState icon={CheckCircle2} title="Response recorded">Thank you! The AMAL team has your answers.</EmptyState>
          : <form onSubmit={submit} className="space-y-5">{form.description && <p className="text-sm text-muted">{form.description}</p>}<FormRenderer fields={form.fields} values={vals} onChange={setVals} />
            <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? <Spinner className="text-white" /> : <Send />} Submit</Button></form>}
    </div>
  </div></section>;
}
