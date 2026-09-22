// components/SendDialog.jsx — pre-send step. Collects claim #/name/DOB (auto-prefilled
// if a chart already exists), lets the provider choose Download / Fax to L&I / Fax to a
// number / Email, then POSTs the completed PDF to /api/forms/save.
import React, { useState, useCallback } from "react";

const b64 = (bytes) => {
  let s = ""; const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
  return btoa(s);
};

export default function SendDialog({ pdfBytes, filename, formType, provider, onClose, onDone }) {
  const [claim, setClaim] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [action, setAction] = useState("fax_lni");
  const [faxNumber, setFaxNumber] = useState("");
  const [email, setEmail] = useState("");
  const [chartMsg, setChartMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Prefill from an existing chart when the claim number is entered (reuse saved info).
  const lookup = useCallback(async () => {
    if (!claim.trim()) return;
    try {
      const r = await fetch(`/api/chart/lookup?claim=${encodeURIComponent(claim.trim())}`);
      const d = await r.json();
      if (d.found) { setName(d.name || ""); setDob(d.dob || ""); setChartMsg("Existing chart found — details filled in."); }
      else setChartMsg("No chart yet — one will be created from these details.");
    } catch { /* non-fatal */ }
  }, [claim]);

  const submit = useCallback(async () => {
    setErr(null);
    if (!claim.trim()) return setErr("Claim number is required.");
    if (action === "fax_number" && !faxNumber.trim()) return setErr("Enter a fax number.");
    if (action === "email" && !email.trim()) return setErr("Enter an email address.");
    setBusy(true);
    try {
      const res = await fetch("/api/forms/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfBase64: b64(pdfBytes), filename, formType,
          provider,
          patient: { claim: claim.trim(), name: name.trim(), dob: dob.trim() },
          action,
          destination: { faxNumber: faxNumber.trim(), email: email.trim() },
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      if (action === "download" && d.download) window.open(d.download, "_blank");
      onDone?.(d);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }, [pdfBytes, filename, formType, provider, claim, name, dob, action, faxNumber, email, onDone]);

  return (
    <div style={s.bg} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Send / file form</h3>
        <label style={s.lbl}>L&amp;I Claim #</label>
        <input style={s.inp} value={claim} onChange={(e) => setClaim(e.target.value)} onBlur={lookup} placeholder="Required" />
        {chartMsg && <div style={s.hint}>{chartMsg}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={s.lbl}>Patient name</label>
            <input style={s.inp} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div style={{ width: 150 }}>
            <label style={s.lbl}>DOB</label>
            <input style={s.inp} type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
        </div>

        <label style={s.lbl}>Action</label>
        {[["fax_lni", "Fax to L&I (360-902-4567)"], ["fax_number", "Fax to a specific number"],
          ["email", "Email"], ["download", "Download only"]].map(([v, t]) => (
          <label key={v} style={s.radio}>
            <input type="radio" name="action" checked={action === v} onChange={() => setAction(v)} /> {t}
          </label>
        ))}
        {action === "fax_number" && <input style={s.inp} value={faxNumber} onChange={(e) => setFaxNumber(e.target.value)} placeholder="+1XXXXXXXXXX" />}
        {action === "email" && <input style={s.inp} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="recipient@example.com" />}

        {err && <div style={s.err}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button style={s.secondary} onClick={onClose}>Cancel</button>
          <button style={s.primary} disabled={busy} onClick={submit}>{busy ? "Working…" : "Confirm"}</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  bg: { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 },
  modal: { background: "#fff", borderRadius: 10, padding: 20, width: 460, boxShadow: "0 10px 40px rgba(0,0,0,.25)" },
  lbl: { display: "block", fontSize: 12, color: "#475569", margin: "10px 0 4px" },
  inp: { width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, boxSizing: "border-box", fontSize: 14 },
  radio: { display: "block", fontSize: 14, margin: "6px 0" },
  hint: { fontSize: 12, color: "#0f766e", marginTop: 4 },
  err: { background: "#fef2f2", color: "#991b1b", padding: "8px 10px", borderRadius: 6, fontSize: 13, marginTop: 10 },
  primary: { padding: "8px 16px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },
  secondary: { padding: "8px 12px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer" },
};
