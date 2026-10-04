import { auth } from "./firebase";

/** Calls our Vercel serverless API with the user's Firebase ID token. */
export async function api(path, body) {
  const token = await auth?.currentUser?.getIdToken();
  const res = await fetch(`/api/${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try { json = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}
