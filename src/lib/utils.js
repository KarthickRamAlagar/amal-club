import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { LIMITS } from "./constants";

export function cn(...inputs) { return twMerge(clsx(inputs)); }

export const slugify = (s = "") =>
  s.toString().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "event";

export const toMillis = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (v.toMillis) return v.toMillis();
  if (v.seconds) return v.seconds * 1000;
  const d = new Date(v); return isNaN(d) ? 0 : d.getTime();
};

export const fmtDate = (v, opts = { day: "2-digit", month: "short", year: "numeric" }) => {
  const ms = toMillis(v); return ms ? new Date(ms).toLocaleDateString("en-IN", opts) : "—";
};
export const fmtTime = (v) => {
  const ms = toMillis(v); return ms ? new Date(ms).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
};
export const fmtDateTime = (v) => (toMillis(v) ? `${fmtDate(v)} · ${fmtTime(v)}` : "—");

export function timeAgo(v) {
  const ms = toMillis(v); if (!ms) return "just now";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return fmtDate(ms);
}

export function countdown(msLeft) {
  if (msLeft <= 0) return "0m";
  const h = Math.floor(msLeft / 3600000), m = Math.floor((msLeft % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Online registration closes at 11:50 PM IST on the night before the event (same math as firestore.rules). */
export function registrationClosesAt(eventStartMs) {
  if (!eventStartMs) return 0;
  const istMidnightOfEventDay = Math.floor((eventStartMs + 19800000) / 86400000) * 86400000 - 19800000;
  return istMidnightOfEventDay - (24 * 60 - (LIMITS.registrationCloseHour * 60 + LIMITS.registrationCloseMinute)) * 60000;
}
/** End of the event day (IST) — on-spot registration allowed until then. */
export function eventDayEnd(eventStartMs) {
  return Math.floor((eventStartMs + 19800000) / 86400000) * 86400000 - 19800000 + 86400000;
}

/** IST day number — must match the Firestore rule (UTC ms + 5h30m) / 1 day */
export const istDayNumber = (ms = Date.now()) => Math.floor((ms + 19800000) / 86400000);
export const monthKey = (ms = Date.now()) => new Date(ms + 19800000).toISOString().slice(0, 7);

export function academicYearOf(ms = Date.now()) {
  const d = new Date(ms); const y = d.getFullYear();
  return d.getMonth() >= 5 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
}

export const initials = (name = "") =>
  name.replace(/^(prof|dr|mr|ms|mrs)\.?\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "A";

export function randomDigits(n) {
  const arr = new Uint32Array(n); crypto.getRandomValues(arr);
  return Array.from(arr, (x) => x % 10).join("");
}
export function randomToken(len = 8) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const arr = new Uint32Array(len); crypto.getRandomValues(arr);
  return Array.from(arr, (x) => abc[x % abc.length]).join("");
}

export function toCSV(rows, columns) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => esc(typeof c.value === "function" ? c.value(r) : r[c.value])).join(",")).join("\n");
  return `${head}\n${body}`;
}
export function downloadText(filename, text, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + text], { type });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const COLLEGE_ID_RE = /^BL\.[A-Z0-9.]+\d{4}$/i;   // BL.EN.U4CSE21 0 0 1 → BL.********1234
export const PHONE_RE = /^[+]?[0-9 ]{10,15}$/;
export const AMAL_ID_RE = /^[a-z0-9._-]{4,24}$/;

export function errMsg(e) {
  const code = e?.code || "";
  const map = {
    "permission-denied": "You don't have permission to do that.",
    "auth/invalid-credential": "Wrong AMAL ID / email or password.",
    "auth/email-already-in-use": "An account already exists for this email. Sign in instead.",
    "auth/weak-password": "Password should be at least 8 characters.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  };
  return map[code] || e?.message?.replace(/^Firebase:\s*/, "") || "Something went wrong.";
}
