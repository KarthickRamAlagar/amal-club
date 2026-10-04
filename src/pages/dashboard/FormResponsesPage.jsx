import { useParams, Link } from "react-router-dom";
import { collection, doc, query, where } from "firebase/firestore";
import { Download } from "lucide-react";
import { DashHeader } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableWrap, Table, Th, Td } from "@/components/ui/table";
import { PageLoader, EmptyState } from "@/components/common/Primitives";
import { ActorCard } from "@/components/common/ActorCard";
import { QRCard } from "@/components/common/QRCard";
import { useDocData, useQueryData } from "@/hooks/useFirestore";
import { SITE_URL } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { downloadText, fmtDateTime, toCSV, toMillis } from "@/lib/utils";

export default function FormResponsesPage() {
  const { formId } = useParams();
  const { data: form, loading } = useDocData(() => doc(db, "forms", formId), [formId]);
  const { data: rows } = useQueryData(() => query(collection(db, "formResponses"), where("formId", "==", formId)), [formId], { map: (r) => r.sort((a, b) => toMillis(b.submittedAt) - toMillis(a.submittedAt)) });
  if (loading) return <PageLoader />;
  if (!form) return <EmptyState title="Form not found" />;
  const fmt = (v) => (Array.isArray(v) ? v.join(", ") : v ?? "");
  const csv = () => downloadText(`${form.title.replace(/\W+/g, "-")}-responses.csv`, toCSV(rows, [...form.fields.map((f) => ({ label: f.label, value: (r) => fmt(r.answers?.[f.id]) })), { label: "Submitted", value: (r) => fmtDateTime(r.submittedAt) }]));
  return <>
    <DashHeader eyebrow={`FORM · ${form.eventName}`} title={form.title} subtitle={`${rows.length} responses`} action={<div className="flex gap-2"><Link to="/dashboard/forms" className="text-sm font-semibold text-muted">← Forms</Link><Button variant="secondary" onClick={csv} disabled={!rows.length}><Download /> CSV</Button></div>} />
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <div>{!rows.length ? <EmptyState title="No responses yet">Share the link or QR.</EmptyState> : <TableWrap><Table><thead><tr>{form.fields.map((f) => <Th key={f.id}>{f.label}</Th>)}<Th>Submitted</Th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}>{form.fields.map((f) => <Td key={f.id}>{fmt(r.answers?.[f.id]) || "—"}</Td>)}<Td className="whitespace-nowrap">{fmtDateTime(r.submittedAt)}</Td></tr>)}</tbody></Table></TableWrap>}</div>
      <div className="space-y-4">
        <Badge variant={form.status === "in_use" ? "ok" : "muted"}>{form.status === "in_use" ? "In use" : "Event completed"}</Badge>
        <QRCard url={`${SITE_URL}/f/${form.id}`} title="Form link" filename={`${form.id}-qr.png`} />
        <ActorCard actor={form.createdBy} label={`Created by · ${form.via === "code" ? `code ${form.grant?.code}` : form.via}`} at={form.createdAt} />
      </div>
    </div>
  </>;
}
