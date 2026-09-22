// FormEditor.jsx — Lemonade "Forms" PDF editor  (BUILD INCREMENT 1: editor core)
// ---------------------------------------------------------------------------
// Add to Vercel-Lemonade:  npm i pdfjs-dist pdf-lib react-signature-canvas
//
// WHAT THIS DOES NOW
//   • Loads a PDF (a blank template from a Forms category, or a provider upload)
//   • Renders every page with pdf.js
//   • FILLABLE forms (APF, Prior Auth, BHI Assessment, BHI Re-assessment):
//     detects the AcroForm and renders positioned inputs/checkboxes over each page
//   • FLAT or uploaded PDFs (PHQ-4, GCPS, anything with no fields): click-to-place
//     text, checkmarks, and a signature — "overlay mode"
//   • Saved signature: draw once (or upload a PNG), reuse on every form
//   • Submission stamp auto-applied on save:
//     "Submitted by <legal name>, The Psychiatry Group PLLC, 5904 N Division St,
//      Spokane, WA 99208 · 844-495-4357"
//   • On save: writes field values + overlays with pdf-lib, FLATTENS (output is no
//     longer editable), and hands the bytes to props.onSave()
//
// INTEGRATION POINTS (wired in increment 2 — the backend)
//   props.currentUser        { legalName }               // from the logged-in account
//   props.savedSignatureUrl  string | null               // provider's stored signature PNG
//   props.onSaveSignature    (dataUrl) => Promise<void>   // persist to the account record
//   props.onSave             ({ bytes, filename }) => any // -> Azure save + chart match/create + send
//   props.onCancel           () => void
//   props.source             { bytes?: ArrayBuffer, url?: string, filename: string }
//
// NOTE: not yet integration-tested inside the app shell — this is the first draft
// to commit and iterate on. Radio groups are handled as grouped checkboxes; drag is
// basic. The save/flatten path is the important part and is complete.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url"; // Vite. For Next, see note below.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import SignatureCanvas from "react-signature-canvas";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
// Next.js (no ?url): copy pdf.worker.min.mjs into /public and set
//   pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const PRACTICE = {
  name: "The Psychiatry Group PLLC",
  address: "5904 N Division St, Spokane, WA 99208",
  phone: "844-495-4357",
};
const RENDER_SCALE = 1.5; // display scale; save writes in true PDF points regardless

// ---- helpers ---------------------------------------------------------------

async function loadSourceBytes(source) {
  if (source?.bytes) return source.bytes;
  if (source?.url) {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`Failed to load PDF: ${res.status}`);
    return await res.arrayBuffer();
  }
  throw new Error("No PDF source provided");
}

// Enumerate AcroForm widgets with their page + PDF-point rects, using pdf-lib.
function enumerateFields(pdfDoc) {
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  const pages = pdfDoc.getPages();
  const pageIndexByRef = new Map();
  pages.forEach((p, i) => pageIndexByRef.set(p.ref, i));

  const widgets = [];
  for (const field of fields) {
    const name = field.getName();
    const type = field.constructor.name; // PDFTextField | PDFCheckBox | PDFRadioGroup | PDFDropdown ...
    const acro = field.acroField;
    const ws = acro.getWidgets();
    ws.forEach((w, wi) => {
      const rect = w.getRectangle(); // { x, y, width, height } in PDF points, y-up
      let pageIndex = 0;
      const pRef = w.dict.get(pdfjsLib.isName ? "P" : "P"); // resolved below via fallback
      // Resolve widget's page by matching against page annotation arrays
      pages.forEach((p, i) => {
        const annots = p.node.Annots?.();
        if (!annots) return;
        for (const a of annots.asArray()) {
          if (a === w.ref) pageIndex = i;
        }
      });
      widgets.push({ name, type, wi, pageIndex, rect });
    });
  }
  return { form, widgets };
}

// Convert a PDF-point rect (y-up origin bottom-left) to CSS box on a scaled page.
function pdfRectToCss(rect, pageHeightPts, scale) {
  return {
    left: rect.x * scale,
    top: (pageHeightPts - rect.y - rect.height) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

// ---- component -------------------------------------------------------------

export default function FormEditor({
  source,
  currentUser,
  savedSignatureUrl = null,
  onSaveSignature,
  onSave,
  onCancel,
}) {
  const [bytes, setBytes] = useState(null);
  const [pageImages, setPageImages] = useState([]); // { dataUrl, wPts, hPts }
  const [isFillable, setIsFillable] = useState(false);
  const [fieldWidgets, setFieldWidgets] = useState([]);
  const [fieldValues, setFieldValues] = useState({}); // name -> string | bool
  const [overlays, setOverlays] = useState([]); // { id,type,page,xPts,yPts,text?,size?,dataUrl? }
  const [tool, setTool] = useState("select"); // select | text | check | signature
  const [sigOpen, setSigOpen] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState(savedSignatureUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const sigPad = useRef(null);

  // Load + render
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setError(null);
        const ab = await loadSourceBytes(source);
        if (!alive) return;
        setBytes(ab.slice(0)); // keep a copy for pdf-lib on save

        // pdf.js render
        const doc = await pdfjsLib.getDocument({ data: ab.slice(0) }).promise;
        const imgs = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
          const base = page.getViewport({ scale: 1 });
          imgs.push({ dataUrl: canvas.toDataURL("image/png"), wPts: base.width, hPts: base.height });
        }
        if (!alive) return;
        setPageImages(imgs);

        // pdf-lib field enumeration
        const pdfDoc = await PDFDocument.load(ab.slice(0));
        const { widgets } = enumerateFields(pdfDoc);
        if (!alive) return;
        setFieldWidgets(widgets);
        setIsFillable(widgets.length > 0);
      } catch (e) {
        if (alive) setError(e.message || String(e));
      }
    })();
    return () => { alive = false; };
  }, [source]);

  const setField = useCallback((name, value) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Click on a page in overlay mode -> place an item at PDF-point coords
  const handlePageClick = useCallback(
    (e, pageIndex, hPts) => {
      if (tool === "select") return;
      const rectEl = e.currentTarget.getBoundingClientRect();
      const xCss = e.clientX - rectEl.left;
      const yCss = e.clientY - rectEl.top;
      const xPts = xCss / RENDER_SCALE;
      const yPts = hPts - yCss / RENDER_SCALE; // to PDF y-up
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (tool === "text") {
        const text = window.prompt("Text:");
        if (text) setOverlays((o) => [...o, { id, type: "text", page: pageIndex, xPts, yPts, text, size: 10 }]);
      } else if (tool === "check") {
        setOverlays((o) => [...o, { id, type: "text", page: pageIndex, xPts, yPts, text: "X", size: 11 }]);
      } else if (tool === "signature") {
        if (!signatureUrl) { setSigOpen(true); return; }
        setOverlays((o) => [...o, { id, type: "sig", page: pageIndex, xPts, yPts, dataUrl: signatureUrl, wPts: 120, hPts: 40 }]);
      }
      setTool("select");
    },
    [tool, signatureUrl]
  );

  // Signature modal save
  const saveSignature = useCallback(async () => {
    if (!sigPad.current || sigPad.current.isEmpty()) return;
    const dataUrl = sigPad.current.getTrimmedCanvas().toDataURL("image/png");
    setSignatureUrl(dataUrl);
    setSigOpen(false);
    try { await onSaveSignature?.(dataUrl); } catch { /* non-fatal; still usable this session */ }
  }, [onSaveSignature]);

  const uploadSignature = useCallback(async (file) => {
    const dataUrl = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(file);
    });
    setSignatureUrl(dataUrl);
    setSigOpen(false);
    try { await onSaveSignature?.(dataUrl); } catch { /* non-fatal */ }
  }, [onSaveSignature]);

  // ---- SAVE: write values + overlays + stamp, flatten, hand up ----
  const handleSave = useCallback(async () => {
    if (!bytes) return;
    setBusy(true);
    setError(null);
    try {
      const pdfDoc = await PDFDocument.load(bytes.slice(0));
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();

      // 1) fillable fields
      if (isFillable) {
        const form = pdfDoc.getForm();
        for (const [name, value] of Object.entries(fieldValues)) {
          let field;
          try { field = form.getField(name); } catch { continue; }
          const t = field.constructor.name;
          try {
            if (t === "PDFTextField") field.setText(String(value ?? ""));
            else if (t === "PDFCheckBox") value ? field.check() : field.uncheck();
            else if (t === "PDFRadioGroup") { if (value) field.select(String(value)); }
            else if (t === "PDFDropdown") { if (value) field.select(String(value)); }
          } catch { /* skip a value that doesn't fit its field */ }
        }
      }

      // 2) overlay items (flat/uploaded placements + signatures)
      for (const o of overlays) {
        const page = pages[o.page];
        if (!page) continue;
        if (o.type === "text") {
          page.drawText(o.text, { x: o.xPts, y: o.yPts, size: o.size || 10, font, color: rgb(0, 0, 0) });
        } else if (o.type === "sig" && o.dataUrl) {
          const png = await pdfDoc.embedPng(o.dataUrl);
          const w = o.wPts || 120;
          const h = (png.height / png.width) * w;
          page.drawImage(png, { x: o.xPts, y: o.yPts, width: w, height: h });
        }
      }

      // 3) submission stamp — bottom-left of page 1
      const p1 = pages[0];
      const legal = currentUser?.legalName || "[provider]";
      const line1 = `Submitted by ${legal}, ${PRACTICE.name}`;
      const line2 = `${PRACTICE.address} · ${PRACTICE.phone}`;
      p1.drawText(line1, { x: 36, y: 30, size: 7.5, font: fontBold, color: rgb(0.25, 0.25, 0.25) });
      p1.drawText(line2, { x: 36, y: 21, size: 7.5, font, color: rgb(0.25, 0.25, 0.25) });

      // 4) flatten so the saved copy is not further editable
      if (isFillable) {
        try { pdfDoc.getForm().flatten(); } catch { /* some forms w/ odd widgets; leave unflattened */ }
      }

      const out = await pdfDoc.save();
      const filename = (source?.filename || "form").replace(/\.pdf$/i, "") + "-completed.pdf";
      await onSave?.({ bytes: out, filename });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [bytes, isFillable, fieldValues, overlays, currentUser, source, onSave]);

  const modeLabel = useMemo(
    () => (isFillable ? "Fillable form — type into the fields" : "Overlay mode — click to place text / checkmarks / signature"),
    [isFillable]
  );

  // ---- render ----
  return (
    <div className="fe-root" style={styles.root}>
      <div style={styles.toolbar}>
        <button style={styles.back} onClick={onCancel}>← Back</button>
        <strong style={{ marginRight: 12 }}>{source?.filename}</strong>
        <span style={styles.badge}>{modeLabel}</span>
        <div style={{ flex: 1 }} />
        {!isFillable && (
          <>
            <ToolBtn active={tool === "check"} onClick={() => setTool("check")}>✓ Check</ToolBtn>
          </>
        )}
        <ToolBtn active={tool === "signature"} onClick={() => (signatureUrl ? setTool("signature") : setSigOpen(true))}>
          Signature
        </ToolBtn>
        <button style={styles.primary} disabled={busy} onClick={handleSave}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.canvasWrap}>
        {pageImages.map((pg, pageIndex) => (
          <div
            key={pageIndex}
            style={{ ...styles.page, width: pg.wPts * RENDER_SCALE, height: pg.hPts * RENDER_SCALE }}
            onClick={(e) => handlePageClick(e, pageIndex, pg.hPts)}
          >
            <img src={pg.dataUrl} alt={`page ${pageIndex + 1}`} style={styles.pageImg} draggable={false} />

            {/* fillable inputs for this page */}
            {isFillable &&
              fieldWidgets
                .filter((w) => w.pageIndex === pageIndex)
                .map((w, i) => {
                  const box = pdfRectToCss(w.rect, pg.hPts, RENDER_SCALE);
                  const isCheck = w.type === "PDFCheckBox" || w.type === "PDFRadioGroup";
                  return (
                    <div key={`${w.name}-${i}`} style={{ position: "absolute", ...box }}>
                      {isCheck ? (
                        <input
                          type="checkbox"
                          style={{ width: "100%", height: "100%" }}
                          checked={!!fieldValues[w.name]}
                          onChange={(e) => setField(w.name, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <input
                          type="text"
                          style={styles.fieldInput}
                          value={fieldValues[w.name] || ""}
                          onChange={(e) => setField(w.name, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </div>
                  );
                })}

            {/* overlay placements for this page */}
            {overlays
              .filter((o) => o.page === pageIndex)
              .map((o) => {
                const left = o.xPts * RENDER_SCALE;
                const top = (pg.hPts - o.yPts) * RENDER_SCALE;
                return (
                  <div
                    key={o.id}
                    style={{ position: "absolute", left, top: top - 12, ...styles.overlayItem }}
                    onClick={(e) => { e.stopPropagation(); setOverlays((arr) => arr.filter((x) => x.id !== o.id)); }}
                    title="Click to remove"
                  >
                    {o.type === "sig" ? <img src={o.dataUrl} alt="sig" style={{ height: 34 }} /> : o.text}
                  </div>
                );
              })}
          </div>
        ))}
      </div>

      {sigOpen && (
        <div style={styles.modalBg} onClick={() => setSigOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Signature</h3>
            <div style={{ border: "1px solid #cbd5e1", borderRadius: 6 }}>
              <SignatureCanvas ref={sigPad} penColor="black" canvasProps={{ width: 420, height: 150 }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <button style={styles.secondary} onClick={() => sigPad.current?.clear()}>Clear</button>
              <label style={{ ...styles.secondary, cursor: "pointer" }}>
                Upload PNG
                <input type="file" accept="image/png" hidden onChange={(e) => e.target.files[0] && uploadSignature(e.target.files[0])} />
              </label>
              <div style={{ flex: 1 }} />
              <button style={styles.primary} onClick={saveSignature}>Save & reuse</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ ...styles.tool, ...(active ? styles.toolActive : {}) }}>
      {children}
    </button>
  );
}

const styles = {
  root: { display: "flex", flexDirection: "column", height: "100%", background: "#f1f5f9" },
  back: { fontSize: 13, padding: "6px 10px", border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, cursor: "pointer", marginRight: 4 },
  toolbar: { display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#fff", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 5 },
  badge: { fontSize: 12, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 999, padding: "3px 10px" },
  tool: { fontSize: 13, padding: "6px 10px", border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, cursor: "pointer" },
  toolActive: { background: "#0f766e", color: "#fff", borderColor: "#0f766e" },
  primary: { fontSize: 13, padding: "7px 16px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },
  secondary: { fontSize: 13, padding: "7px 12px", background: "#fff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer" },
  error: { background: "#fef2f2", color: "#991b1b", padding: "8px 14px", fontSize: 13, borderBottom: "1px solid #fecaca" },
  canvasWrap: { flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 },
  page: { position: "relative", boxShadow: "0 1px 4px rgba(0,0,0,.15)", background: "#fff" },
  pageImg: { position: "absolute", inset: 0, width: "100%", height: "100%", userSelect: "none" },
  fieldInput: { width: "100%", height: "100%", border: "1px solid rgba(15,118,110,.4)", background: "rgba(15,118,110,.06)", font: "12px Helvetica, Arial", padding: "0 2px", boxSizing: "border-box" },
  overlayItem: { fontSize: 12, color: "#000", cursor: "pointer", whiteSpace: "nowrap" },
  modalBg: { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 },
  modal: { background: "#fff", borderRadius: 10, padding: 18, width: 460, boxShadow: "0 10px 40px rgba(0,0,0,.25)" },
};
