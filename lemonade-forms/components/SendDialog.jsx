// components/SendDialog.jsx — after Save. Three actions only: Fax to L&I,
// Fax to a number, or Email. Patient may be pre-filled (from an upload) — if not,
// it's captured here and the chart is matched/created on submit.
import React, { useState, useCallback } from "react";

const b64 = (bytes) => {
  let s = ""; const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
  return btoa(s);
};

export default function SendDialog({ pdfBytes, filename, formType, provider, patient: initial, initialAction, onClose, onDone }) {
  const known = !!initial?.claim; // came from an upload -> identity already captured
  const [claim, setClaim] = useState(initial?.claim || "");
  const [name, setName] = useState(initial?.name || "");
  const [dob, setDob] = useState(initial?.dob || "");
  const [chartMsg, setChartMsg] = useState("");
  const [action, setAction] = useState(initialAction || "fax_lni");
  const [faxNumber, setFaxNumber] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const lookup = useCallback(async () => {
    if (known || !claim.trim()) return;
    try {
      const r = await fetch(`/api/chart/lookup?claim=${encodeURIComponent(claim.trim())}`);
      const d = await r.json();
      if (d.found) { setName(d.name || ""); setDob(d.dob || ""); setChartMsg("Existing chart found."); }
      else setChartMsg("No chart yet — one will be created.");
    } catch {}
  }, [known, claim]);

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
          pdfBase64: b64(pdfBytes), filename, formType, provider,
          patient: { claim: claim.trim(), name: name.trim(), dob: dob.trim() },
          action, destination: { faxNumber: faxNumber.trim(), email: email.trim() },
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Send failed");
      onDone?.(d);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }, [pdfBytes, filename, formType, provider, claim, name, dob, action, faxNumber, email, onDone]);

  return (
    <div style={s.bg} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Send form</h3>
        {!known && (
          <>
            <label style={s.lbl}>L&amp;I Claim #</label>
            <input style={s.inp} value={claim} onChange={(e) => setClaim(e.target.value)} onBlur={lookup} />
            {chartMsg && <div style={s.hint}>{chartMsg}</div>}
          </>
        )}
        {known && <div style={s.hint}>For {name || "patient"} · claim {claim}</div>}

        {!initialAction && (<>
          <label style={s.lbl}>Action</label>
          {[["fax_lni", "Fax to L&I (360-902-4567)"], ["fax_number", "Fax to a number"], ["email", "Email"]].map(([v, t]) => (
            <label key={v} style={s.radio}><input type="radio" name="action" checked={action === v} onChange={() => setAction(v)} /> {t}</label>
          ))}
        </>)}
        {initialAction === "fax_lni" && <div style={s.hint}>Faxing to L&I (360-902-4567)</div>}
        {action === "fax_number" && <input style={s.inp} value={faxNumber} onChange={(e) => setFaxNumber(e.target.value)} placeholder="+1XXXXXXXXXX" />}
        {action === "email" && <input style={s.inp} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="recipient@example.com" />}

        {err && <div style={s.err}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button style={s.secondary} onClick={onClose}>Cancel</button>
          <button style={s.primary} disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send"}</button>
        </div>
      </div>
    </div>
  );
}
const s = {
  bg: { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 },
  modal: { background: "#fff", borderRadius: 10, padding: 20, width: 420, boxShadow: "0 10px 40px rgba(0,0,0,.25)" },
  lbl: { display: "block", fontSize: 12, color: "#475569", margin: "10px 0 4px" },
  inp: { width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, boxSizing: "border-box", fontSize: 14 },
  radio: { display: "block", fontSize: 14, margin: "6px 0" },
  hint: { fontSize: 12, color: "#0f766e", margin: "4px 0" },
  err: { background: "#fef2f2", color: "#991b1b", padding: "8px 10px", borderRadius: 6, fontSize: 13, marginTop: 10 },
  primary: { padding: "8px 16px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },
  secondary: { padding: "8px 12px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer" },
};
