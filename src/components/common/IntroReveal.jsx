import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { visitor, markIntroSeen } from "@/lib/visitor";

/**
 * AMALVERSE intro — an 8-second reveal shown ONLY to first-time visitors on the home page.
 *   1. the campus banner + AMAL logo resolve out of big pixels (sharpening outward from the logo),
 *   2. "AMALVERSE" decodes letter by letter: random digits → look-alike numbers (4M4L…) → real letters,
 *   3. the finished banner (eyebrow, tagline, pills) fades in, then the overlay fades away.
 * Laptop/desktop uses public/amal-banner*.jpg (1920×1080); phones use public/amal-portrait*.jpg (1080×1920).
 * After it plays (or is skipped) localStorage "amal.introSeen" = "true", so it never shows again.
 * Replay any time with  /?intro=1
 */
export const INTRO_MS = 8000;
const TILE = 48;
const LEVELS = [48, 24, 16, 12, 8, 6, 4, 2];
const NAME = "AMALVERSE";
const SPLIT = 4; // "AMAL" white, "VERSE" crimson → gold
const LEET = { A: "4", M: "3", L: "1", V: "7", E: "3", R: "2", S: "5" };
const BG = "#0f0408";

// where the logo and the baked-in name sit inside each image (image pixels)
const WIDE = { src: "/amal-banner-clean.jpg", full: "/amal-banner.jpg", w: 1920, h: 1080, baseW: 1280, face: { x: 960, y: 330 }, name: { cx: 960, cy: 632, fs: 196 } };
const PORT = { src: "/amal-portrait-clean.jpg", full: "/amal-portrait.jpg", w: 1080, h: 1920, baseW: 720, face: { x: 540, y: 720 }, name: { cx: 540, cy: 1076, fs: 176 } };

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => 1 - (1 - t) ** 3;
const seeded = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

export default function IntroReveal() {
  const { pathname, search } = useLocation();
  const forced = new URLSearchParams(search).get("intro") === "1";
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined" || window.location.pathname !== "/") return false;
    if (forced) return true;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { markIntroSeen(); return false; }
    return !visitor.introSeen; // new visitor → play it
  });
  const [fade, setFade] = useState(false);
  const canvas = useRef(null);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return; done.current = true;
    markIntroSeen();
    setFade(true); setTimeout(() => setShow(false), 450);
  };

  // lock page scroll while the intro is on screen
  useEffect(() => {
    if (!show) return undefined;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [show]);

  useEffect(() => {
    if (!show || pathname !== "/") return undefined;
    let raf = 0, dead = false;
    const M = window.innerWidth / window.innerHeight < 1 ? PORT : WIDE; // chosen once per play
    const BASE_W = M.baseW, BASE_H = Math.round((BASE_W * M.h) / M.w);
    const cv = canvas.current; const ctx = cv.getContext("2d");
    let src, full, W, H, dpr, s, ox, oy, nameW = 0, gap = false;

    const layout = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      // "cover" the screen — but never crop the name: on very tall phones shrink to fit it,
      // pin the image to the top and let it fade into the background colour below
      s = Math.max(W / M.w, H / M.h);
      if (nameW && nameW * s > W * 0.92) s = (W * 0.92) / nameW;
      ox = (W - M.w * s) / 2;
      gap = M.h * s < H; oy = gap ? 0 : (H - M.h * s) / 2;
    };

    Promise.all([load(M.src), load(M.full), document.fonts?.load('800 100px "Manrope"').catch(() => {})]).then(([c, f]) => {
      if (dead) return;
      src = c; full = f;

      // pixel levels of the clean banner
      const base = document.createElement("canvas"); base.width = BASE_W; base.height = BASE_H;
      const bctx = base.getContext("2d"); bctx.imageSmoothingQuality = "high"; bctx.drawImage(src, 0, 0, BASE_W, BASE_H);
      const levels = LEVELS.map((b) => {
        const c2 = document.createElement("canvas"); c2.width = Math.ceil(BASE_W / b); c2.height = Math.ceil(BASE_H / b);
        const x = c2.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(base, 0, 0, c2.width, c2.height); return c2;
      });
      const work = document.createElement("canvas"); work.width = BASE_W; work.height = BASE_H;
      const wctx = work.getContext("2d"); wctx.imageSmoothingEnabled = false;

      // each tile starts later the further it is from the logo (+ a little noise)
      const cols = Math.ceil(BASE_W / TILE), rows = Math.ceil(BASE_H / TILE);
      const fx = (M.face.x / M.w) * BASE_W, fy = (M.face.y / M.h) * BASE_H, maxD = Math.hypot(BASE_W, BASE_H) * 0.75;
      const delay = Array.from({ length: cols * rows }, (_, i) => {
        const tx = (i % cols) * TILE + TILE / 2, ty = Math.floor(i / cols) * TILE + TILE / 2;
        return clamp(Math.hypot(tx - fx, ty - fy) / maxD) * 0.62 + seeded(i + 1) * 0.28;
      });
      const drawMosaic = (t) => {
        const g = clamp((t - 300) / 3900);
        for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
          const p = clamp((g - delay[ty * cols + tx] * 0.62) / 0.38);
          const lv = Math.floor(ease(p) * (LEVELS.length + 0.999));
          const x = tx * TILE, y = ty * TILE;
          if (lv >= LEVELS.length) wctx.drawImage(base, x, y, TILE, TILE, x, y, TILE, TILE);
          else { const b = LEVELS[lv]; wctx.drawImage(levels[lv], x / b, y / b, TILE / b, TILE / b, x, y, TILE, TILE); }
        }
      };

      // letter slots: measured on the REAL letters so digits sit exactly where letters will land
      const font = (px) => `800 ${px}px Manrope, "DM Sans", sans-serif`;
      ctx.font = font(100);
      const track = -0.045 * 100; // same letter-spacing as the banner (-0.045em)
      const widths = [...NAME].map((ch) => ctx.measureText(ch).width + track);
      const total = widths.reduce((a, b) => a + b, 0);
      let acc = 0; const slots = widths.map((w) => { const c = acc + w / 2; acc += w; return c - total / 2; }); // at 100px
      nameW = (total * M.name.fs) / 100; // name width in image pixels
      layout();
      const bottomFade = () => { // only when the image is shorter than the screen
        if (!gap) return;
        const y1 = oy + M.h * s, y0 = y1 - M.h * s * 0.18;
        const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, "rgba(15,4,8,0)"); g.addColorStop(1, BG);
        ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0 + 1);
      };

      const glyphFor = (ch, i, t) => {
        const age = t - (3400 + i * 110);
        if (age < 0) return null;
        if (age < 650) return { g: String((Math.floor(t / 55) * 7 + i * 13) % 10), c: "#f5c778" }; // random digits
        if (age < 1000) return { g: LEET[ch] || ch, c: "#ff9aab" };                              // look-alike number
        return { g: ch, c: null };                                                                // real letter
      };

      const t0 = performance.now();
      const frame = (now) => {
        if (dead) return;
        const t = now - t0;
        if (t >= INTRO_MS) { finish(); return; }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);

        drawMosaic(t);
        ctx.globalAlpha = clamp(t / 500); ctx.imageSmoothingEnabled = false;
        ctx.drawImage(work, ox, oy, M.w * s, M.h * s);
        ctx.imageSmoothingEnabled = true; ctx.globalAlpha = 1; bottomFade();

        // decoding name, drawn exactly over where the finished banner has it
        const textAlpha = 1 - clamp((t - 6300) / 700);
        if (t > 3400 && textAlpha > 0) {
          const fs = M.name.fs * s, k = fs / 100;
          const cx = ox + M.name.cx * s, cy = oy + M.name.cy * s;
          const gx0 = cx + (slots[SPLIT] - widths[SPLIT] / 2) * k, gx1 = cx + total / 2 * k;
          const grad = ctx.createLinearGradient(gx0, 0, gx1, 0);
          grad.addColorStop(0, "#ff4a6a"); grad.addColorStop(0.35, "#f33b5b"); grad.addColorStop(0.7, "#ff8a5c"); grad.addColorStop(1, "#f5c778");
          ctx.save(); ctx.globalAlpha = textAlpha; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = font(fs);
          ctx.shadowColor = "rgba(213,30,67,.55)"; ctx.shadowBlur = 40 * s;
          [...NAME].forEach((ch, i) => {
            const r = glyphFor(ch, i, t); if (!r) return;
            ctx.fillStyle = r.c || (i < SPLIT ? "#ffffff" : grad);
            ctx.fillText(r.g, cx + slots[i] * k, cy);
          });
          ctx.restore();
        }

        // finished banner (eyebrow, tagline, pills) fades over everything
        const d = clamp((t - 6300) / 700);
        if (d > 0) { ctx.globalAlpha = d; ctx.drawImage(full, ox, oy, M.w * s, M.h * s); ctx.globalAlpha = 1; bottomFade(); }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }).catch(() => finish()); // never block the site if an image is missing

    const onResize = () => { if (src) layout(); };
    window.addEventListener("resize", onResize);
    return () => { dead = true; cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [show, pathname]);

  if (!show || pathname !== "/") return null;
  return (
    <div role="presentation" style={{ position: "fixed", inset: 0, zIndex: 9999, background: BG, opacity: fade ? 0 : 1, transition: "opacity .45s ease" }}>
      <canvas ref={canvas} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      <button type="button" onClick={finish} aria-label="Skip intro"
        style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 20, border: "1px solid rgba(255,255,255,.18)", background: "rgba(15,4,8,.55)", color: "#fff",
          borderRadius: 999, padding: "9px 18px", fontSize: 12, fontWeight: 700, letterSpacing: ".18em", backdropFilter: "blur(8px)", cursor: "pointer" }}>
        SKIP ›
      </button>
    </div>
  );
}
