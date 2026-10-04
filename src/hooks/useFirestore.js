import { useEffect, useState, useRef } from "react";
import { onSnapshot } from "firebase/firestore";
import { firebaseReady } from "@/lib/firebase";

/** Live query. `make` returns a Query (or null to skip). `deps` re-subscribe. */
export function useQueryData(make, deps = [], { map } = {}) {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  const mapRef = useRef(map); mapRef.current = map;
  useEffect(() => {
    if (!firebaseReady) { setState({ data: [], loading: false, error: null }); return; }
    const q = make();
    if (!q) { setState({ data: [], loading: false, error: null }); return; }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(q,
      (snap) => {
        let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (mapRef.current) rows = mapRef.current(rows);
        setState({ data: rows, loading: false, error: null });
      },
      (error) => { console.warn(error); setState({ data: [], loading: false, error }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/** Live single document. */
export function useDocData(make, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    if (!firebaseReady) { setState({ data: null, loading: false, error: null }); return; }
    const ref = make();
    if (!ref) { setState({ data: null, loading: false, error: null }); return; }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(ref,
      (s) => setState({ data: s.exists() ? { id: s.id, ...s.data() } : null, loading: false, error: null }),
      (error) => { console.warn(error); setState({ data: null, loading: false, error }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(t); }, [intervalMs]);
  return now;
}
