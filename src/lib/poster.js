import { qrDataUrl } from "@/components/common/QRCard";
import { fmtDate, fmtTime } from "./utils";

export const FORMATS = {
  instagram: { w: 1080, h: 1350, label: "Instagram post (4:5)" },
  story: { w: 1080, h: 1920, label: "Instagram story (9:16)" },
  linkedin: { w: 1200, h: 627, label: "LinkedIn (1.91:1)" },
};

const THEMES = {
  dark: { overlay: ["rgba(20,5,10,0.35)", "rgba(20,5,10,0.92)"], text: "#ffffff", muted: "#e7d3d9", accent: "#f5c778", accent2: "#f33b5b", card: "rgba(255,255,255,0.08)", cardLine: "rgba(255,255,255,0.18)", qrDark: "#1a0508" },
  light: { overlay: ["rgba(251,246,245,0.55)", "rgba(251,246,245,0.96)"], text: "#27151c", muted: "#5d4851", accent: "#a5122f", accent2: "#d51e43", card: "rgba(255,255,255,0.75)", cardLine: "rgba(59,19,32,0.14)", qrDark: "#27151c" },
};

export function loadImg(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    if (!src.startsWith("data:") && !src.startsWith("/")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src;
  });
}

function cover(ctx, img, x, y, w, h) {
  const r = Math.max(w / img.width, h / img.height);
  const iw = img.width * r, ih = img.height * r;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function wrap(ctx, text, maxW) {
  const words = String(text || "").split(/\s+/).filter(Boolean); const lines = []; let line = "";
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}
function text(ctx, s, x, y, { size, weight = 700, color, font = "Manrope", align = "left", max, lh = 1.15, maxLines = 99, spacing = 0 }) {
  ctx.font = `${weight} ${size}px ${font}, "DM Sans", sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "top";
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
  let lines = max ? wrap(ctx, s, max) : [String(s)];
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, "") + "…"; }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * lh));
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  return y + lines.length * size * lh;
}
async function circleImg(ctx, src, x, y, d, ring, fallbackName) {
  const img = await loadImg(src);
  ctx.save(); ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  if (img) cover(ctx, img, x, y, d, d); else { ctx.fillStyle = "#870c2b"; ctx.fillRect(x, y, d, d); text(ctx, (fallbackName || "A").split(" ").map((w) => w[0]).slice(0, 2).join(""), x + d / 2, y + d * 0.3, { size: d * 0.36, color: "#fff", align: "center" }); }
  ctx.restore();
  if (ring) { ctx.lineWidth = Math.max(3, d * 0.04); ctx.strokeStyle = ring; ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2); ctx.stroke(); }
}
function chip(ctx, label, x, y, t, s) {
  ctx.font = `700 ${s}px "DM Sans", sans-serif`; const w = ctx.measureText(label).width + s * 1.6, h = s * 2.1;
  ctx.fillStyle = t.card; rr(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.strokeStyle = t.cardLine; ctx.lineWidth = 2; ctx.stroke();
  text(ctx, label, x + s * 0.8, y + s * 0.52, { size: s, font: '"DM Sans"', color: t.text, weight: 700 }); return w;
}

/** Draws the full poster. Text, QR, logos and judges are vector-crisp; AI only supplies the background artwork. */
export async function drawPoster(canvas, d) {
  const F = FORMATS[d.format] || FORMATS.instagram; const t = THEMES[d.theme] || THEMES.dark;
  canvas.width = F.w; canvas.height = F.h;
  const ctx = canvas.getContext("2d");
  await Promise.all(["800 80px Manrope", "700 30px 'DM Sans'", "500 30px 'DM Sans'"].map((f) => document.fonts?.load(f).catch(() => {})));
  const land = F.w > F.h; const P = land ? 56 : 72; const S = F.w / 1080;

  // background
  ctx.fillStyle = d.theme === "light" ? "#fbf6f5" : "#14060b"; ctx.fillRect(0, 0, F.w, F.h);
  const bg = await loadImg(d.backgroundUrl);
  if (bg) cover(ctx, bg, 0, 0, F.w, F.h);
  const g = land ? ctx.createLinearGradient(0, 0, F.w, 0) : ctx.createLinearGradient(0, 0, 0, F.h);
  g.addColorStop(0, t.overlay[0]); g.addColorStop(land ? 0.62 : 0.45, t.overlay[1]); g.addColorStop(1, t.overlay[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, F.w, F.h);
  // decorative orbit
  ctx.strokeStyle = t.accent; ctx.globalAlpha = 0.25; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(F.w * (land ? 0.8 : 0.85), F.h * 0.12, F.w * 0.35, F.w * 0.12, -0.3, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;

  // ── fixed zones first: QR card (bottom-right) and sponsor band (bottom-left) ──
  const qs = (land ? 170 : d.format === "story" ? 260 : 230) * S;
  const qx = F.w - P - qs, qy = F.h - P - qs - 70 * S;
  const sponsors = d.showSponsors ? (d.sponsors || []).filter((s) => s.name).slice(0, 5) : [];
  const sw = (land ? 58 : 84) * S, sy = F.h - P - sw;
  const leftLimit = sponsors.length ? sy - 52 * S : F.h - P;
  const colW = land ? F.w * 0.58 - P : F.w - P * 2;
  const widthAt = (yy, h) => (!land && yy + h > qy - 24 * S ? qx - P - 36 * S : colW);
  const measure = (str, size, weight, font, max, lh, maxLines) => {
    ctx.font = `${weight} ${size}px ${font}`; return Math.min(maxLines, wrap(ctx, str, max).length) * size * lh;
  };

  // header
  const logo = (land ? 70 : 84) * S;
  await circleImg(ctx, "/amal-logo.jpg", P, P, logo, t.accent);
  text(ctx, "AMAL CLUB PRESENTS", P + logo + 20 * S, P + logo * 0.18, { size: (land ? 21 : 24) * S, color: t.accent, weight: 800, spacing: 4 });
  text(ctx, "Amrita Management & Leadership Club", P + logo + 20 * S, P + logo * 0.58, { size: (land ? 17 : 20) * S, color: t.muted, weight: 500, font: '"DM Sans"' });

  let y = P + logo + (land ? 34 : 70) * S;
  const nameSize = (land ? 60 : d.format === "story" ? 112 : 100) * S;
  y = text(ctx, d.eventName, P, y, { size: nameSize, color: t.text, weight: 800, max: colW, lh: 1.02, maxLines: land ? 2 : 3 }) + 16 * S;
  if (d.tagline) y = text(ctx, d.tagline, P, y, { size: (land ? 21 : 32) * S, color: t.muted, weight: 500, font: '"DM Sans"', max: colW, lh: 1.3, maxLines: land ? 2 : 3 }) + 22 * S;

  // chips (measure first, then wrap)
  const cs = (land ? 17 : 25) * S; const ch = cs * 2.1; let cx = P;
  for (const c of [fmtDate(d.startAt), fmtTime(d.startAt), d.location, d.price ? `₹${d.price} / team` : "Free entry"].filter(Boolean)) {
    ctx.font = `700 ${cs}px "DM Sans", sans-serif`; const w = ctx.measureText(c).width + cs * 1.6;
    if (cx > P && cx + w > P + colW) { cx = P; y += ch + 10 * S; }
    chip(ctx, c, cx, y, t, cs); cx += w + 10 * S;
  }
  y += ch + 26 * S;

  // rules (only what fits above the bottom zones)
  const rules = d.showRules ? (d.rules || []).slice(0, land ? 3 : 4) : [];
  const rs = (land ? 18 : 25) * S;
  if (rules.length && y + 34 * S + rs * 1.2 <= leftLimit) {
    text(ctx, "RULES", P, y, { size: (land ? 16 : 20) * S, color: t.accent, weight: 800, spacing: 3 }); y += (land ? 28 : 34) * S;
    for (const r of rules) {
      const w = widthAt(y, rs * 2.4) - 30 * S;
      const h = measure(r, rs, 500, '"DM Sans"', w, 1.15, 2);
      if (y + h > leftLimit) break;
      ctx.fillStyle = t.accent2; ctx.beginPath(); ctx.arc(P + 8 * S, y + rs * 0.6, 5.5 * S, 0, Math.PI * 2); ctx.fill();
      y = text(ctx, r, P + 26 * S, y, { size: rs, color: t.text, weight: 500, font: '"DM Sans"', max: w, maxLines: 2 }) + 7 * S;
    }
    y += 12 * S;
  }
  if (d.prizes) {
    const ps = (land ? 22 : 32) * S; const w = widthAt(y, ps * 2.4);
    if (y + measure(d.prizes, ps, 800, "Manrope", w, 1.15, 2) <= leftLimit) y = text(ctx, `🏆 ${d.prizes}`, P, y, { size: ps, color: t.accent, weight: 800, max: w, maxLines: 2 }) + 20 * S;
  }

  // judges — portrait: below content if room; landscape: right column above the QR
  const judges = d.showJudges ? (d.judges || []).filter((j) => j.name) : [];
  if (judges.length) {
    let jx, jy, jd, maxN;
    if (land) {
      jx = F.w * 0.62; jy = P + 6 * S; const areaW = F.w - P - jx, areaH = qy - 30 * S - jy - 32 * S;
      jd = Math.min(84 * S, areaH - 64 * S); maxN = Math.max(0, Math.floor((areaW + 26 * S) / (jd + 26 * S)));
    } else {
      jx = P; jy = y + 6 * S; jd = 108 * S; const limit = Math.min(leftLimit, qy - 24 * S);
      maxN = jy + 36 * S + jd + 74 * S <= limit ? Math.floor((qx - P - 20 * S) / (jd + 40 * S)) : 0;
      if (!maxN && jy + 36 * S + jd + 74 * S <= leftLimit) maxN = Math.floor((qx - P - 20 * S) / (jd + 40 * S));
    }
    const list = judges.slice(0, Math.min(4, maxN));
    if (list.length && jd > 30) {
      text(ctx, "JUDGES", jx, jy, { size: (land ? 16 : 20) * S, color: t.accent, weight: 800, spacing: 3 }); jy += (land ? 28 : 36) * S;
      for (const j of list) {
        await circleImg(ctx, j.photoUrl, jx, jy, jd, t.accent, j.name);
        const nm = jd + (land ? 22 : 34) * S;
        text(ctx, j.name, jx + jd / 2, jy + jd + 9 * S, { size: (land ? 15 : 18) * S, color: t.text, weight: 800, align: "center", max: nm, maxLines: 2, lh: 1.1 });
        if (j.title) text(ctx, j.title, jx + jd / 2, jy + jd + (land ? 44 : 52) * S, { size: (land ? 12 : 14) * S, color: t.muted, weight: 500, font: '"DM Sans"', align: "center", max: nm, maxLines: 1 });
        jx += jd + (land ? 26 : 40) * S;
      }
    }
  }

  // QR card
  ctx.fillStyle = "#ffffff"; rr(ctx, qx - 14 * S, qy - 14 * S, qs + 28 * S, qs + 98 * S, 26 * S); ctx.fill();
  const qr = await loadImg(await qrDataUrl(d.registerUrl, { dark: t.qrDark }));
  if (qr) ctx.drawImage(qr, qx, qy, qs, qs);
  text(ctx, "SCAN TO REGISTER", qx + qs / 2, qy + qs + 12 * S, { size: (land ? 15 : 19) * S, color: "#a5122f", weight: 800, align: "center", spacing: 2 });
  ctx.font = `600 ${12 * S}px "DM Sans"`;
  const url = d.registerUrl.replace(/^https?:\/\//, "");
  const [u1, u2] = url.length > 30 ? [url.slice(0, url.indexOf("/") + 1), url.slice(url.indexOf("/") + 1)] : [url, ""];
  text(ctx, u1, qx + qs / 2, qy + qs + 42 * S, { size: 12 * S, color: "#5d4851", weight: 600, font: '"DM Sans"', align: "center" });
  if (u2) text(ctx, u2, qx + qs / 2, qy + qs + 58 * S, { size: 12 * S, color: "#5d4851", weight: 600, font: '"DM Sans"', align: "center" });

  // sponsors band
  if (sponsors.length) {
    let sx = P;
    text(ctx, "SPONSORED BY", P, sy - 30 * S, { size: (land ? 14 : 18) * S, color: t.accent, weight: 800, spacing: 3 });
    for (const sp of sponsors) {
      if (sx + sw > qx - 30 * S) break;
      const img = await loadImg(sp.logoUrl);
      ctx.fillStyle = "#ffffff"; rr(ctx, sx, sy, sw, sw, 14 * S); ctx.fill();
      if (img) { const r = Math.min((sw - 14) / img.width, (sw - 14) / img.height); ctx.drawImage(img, sx + (sw - img.width * r) / 2, sy + (sw - img.height * r) / 2, img.width * r, img.height * r); }
      else text(ctx, sp.name.slice(0, 2).toUpperCase(), sx + sw / 2, sy + sw * 0.3, { size: sw * 0.34, color: "#a5122f", align: "center" });
      sx += sw + 14 * S;
    }
  }
  return canvas;
}
