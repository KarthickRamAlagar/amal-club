import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ChevronDown, Download, FileText, Heading1, Heading2, Heading3, Highlighter, ImagePlus,
  Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, RotateCcw, Sparkles, Strikethrough, Table as TableIcon, Underline as UnderlineIcon, Undo2, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/input";
import { Spinner } from "@/components/common/Primitives";
import { saveReport } from "@/services/reports";
import { buildReportTemplate, dayHighlights, mediaList, participationTable } from "@/lib/reportTemplate";
const exporters = () => import("@/lib/reportExport"); // docx + turndown load only when downloading
import { dayFacts } from "@/hooks/useDossier";
import { uploadImage } from "@/lib/image";
import { api } from "@/lib/api";
import { cn, errMsg, fmtDateTime, toMillis } from "@/lib/utils";

const COLORS = ["#1d1013", "#c8203f", "#7a0f22", "#b8862f", "#1f5fbf", "#14714a"];
const SECTIONS = ["Overview", "Objectives", "Day-by-day highlights", "Participation summary", "Feedback & learnings", "Acknowledgements"];

function Tool({ on, active, disabled, title, children }) {
  return <button type="button" title={title} aria-label={title} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={on}
    className={cn("grid h-8 min-w-8 place-items-center rounded-md px-1.5 text-fg transition hover:bg-surface-2 disabled:opacity-35", active && "bg-brand-bright/15 text-brand-bright")}>{children}</button>;
}
const Sep = () => <span className="mx-1 h-6 w-px bg-line" />;

function Menu({ label, icon: Icon, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  return <div ref={ref} className="relative">
    <Button type="button" size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}><Icon /> {label} <ChevronDown /></Button>
    {open && <div className="absolute right-0 z-40 mt-1 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
      {items.map(([l, fn, hint]) => <button key={l} type="button" className="block w-full px-4 py-2.5 text-left text-sm hover:bg-surface-2" onClick={() => { setOpen(false); fn(); }}>{l}{hint && <span className="block text-[11px] text-muted">{hint}</span>}</button>)}
    </div>}
  </div>;
}

/**
 * Word-style report editor for one event. Opens pre-filled from the dossier, autosaves to /reports/{slug},
 * exports to PDF, Word (.docx), HTML, Markdown and plain text.
 */
export function ReportEditor({ me, dossier, canEdit }) {
  const { ev, report, stats, days, media } = dossier;
  const [status, setStatus] = useState("saved"); // saved | dirty | saving | error
  const [remote, setRemote] = useState(null);
  const [ai, setAi] = useState({ open: false, section: SECTIONS[0], busy: false });
  const lastSaved = useRef(0); const timer = useRef(null); const logged = useRef(false); const loaded = useRef(false);
  const imgIn = useRef(null);
  const title = `${ev.name} — Event Report`;

  const editor = useEditor({
    editable: canEdit,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false }),
      TableKit.configure({ table: { resizable: true } }),
      Highlight, TextStyle, Color,
      Placeholder.configure({ placeholder: "Start writing the report…" }),
    ],
    content: "",
    editorProps: { attributes: { class: "report-doc", spellcheck: "true" } },
    onUpdate: () => { if (!loaded.current) return; setStatus("dirty"); clearTimeout(timer.current); timer.current = setTimeout(() => persist(), 2500); },
  });

  // first load: saved report, or the pre-filled template
  useEffect(() => {
    if (!editor || loaded.current || dossier.reportLoading) return;
    editor.commands.setContent(report?.html || buildReportTemplate(dossier, me), { emitUpdate: false });
    lastSaved.current = toMillis(report?.updatedAt) || 0; loaded.current = true;
    if (!report && canEdit) setStatus("dirty");
  }, [editor, dossier.reportLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // someone else saved a newer version while we're open
  useEffect(() => {
    if (!report || !loaded.current) return;
    const t = toMillis(report.updatedAt);
    if (t > lastSaved.current + 1500 && report.updatedBy?.uid !== me.uid) setRemote(report);
  }, [report?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  async function persist() {
    if (!editor || !canEdit) return;
    clearTimeout(timer.current);
    setStatus("saving");
    try {
      const html = editor.getHTML();
      if (html.length > 880000) throw new Error("The report is too large — use fewer/lighter images.");
      await saveReport(me, ev, { html, words: editor.storage.characterCount?.words?.() || editor.getText().split(/\s+/).filter(Boolean).length, createdBy: report?.createdBy }, !logged.current);
      logged.current = true; lastSaved.current = Date.now(); setStatus("saved");
    } catch (e) { setStatus("error"); toast.error(errMsg(e)); }
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => e ? {
      bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"), mark: e.isActive("highlight"),
      h1: e.isActive("heading", { level: 1 }), h2: e.isActive("heading", { level: 2 }), h3: e.isActive("heading", { level: 3 }),
      ul: e.isActive("bulletList"), ol: e.isActive("orderedList"), quote: e.isActive("blockquote"), link: e.isActive("link"), table: e.isActive("table"),
      left: e.isActive({ textAlign: "left" }), center: e.isActive({ textAlign: "center" }), right: e.isActive({ textAlign: "right" }), justify: e.isActive({ textAlign: "justify" }),
      undo: e.can().undo(), redo: e.can().redo(),
    } : {},
  }) || {};

  const c = () => editor.chain().focus();
  function setLink() {
    const prev = editor.getAttributes("link").href || "";
    const url = prompt("Link URL (leave empty to remove)", prev);
    if (url === null) return;
    if (!url) return c().extendMarkRange("link").unsetLink().run();
    c().extendMarkRange("link").setLink({ href: /^https?:\/\//.test(url) ? url : `https://${url}` }).run();
  }
  async function addImage(file) {
    if (!file) return;
    const t = toast.loading("Uploading image…");
    try { const url = await uploadImage(file, { kind: "banner", folder: "amal/reports" }); c().setImage({ src: url, alt: file.name }).run(); toast.success("Image added.", { id: t }); }
    catch (e) { toast.error(errMsg(e), { id: t }); }
  }
  function imageFromUrl() { const u = prompt("Image URL (https://…)"); if (u) c().setImage({ src: u }).run(); }
  const insert = (html) => c().insertContent(html).run();

  async function aiDraft() {
    setAi((a) => ({ ...a, busy: true }));
    try {
      const facts = [
        `Event: ${ev.name}; date ${new Date(toMillis(ev.startAt)).toDateString()}; venue ${ev.location || "—"}.`,
        `About: ${ev.shortDesc || ""} ${ev.fullDesc || ""}`.slice(0, 1500),
        `Participation: ${stats.online} online + ${stats.onspot} on-spot teams registered, ${stats.confirmed} confirmed, ${stats.people} participants, ${stats.colleges.length} colleges, ${stats.responses} form responses.`,
        ...[...days].sort((a, b) => a.day - b.day).flatMap((d) => dayFacts(d, ev)).slice(0, 120),
      ].join("\n");
      const r = await api("ai/text", { purpose: "section", eventId: ev.slug, eventName: ev.name, section: ai.section, facts });
      insert(`<h2>${ai.section}</h2>${r.text.split(/\n{2,}/).map((p) => `<p>${p.replace(/</g, "&lt;")}</p>`).join("")}`);
      setAi({ open: false, section: ai.section, busy: false });
      toast.success("Draft inserted — please check every fact.");
    } catch (e) { toast.error(errMsg(e)); setAi((a) => ({ ...a, busy: false })); }
  }

  const exportsList = useMemo(() => editor ? [
    ["PDF", async () => (await exporters()).exportPdf(editor.getHTML(), title), "Print dialog → Save as PDF (A4, selectable text)"],
    ["Word (.docx)", async () => { const t = toast.loading("Building Word file…"); try { await (await exporters()).exportDocx(editor.getJSON(), title); toast.success("Word file downloaded.", { id: t }); } catch (e) { toast.error(errMsg(e), { id: t }); } }, "Opens in Microsoft Word / Google Docs"],
    ["HTML web page", async () => (await exporters()).exportHtml(editor.getHTML(), title)],
    ["Markdown (.md)", async () => (await exporters()).exportMarkdown(editor.getHTML(), title)],
    ["Plain text (.txt)", async () => (await exporters()).exportText(editor.getText({ blockSeparator: "\n\n" }), title)],
  ] : [], [editor, title]);

  if (!editor) return <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Loading editor…</div>;

  return <div className="space-y-3">
    {remote && <div className="inline-alert flex flex-wrap items-center justify-between gap-2">
      <span><strong>{remote.updatedBy?.name}</strong> saved a newer version at {fmtDateTime(remote.updatedAt)}.</span>
      <span className="flex gap-2"><Button size="sm" onClick={() => { editor.commands.setContent(remote.html, { emitUpdate: false }); lastSaved.current = toMillis(remote.updatedAt); setRemote(null); setStatus("saved"); }}>Load their version</Button>
        <Button size="sm" variant="ghost" onClick={() => setRemote(null)}>Keep mine</Button></span>
    </div>}

    <div className="sticky top-[82px] z-30 flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface p-1.5 shadow-sm">
      {canEdit && <>
        <Tool title="Undo" on={() => c().undo().run()} disabled={!s.undo}><Undo2 size={16} /></Tool>
        <Tool title="Redo" on={() => c().redo().run()} disabled={!s.redo}><Redo2 size={16} /></Tool><Sep />
        <Tool title="Heading 1" on={() => c().toggleHeading({ level: 1 }).run()} active={s.h1}><Heading1 size={17} /></Tool>
        <Tool title="Heading 2" on={() => c().toggleHeading({ level: 2 }).run()} active={s.h2}><Heading2 size={17} /></Tool>
        <Tool title="Heading 3" on={() => c().toggleHeading({ level: 3 }).run()} active={s.h3}><Heading3 size={17} /></Tool><Sep />
        <Tool title="Bold (Ctrl+B)" on={() => c().toggleBold().run()} active={s.bold}><Bold size={16} /></Tool>
        <Tool title="Italic (Ctrl+I)" on={() => c().toggleItalic().run()} active={s.italic}><Italic size={16} /></Tool>
        <Tool title="Underline (Ctrl+U)" on={() => c().toggleUnderline().run()} active={s.underline}><UnderlineIcon size={16} /></Tool>
        <Tool title="Strikethrough" on={() => c().toggleStrike().run()} active={s.strike}><Strikethrough size={16} /></Tool>
        <Tool title="Highlight" on={() => c().toggleHighlight().run()} active={s.mark}><Highlighter size={16} /></Tool>
        {COLORS.map((col) => <Tool key={col} title={`Text colour ${col}`} on={() => c().setColor(col).run()}><span className="h-4 w-4 rounded-full border border-line" style={{ background: col }} /></Tool>)}
        <Tool title="Reset colour" on={() => c().unsetColor().run()}><RotateCcw size={14} /></Tool><Sep />
        <Tool title="Bulleted list" on={() => c().toggleBulletList().run()} active={s.ul}><List size={16} /></Tool>
        <Tool title="Numbered list" on={() => c().toggleOrderedList().run()} active={s.ol}><ListOrdered size={16} /></Tool>
        <Tool title="Quote" on={() => c().toggleBlockquote().run()} active={s.quote}><Quote size={16} /></Tool>
        <Tool title="Divider" on={() => c().setHorizontalRule().run()}><Minus size={16} /></Tool><Sep />
        <Tool title="Align left" on={() => c().setTextAlign("left").run()} active={s.left}><AlignLeft size={16} /></Tool>
        <Tool title="Align centre" on={() => c().setTextAlign("center").run()} active={s.center}><AlignCenter size={16} /></Tool>
        <Tool title="Align right" on={() => c().setTextAlign("right").run()} active={s.right}><AlignRight size={16} /></Tool>
        <Tool title="Justify" on={() => c().setTextAlign("justify").run()} active={s.justify}><AlignJustify size={16} /></Tool><Sep />
        <Tool title="Link" on={setLink} active={s.link}><Link2 size={16} /></Tool>
        <Tool title="Image (upload)" on={() => imgIn.current?.click()}><ImagePlus size={16} /></Tool>
        <input ref={imgIn} type="file" hidden accept="image/*" onChange={(e) => { addImage(e.target.files?.[0]); e.target.value = ""; }} />
        <Tool title="Insert table" on={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={16} /></Tool>
        {s.table && <>
          <Tool title="Add row below" on={() => c().addRowAfter().run()}><span className="text-[11px] font-bold">+Row</span></Tool>
          <Tool title="Add column right" on={() => c().addColumnAfter().run()}><span className="text-[11px] font-bold">+Col</span></Tool>
          <Tool title="Delete row" on={() => c().deleteRow().run()}><span className="text-[11px] font-bold">−Row</span></Tool>
          <Tool title="Delete column" on={() => c().deleteColumn().run()}><span className="text-[11px] font-bold">−Col</span></Tool>
          <Tool title="Delete table" on={() => c().deleteTable().run()}><span className="text-[11px] font-bold text-brand-bright">×Table</span></Tool>
        </>}
      </>}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {canEdit && <span className={cn("px-2 text-[12px]", status === "error" ? "text-brand-bright" : "text-muted")}>
          {status === "saving" ? "Saving…" : status === "dirty" ? "Unsaved changes" : status === "error" ? "Not saved" : report?.updatedAt ? `Saved · ${report.updatedBy?.name?.split(" ")[0] || ""} ${fmtDateTime(report.updatedAt)}` : "Saved"}</span>}
        {canEdit && status !== "saved" && <Button size="sm" onClick={persist} disabled={status === "saving"}>Save</Button>}
        {canEdit && <Menu label="Insert" icon={Plus} items={[
          ["Participation table (live numbers)", () => insert(participationTable(stats, ev))],
          ["Day-by-day highlights", () => insert(dayHighlights(days))],
          ["Posters & videos list", () => insert(mediaList(media))],
          ["Image from a URL", imageFromUrl],
          ["Restart from the template", () => confirm("Replace the whole report with a fresh pre-filled template?") && editor.commands.setContent(buildReportTemplate(dossier, me))],
        ]} />}
        {canEdit && <Button size="sm" variant="secondary" onClick={() => setAi((a) => ({ ...a, open: true }))}><Sparkles /> AI draft</Button>}
        <Menu label="Download" icon={Download} items={exportsList} />
      </div>
    </div>

    <div className="report-page-wrap"><EditorContent editor={editor} /></div>

    <Dialog open={ai.open} onOpenChange={(o) => !ai.busy && setAi((a) => ({ ...a, open: o }))}>
      <DialogContent>
        <DialogTitle className="flex items-center gap-2"><Sparkles size={18} className="text-brand-bright" /> Draft a section with AI</DialogTitle>
        <DialogDescription>Uses only this event's recorded facts (details, numbers, diary). It's inserted at your cursor — always review it.</DialogDescription>
        <div className="mt-4 grid gap-3">
          <Field label="Section"><Select value={ai.section} onChange={(e) => setAi((a) => ({ ...a, section: e.target.value }))}>{SECTIONS.map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Button onClick={aiDraft} disabled={ai.busy}>{ai.busy ? <><Spinner className="text-white" /> Writing…</> : <><FileText /> Write &amp; insert</>}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}
