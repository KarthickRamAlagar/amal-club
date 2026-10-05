/**
 * Visitor memory — small flags kept in this browser (localStorage) so the app
 * can tell a brand-new visitor from a returning one. Survives reloads and
 * browser restarts; cleared only if the user clears site data.
 *
 *   amal.visited       "true" once the visitor has been here before
 *   amal.introSeen     "true" once the AMALVERSE intro has played (or been skipped)
 *   amal.firstVisitAt  ISO time of the very first visit
 *   amal.lastVisitAt   ISO time of the latest visit
 *   amal.visitCount    number of visits (one per browser session)
 */
const K = {
  visited: "amal.visited",
  introSeen: "amal.introSeen",
  firstVisitAt: "amal.firstVisitAt",
  lastVisitAt: "amal.lastVisitAt",
  visitCount: "amal.visitCount",
  session: "amal.sessionCounted", // sessionStorage: stops one tab session counting twice
};

const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode etc. */ } };

/** Read the visitor flags once at startup — before recordVisit() changes them. */
export const visitor = {
  isNew: get(K.visited) !== "true",
  introSeen: get(K.introSeen) === "true",
  firstVisitAt: get(K.firstVisitAt),
  lastVisitAt: get(K.lastVisitAt),
  visitCount: Number(get(K.visitCount) || 0),
};

/** Call once when the app starts: marks visited = true and counts the visit. */
export function recordVisit() {
  const now = new Date().toISOString();
  if (!get(K.firstVisitAt)) set(K.firstVisitAt, now);
  set(K.lastVisitAt, now);
  set(K.visited, "true");
  try {
    if (!sessionStorage.getItem(K.session)) {
      sessionStorage.setItem(K.session, "1");
      set(K.visitCount, Number(get(K.visitCount) || 0) + 1);
    }
  } catch { /* ignore */ }
}

export const markIntroSeen = () => set(K.introSeen, "true");

/** Clear every flag (handy for testing: run resetVisitor() in the console, then reload). */
export function resetVisitor() {
  Object.values(K).forEach((k) => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch { /* ignore */ } });
}
if (typeof window !== "undefined") window.resetVisitor = resetVisitor;
