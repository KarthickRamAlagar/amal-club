// Export the report editor's content: Word (.docx), PDF (print), HTML, Markdown, plain text.
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header, HeadingLevel, ImageRun, LevelFormat,
  Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const CRIMSON = "C8203F";
const save = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
export const fileBase = (title) => (title || "AMAL-report").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "AMAL-report";

// ───────────── Word (.docx) ─────────────
const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };
const HEADING = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 };

async function imageData(src) {
  // docx needs PNG/JPG bytes; anything else (WebP/AVIF) is re-encoded through a canvas.
  const url = src.includes("res.cloudinary.com") ? src.replace("/upload/", "/upload/f_png,w_1400,c_limit/") : src;
  const blob = await (await fetch(url, { mode: "cors" })).blob();
  const bmp = await createImageBitmap(blob);
  let type = blob.type.includes("png") ? "png" : blob.type.includes("jpeg") || blob.type.includes("jpg") ? "jpg" : null;
  let data = await blob.arrayBuffer();
  if (!type) {
    const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; c.getContext("2d").drawImage(bmp, 0, 0);
    data = await (await new Promise((r) => c.toBlob(r, "image/png"))).arrayBuffer(); type = "png";
  }
  const w = Math.min(600, bmp.width); return { type, data, width: w, height: Math.round((bmp.height / bmp.width) * w) };
}

function runs(nodes = [], base = {}) {
  const out = [];
  for (const n of nodes) {
    if (n.type === "hardBreak") { out.push(new TextRun({ break: 1 })); continue; }
    if (n.type !== "text") continue;
    const m = Object.fromEntries((n.marks || []).map((k) => [k.type, k.attrs || true]));
    const opts = {
      text: n.text, ...base,
      bold: base.bold || !!m.bold, italics: !!m.italic, strike: !!m.strike,
      underline: m.underline || m.link ? {} : undefined,
      color: m.link ? "1F5FBF" : m.textStyle?.color ? m.textStyle.color.replace("#", "").slice(0, 6) : base.color,
      highlight: m.highlight ? "yellow" : undefined,
      font: m.code ? "Consolas" : undefined,
    };
    const r = new TextRun(opts);
    out.push(m.link?.href ? new ExternalHyperlink({ link: m.link.href, children: [r] }) : r);
  }
  return out;
}

async function blocks(nodes = [], ctx, list = null) {
  const out = [];
  for (const n of nodes) {
    const align = ALIGN[n.attrs?.textAlign];
    switch (n.type) {
      case "heading":
        out.push(new Paragraph({ heading: HEADING[n.attrs?.level] || HeadingLevel.HEADING_3, alignment: align, children: runs(n.content, n.attrs?.level === 1 ? { color: CRIMSON, bold: true } : { bold: true }) })); break;
      case "paragraph":
        if (list) out.push(new Paragraph({ alignment: align, children: runs(n.content), ...(list.ordered ? { numbering: { reference: "amal-ol", level: list.level, instance: list.instance } } : { bullet: { level: list.level } }) }));
        else if (ctx.quote) out.push(new Paragraph({ alignment: align, indent: { left: 480 }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: CRIMSON, space: 12 } }, children: runs(n.content, { italics: true }) }));
        else out.push(new Paragraph({ alignment: align, spacing: { after: 120 }, children: runs(n.content) }));
        break;
      case "bulletList": case "orderedList": {
        // `list` here is the PARENT list (when nested) — this list sits one level deeper
        const ordered = n.type === "orderedList"; const instance = ordered ? ++ctx.olInstance : 0;
        const level = list ? Math.min(3, list.level + 1) : 0;
        for (const li of n.content || []) {
          for (const child of li.content || []) {
            if (child.type === "paragraph") out.push(...await blocks([child], ctx, { ordered, level, instance }));
            else if (child.type === "bulletList" || child.type === "orderedList") out.push(...await blocks([child], ctx, { ordered, level, instance }));
            else out.push(...await blocks([child], ctx));
          }
        }
        break;
      }
      case "blockquote": out.push(...await blocks(n.content, { ...ctx, quote: true })); break;
      case "horizontalRule": out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "BBBBBB", space: 1 } }, children: [] })); break;
      case "codeBlock": out.push(new Paragraph({ shading: { type: ShadingType.CLEAR, fill: "F3F3F3" }, children: runs(n.content, { font: "Consolas" }) })); break;
      case "image":
        try { const im = await imageData(n.attrs.src); out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: im.type, data: im.data, transformation: { width: im.width, height: im.height } })] })); }
        catch { out.push(new Paragraph({ children: [new ExternalHyperlink({ link: n.attrs.src, children: [new TextRun({ text: "[image]", color: "1F5FBF", underline: {} })] })] })); }
        break;
      case "table": {
        const rows = [];
        for (const tr of n.content || []) {
          const cells = [];
          for (const td of tr.content || []) {
            const header = td.type === "tableHeader";
            const kids = await blocks(td.content, ctx);
            cells.push(new TableCell({
              children: kids.length ? kids : [new Paragraph("")], columnSpan: td.attrs?.colspan || 1, rowSpan: td.attrs?.rowspan || 1,
              shading: header ? { type: ShadingType.CLEAR, fill: "F7E3E7" } : undefined,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }));
          }
          rows.push(new TableRow({ children: cells }));
        }
        if (rows.length) out.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }), new Paragraph(""));
        break;
      }
      default: if (n.content) out.push(...await blocks(n.content, ctx, list));
    }
  }
  return out;
}

export async function exportDocx(json, title) {
  const children = await blocks(json.content, { olInstance: 0 });
  const doc = new Document({
    creator: "AMAL Club", title, description: "AMAL event report",
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", run: { size: 40, bold: true, color: CRIMSON }, paragraph: { spacing: { before: 120, after: 160 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", run: { size: 30, bold: true, color: "2A0A12" }, paragraph: { spacing: { before: 280, after: 120 } } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", run: { size: 25, bold: true, color: "7A0F22" }, paragraph: { spacing: { before: 200, after: 80 } } },
      ],
    },
    numbering: { config: [{ reference: "amal-ol", levels: [0, 1, 2, 3].map((level) => ({ level, format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN, LevelFormat.DECIMAL][level], text: `%${level + 1}.`, alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } })) }] },
    sections: [{
      properties: { page: { margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "AMAL · Amrita Management & Leadership Club", color: "888888", size: 16 })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], color: "888888", size: 16 })] })] }) },
      children,
    }],
  });
  save(await Packer.toBlob(doc), `${fileBase(title)}.docx`);
}

// ───────────── HTML / PDF ─────────────
const PRINT_CSS = `
@page{size:A4;margin:18mm 16mm}
*{box-sizing:border-box}body{font:11pt/1.55 Calibri,"DM Sans",Arial,sans-serif;color:#1d1013;margin:0}
.wrap{max-width:780px;margin:0 auto;padding:24px}
.brand{display:flex;align-items:center;gap:12px;border-bottom:3px solid #c8203f;padding-bottom:10px;margin-bottom:18px;color:#7a0f22;font-weight:700;font-size:10pt;letter-spacing:.06em;text-transform:uppercase}
.brand img{width:40px;height:40px;border-radius:50%}
h1{color:#c8203f;font-size:24pt;line-height:1.15;margin:.2em 0 .4em}h2{color:#2a0a12;font-size:15pt;margin:1.4em 0 .4em;border-bottom:1px solid #eed;padding-bottom:4px}h3{color:#7a0f22;font-size:12.5pt;margin:1.1em 0 .3em}
table{border-collapse:collapse;width:100%;margin:.6em 0 1em}td,th{border:1px solid #d9c9cc;padding:6px 9px;text-align:left;vertical-align:top}th{background:#f7e3e7}
blockquote{border-left:4px solid #c8203f;margin:.8em 0;padding:.2em 0 .2em 14px;color:#4a2a31;font-style:italic}
img{max-width:100%;height:auto;border-radius:6px}mark{background:#fff3a6}a{color:#1f5fbf}hr{border:0;border-top:1px solid #ccc}
h1,h2,h3{page-break-after:avoid}tr,img{page-break-inside:avoid}`;

export function standaloneHtml(html, title) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title.replace(/</g, "&lt;")}</title><style>${PRINT_CSS}</style></head>
<body><div class="wrap"><div class="brand"><img src="${window.location.origin}/amal-logo.jpg" alt="">Amrita Management &amp; Leadership Club · Event report</div>${html}</div></body></html>`;
}
export const exportHtml = (html, title) => save(new Blob([standaloneHtml(html, title)], { type: "text/html;charset=utf-8" }), `${fileBase(title)}.html`);

/** Opens the browser's print dialog on a clean A4 copy → "Save as PDF" (text stays selectable). */
export function exportPdf(html, title) {
  const f = document.createElement("iframe");
  Object.assign(f.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(f);
  const d = f.contentDocument; d.open(); d.write(standaloneHtml(html, title)); d.close();
  const go = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); };
  const imgs = [...d.images]; let left = imgs.length;
  if (!left) setTimeout(go, 150); else imgs.forEach((im) => { const done = () => { if (--left === 0) setTimeout(go, 150); }; if (im.complete) done(); else { im.onload = done; im.onerror = done; } });
}

// ───────────── Markdown / text ─────────────
export function exportMarkdown(html, title) {
  const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
  td.use(gfm);
  // report tables often have no header row (key/value tables) — still emit proper pipe tables
  td.addRule("anyTable", {
    filter: "table",
    replacement: (_c, node) => {
      const rows = [...node.querySelectorAll("tr")].map((tr) => [...tr.children].map((cell) => td.turndown(cell.innerHTML).replace(/\n+/g, " ").replace(/\|/g, "\\|").trim()));
      if (!rows.length) return "";
      const w = Math.max(...rows.map((r) => r.length));
      const line = (r) => `| ${Array.from({ length: w }, (_, i) => r[i] || "").join(" | ")} |`;
      return `\n\n${line(rows[0])}\n| ${Array(w).fill("---").join(" | ")} |\n${rows.slice(1).map(line).join("\n")}\n\n`;
    },
  });
  td.addRule("mark", { filter: ["mark"], replacement: (c) => `==${c}==` });
  save(new Blob([td.turndown(html)], { type: "text/markdown;charset=utf-8" }), `${fileBase(title)}.md`);
}
export const exportText = (text, title) => save(new Blob([text], { type: "text/plain;charset=utf-8" }), `${fileBase(title)}.txt`);
