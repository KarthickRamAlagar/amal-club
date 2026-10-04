import { collection, doc, orderBy, query, where } from "firebase/firestore";
import { db, firebaseReady } from "@/lib/firebase";
import { useDocData, useQueryData } from "./useFirestore";
import { DEMO_EVENTS } from "@/lib/demo";
import { rankOf } from "@/lib/constants";

export function useEvents() {
  const r = useQueryData(() => query(collection(db, "events"), orderBy("startAt", "asc")), []);
  return firebaseReady ? r : { data: DEMO_EVENTS, loading: false, error: null };
}
export function useEvent(slug) {
  const r = useDocData(() => (slug ? doc(db, "events", slug) : null), [slug]);
  return firebaseReady ? r : { data: DEMO_EVENTS.find((e) => e.slug === slug) || null, loading: false };
}
const byRank = (rows) => rows.sort((a, b) => rankOf(b.role) - rankOf(a.role) || (a.name || "").localeCompare(b.name || ""));
export function useActiveMembers() {
  return useQueryData(() => query(collection(db, "members"), where("status", "==", "active")), [], { map: byRank });
}
export function useTeamMembers(teamId) {
  return useQueryData(() => (teamId ? query(collection(db, "members"), where("status", "==", "active"), where("team", "==", teamId)) : null), [teamId], { map: byRank });
}
