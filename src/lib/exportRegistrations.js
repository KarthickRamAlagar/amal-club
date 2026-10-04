import { toCSV, downloadText, fmtDateTime } from "./utils";
import { effectiveStatus } from "@/services/registrations";

export function registrationsCsv(ev, regs) {
  const maxMembers = Math.max(0, ...regs.map((r) => r.members?.length || 0));
  const cols = [
    { label: "Team", value: "teamName" },
    { label: "Mode", value: "mode" },
    { label: "Status", value: (r) => effectiveStatus(r) },
    { label: "Headcount", value: "headcount" },
    { label: "Amount (₹)", value: "amount" },
    { label: "Leader name", value: (r) => r.leader?.name },
    { label: "Leader email", value: (r) => r.leader?.email },
    { label: "Leader phone", value: (r) => r.leader?.phone },
    { label: "College", value: (r) => r.leader?.college },
    { label: "College ID", value: (r) => r.leader?.collegeId },
    { label: "Department", value: (r) => r.leader?.department },
    { label: "Year", value: (r) => r.leader?.year },
    { label: "Leader photo", value: (r) => r.leader?.photoUrl },
    ...Array.from({ length: maxMembers }, (_, i) => [
      { label: `Member ${i + 2} name`, value: (r) => r.members?.[i]?.name },
      { label: `Member ${i + 2} email`, value: (r) => r.members?.[i]?.email },
      { label: `Member ${i + 2} phone`, value: (r) => r.members?.[i]?.phone },
      { label: `Member ${i + 2} college`, value: (r) => r.members?.[i]?.college },
    ]).flat(),
    { label: "Payment UTR", value: (r) => r.payment?.utr },
    { label: "Payment proof", value: (r) => r.payment?.proofUrl },
    { label: "Verified by", value: (r) => r.decidedBy?.name },
    { label: "Registered at", value: (r) => fmtDateTime(r.createdAt) },
  ];
  downloadText(`${ev.slug}-registrations-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(regs, cols));
}
