import { api } from "./api";

/** Thin client for /api/canva/<action>. Tokens stay on the server; the browser only sees results. */
export const canvaApi = (action, body = {}) => api(`canva/${action}`, body);

export const CANVA_PRESETS = {
  poster: [
    ["instagram-post", "Instagram post", "1080 × 1350"],
    ["instagram-square", "Instagram square", "1080 × 1080"],
    ["instagram-story", "Instagram story", "1080 × 1920"],
    ["linkedin-post", "LinkedIn post", "1200 × 1200"],
    ["linkedin-landscape", "LinkedIn landscape", "1200 × 627"],
    ["a4-poster", "A4 print poster", "2480 × 3508"],
  ],
  video: [
    ["reel", "Reel / Short", "1080 × 1920"],
    ["video-square", "Square video", "1080 × 1080"],
    ["video-landscape", "Landscape video", "1920 × 1080"],
  ],
};

/** Polls an export job until Canva finishes (videos can take a few minutes). */
export async function waitForExport(jobId, { onTick, timeoutMs = 6 * 60 * 1000 } = {}) {
  const t0 = Date.now();
  for (let i = 0; ; i++) {
    const r = await canvaApi("exportStatus", { jobId });
    if (r.status === "success") return r.urls;
    if (r.status === "failed") throw new Error(r.error || "Canva couldn't export this design.");
    if (Date.now() - t0 > timeoutMs) throw new Error("Canva is taking too long — try again in a minute.");
    onTick?.(i);
    await new Promise((res) => setTimeout(res, i < 5 ? 2000 : 4000));
  }
}
