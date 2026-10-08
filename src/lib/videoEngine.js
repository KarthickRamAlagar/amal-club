// AMAL Video Studio engine — open-source ffmpeg compiled to WebAssembly (ffmpeg.wasm), runs fully in the browser.
// Pipeline: every clip/photo → normalised segment (same size, 30 fps, AAC stereo) → concat → title/caption/logo/music pass.
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const CORE_VERSION = "0.12.10";
const CORE_BASES = [
  import.meta.env.VITE_FFMPEG_BASE,
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
  `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
].filter(Boolean);

export const FORMATS = {
  reel: { label: "Reel / Short · 9:16", 720: [720, 1280], 1080: [1080, 1920] },
  portrait: { label: "Instagram portrait · 4:5", 720: [720, 900], 1080: [1080, 1350] },
  square: { label: "Square · 1:1", 720: [720, 720], 1080: [1080, 1080] },
  landscape: { label: "LinkedIn / YouTube · 16:9", 720: [1280, 720], 1080: [1920, 1080] },
};
export const FPS = 30;
export const MAX_TOTAL_SECONDS = 180;
export const MAX_INPUT_MB = 600;

let instance = null;
let loading = null;
const logListeners = new Set();

/** Loads (once) and returns the ffmpeg instance. ~30 MB the first time, cached by the browser afterwards. */
export async function getFFmpeg(onStatus) {
  if (instance?.loaded) return instance;
  if (loading) return loading;
  loading = (async () => {
    const ff = new FFmpeg();
    ff.on("log", ({ message }) => {
      logListeners.forEach((fn) => fn(message));
      const L = (window.__amalVideoLog ||= []); L.push(message); if (L.length > 3000) L.splice(0, 1000); // for troubleshooting
    });
    let lastErr;
    for (const base of CORE_BASES) {
      try {
        onStatus?.(`Loading the video engine${base.includes("jsdelivr") ? "" : " (mirror)"}…`);
        await ff.load({
          coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
        });
        // fonts for titles (Manrope, OFL) — served from /public/fonts
        await ff.writeFile("title.ttf", await fetchFile("/fonts/Manrope_800ExtraBold.ttf"));
        await ff.writeFile("body.ttf", await fetchFile("/fonts/Manrope_500Medium.ttf"));
        instance = ff;
        return ff;
      } catch (e) { lastErr = e; console.warn("ffmpeg core load failed from", base, e); }
    }
    throw new Error(`Couldn't load the video engine (${lastErr?.message || "network"}). Check your connection and try again.`);
  })();
  try { return await loading; } finally { loading = null; }
}

/** Stops a running export (the next export reloads the engine). */
export function cancelFFmpeg() {
  try { instance?.terminate(); } catch { /* ignore */ }
  instance = null;
}

async function run(ff, args, onProgress) {
  const handler = ({ progress }) => onProgress?.(Math.max(0, Math.min(1, progress || 0)));
  ff.on("progress", handler);
  try {
    const code = await ff.exec(args);
    if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
  } finally { ff.off("progress", handler); }
}

/** Reads stream info from ffmpeg's log (works for every container ffmpeg understands). */
async function probe(ff, name) {
  const lines = [];
  const fn = (m) => lines.push(m);
  logListeners.add(fn);
  try { await ff.exec(["-hide_banner", "-i", name]); } catch { /* "no output file" is expected */ } finally { logListeners.delete(fn); }
  const text = lines.join("\n");
  const d = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return { hasAudio: /Stream #\d+:\d+.*Audio:/.test(text), duration: d ? (+d[1]) * 3600 + (+d[2]) * 60 + parseFloat(d[3]) : 0 };
}

const ext = (file) => (file.name?.match(/\.[a-z0-9]+$/i)?.[0] || (file.type?.startsWith("image/") ? ".jpg" : ".mp4")).toLowerCase();
const hex = (c) => `0x${c.replace("#", "")}`;
const f3 = (n) => Number(n).toFixed(3);

/** Video filter that fits a source into W×H. */
function fitFilter(fit, W, H, bg) {
  if (fit === "cover") return `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS},format=yuv420p[v0]`;
  if (fit === "blur") return `[0:v]split=2[b][f];[b]scale=${Math.round(W / 4)}:${Math.round(H / 4)}:force_original_aspect_ratio=increase,crop=${Math.round(W / 4)}:${Math.round(H / 4)},boxblur=8:2,scale=${W}:${H},eq=brightness=-0.08[bg];[f]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=${FPS},format=yuv420p[v0]`;
  return `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${hex(bg)},setsar=1,fps=${FPS},format=yuv420p[v0]`;
}

/**
 * Renders the project. `items` = [{ type:'video'|'image', file, start, end, still, muted }].
 * `opt` = { format, quality, fit, bg, fade, title:{text,sub,seconds}, caption, logo, music:{file, volume, keepClipAudio} }.
 * Returns a Blob (video/mp4).
 */
export async function renderVideo(items, opt, { onStage, onProgress } = {}) {
  const ff = await getFFmpeg((s) => onStage?.(s));
  const [W, H] = FORMATS[opt.format][opt.quality];
  const enc = ["-c:v", "libx264", "-preset", opt.quality === "1080" ? "veryfast" : "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2"];
  const files = [];
  const total = items.reduce((s, it) => s + (it.type === "image" ? it.still : it.end - it.start), 0);
  const steps = items.length + 2;
  let done = 0;
  const tick = (p) => onProgress?.(Math.min(0.999, (done + p) / steps));

  try {
    // 1) normalise every clip / photo to an identical segment
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const inName = `in${i}${ext(it.file)}`; const out = `seg${i}.mp4`;
      onStage?.(`Preparing ${it.type === "image" ? "photo" : "clip"} ${i + 1} of ${items.length}…`);
      await ff.writeFile(inName, await fetchFile(it.file)); files.push(inName);
      const dur = it.type === "image" ? it.still : Math.max(0.2, it.end - it.start);
      let vf = fitFilter(opt.fit, W, H, opt.bg || "#0f0408");
      if (opt.fade && dur > 1) vf = vf.replace(/\[v0\]$/, `,fade=t=in:st=0:d=0.35,fade=t=out:st=${f3(dur - 0.35)}:d=0.35[v0]`);
      const info = it.type === "video" ? await probe(ff, inName) : { hasAudio: false };
      const useClipAudio = it.type === "video" && info.hasAudio && !it.muted;
      const args = ["-hide_banner"];
      if (it.type === "image") args.push("-loop", "1", "-framerate", String(FPS), "-t", f3(dur), "-i", inName);
      else args.push("-ss", f3(it.start), "-t", f3(dur), "-i", inName);
      args.push("-f", "lavfi", "-t", f3(dur), "-i", "anullsrc=r=44100:cl=stereo");
      let af;
      if (useClipAudio) af = `[0:a]aresample=44100,aformat=channel_layouts=stereo,apad,atrim=0:${f3(dur)}${opt.fade && dur > 1 ? `,afade=t=in:st=0:d=0.3,afade=t=out:st=${f3(dur - 0.3)}:d=0.3` : ""}[a0]`;
      else af = `[1:a]anull[a0]`;
      args.push("-filter_complex", `${vf};${af}`, "-map", "[v0]", "-map", "[a0]", "-t", f3(dur), "-r", String(FPS), ...enc, "-y", out);
      await run(ff, args, tick);
      files.push(out);
      await ff.deleteFile(inName).catch(() => {}); files.splice(files.indexOf(inName), 1);
      done++; tick(0);
    }

    // 2) join
    onStage?.("Joining clips…");
    await ff.writeFile("list.txt", items.map((_, i) => `file 'seg${i}.mp4'`).join("\n")); files.push("list.txt");
    await run(ff, ["-hide_banner", "-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "-y", "joined.mp4"], tick);
    files.push("joined.mp4"); done++; tick(0);

    // 3) titles, caption, logo, music
    onStage?.("Adding title, music and finishing…");
    const filters = []; const inputs = ["-i", "joined.mp4"]; let v = "[0:v]"; let n = 1;
    const T = Math.min(opt.title?.seconds || 3, total);
    const alpha = (a, b) => `'if(lt(t,${a}+0.4),(t-${a})/0.4,if(lt(t,${b}-0.4),1,(${b}-t)/0.4))'`;
    if (opt.title?.text?.trim()) {
      await ff.writeFile("t1.txt", opt.title.text.trim()); files.push("t1.txt");
      const fs = Math.round(Math.min(W, H) * (opt.title.text.length > 28 ? 0.068 : 0.09));
      filters.push(`${v}drawtext=fontfile=title.ttf:textfile=t1.txt:expansion=none:fontsize=${fs}:fontcolor=white:line_spacing=${Math.round(fs * 0.15)}:x=(w-text_w)/2:y=(h-text_h)/2-${opt.title.sub ? Math.round(fs * 0.6) : 0}:box=1:boxcolor=0x0f0408@0.55:boxborderw=${Math.round(fs * 0.45)}:enable='between(t,0,${f3(T)})':alpha=${alpha(0, T)}[vt]`);
      v = "[vt]";
      if (opt.title.sub?.trim()) {
        await ff.writeFile("t2.txt", opt.title.sub.trim()); files.push("t2.txt");
        const fs2 = Math.round(fs * 0.42);
        filters.push(`${v}drawtext=fontfile=body.ttf:textfile=t2.txt:expansion=none:fontsize=${fs2}:fontcolor=0xf5c778:x=(w-text_w)/2:y=(h/2)+${Math.round(fs * 0.95)}:box=1:boxcolor=0x0f0408@0.55:boxborderw=${Math.round(fs2 * 0.45)}:enable='between(t,0,${f3(T)})':alpha=${alpha(0, T)}[vs]`);
        v = "[vs]";
      }
    }
    if (opt.caption?.trim()) {
      await ff.writeFile("cap.txt", opt.caption.trim()); files.push("cap.txt");
      const fs3 = Math.round(Math.min(W, H) * 0.036);
      filters.push(`${v}drawtext=fontfile=body.ttf:textfile=cap.txt:expansion=none:fontsize=${fs3}:fontcolor=white@0.92:x=(w-text_w)/2:y=h-text_h-${Math.round(H * 0.06)}:box=1:boxcolor=0x0f0408@0.45:boxborderw=${Math.round(fs3 * 0.5)}[vc]`);
      v = "[vc]";
    }
    if (opt.logo) {
      await ff.writeFile("logo.jpg", await fetchFile("/amal-logo.jpg")); files.push("logo.jpg");
      inputs.push("-i", "logo.jpg"); const li = n++;
      const s = Math.round(Math.min(W, H) * 0.13); const m = Math.round(Math.min(W, H) * 0.045);
      // round badge: circular alpha mask made with geq
      filters.push(`[${li}:v]scale=${s}:${s},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-${s / 2},Y-${s / 2}),${s / 2 - 1}),255,0)'[lg]`);
      filters.push(`${v}[lg]overlay=W-w-${m}:${m}[vl]`); v = "[vl]";
    }
    let audioMap = "0:a";
    if (opt.music?.file) {
      const mName = `music${ext(opt.music.file)}`;
      await ff.writeFile(mName, await fetchFile(opt.music.file)); files.push(mName);
      inputs.push("-stream_loop", "-1", "-i", mName); const mi = n++;
      const vol = Math.max(0, Math.min(1.5, opt.music.volume ?? 0.8));
      const fadeOut = total > 3 ? `,afade=t=out:st=${f3(total - 2)}:d=2` : "";
      filters.push(`[${mi}:a]aresample=44100,aformat=channel_layouts=stereo,volume=${vol},atrim=0:${f3(total)}${fadeOut}[mus]`);
      if (opt.music.keepClipAudio) { filters.push(`[0:a][mus]amix=inputs=2:duration=first:dropout_transition=0,volume=1.8[aout]`); }
      else filters.push(`[mus]apad,atrim=0:${f3(total)}[aout]`);
      audioMap = "[aout]";
    }
    if (!filters.length) {
      await run(ff, ["-hide_banner", "-i", "joined.mp4", "-c", "copy", "-movflags", "+faststart", "-y", "out.mp4"], tick);
    } else {
      const vMap = v === "[0:v]" ? "0:v" : v;
      const args = ["-hide_banner", ...inputs, "-filter_complex", filters.join(";"), "-map", vMap, "-map", audioMap];
      args.push(...(vMap === "0:v" ? ["-c:v", "copy"] : ["-c:v", "libx264", "-preset", opt.quality === "1080" ? "veryfast" : "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p"]));
      args.push(...(audioMap === "0:a" ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "160k"]));
      args.push("-t", f3(total), "-movflags", "+faststart", "-y", "out.mp4");
      await run(ff, args, tick);
    }
    files.push("out.mp4");
    const data = await ff.readFile("out.mp4");
    onProgress?.(1);
    return new Blob([data.buffer], { type: "video/mp4" });
  } finally {
    for (const f of files) await ff.deleteFile(f).catch(() => {});
  }
}

/** Duration via ffmpeg itself — for clips the browser can't decode (HEVC/iPhone MOV, some MKV/AVI…). */
export async function probeWithFFmpeg(file, onStatus) {
  const ff = await getFFmpeg(onStatus);
  const name = `probe${Date.now()}${ext(file)}`;
  await ff.writeFile(name, await fetchFile(file));
  try { return await probe(ff, name); } finally { await ff.deleteFile(name).catch(() => {}); }
}

/** Duration + a poster frame for a picked video, using the browser's own decoder. */
export function readVideoMeta(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata"; v.muted = true; v.src = url; v.playsInline = true;
    const finish = (thumb) => resolve({ url, duration: Number.isFinite(v.duration) ? v.duration : 0, width: v.videoWidth, height: v.videoHeight, thumb });
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 1) / 3); };
    v.onseeked = () => {
      try { const c = document.createElement("canvas"); c.width = 240; c.height = Math.round(240 * (v.videoHeight / v.videoWidth || 1)); c.getContext("2d").drawImage(v, 0, 0, c.width, c.height); finish(c.toDataURL("image/jpeg", 0.7)); }
      catch { finish(""); }
    };
    v.onerror = () => finish("");
  });
}
