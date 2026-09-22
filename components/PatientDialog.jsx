// components/PatientDialog.jsx — required patient identity before an uploaded form
// is opened, so it can be filed to a chart (created if it doesn't exist).
import React, { useState, useCallback } from "react";

export default function PatientDialog({ title = "Who is this form for?", onClose, onConfirm }) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [claim, setClaim] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = useCallback(async () => {
    setErr(null);
    if (!name.trim() || !claim.trim()) return setErr("Name and claim number are required.");
    setBusy(true);
    try {
      const res = await fetch("/api/chart/ensure", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), dob: dob.trim(), phone: phone.trim(), claim: claim.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not create/find chart");
      onConfirm({ recordId: d.recordId, created: d.created, patient: { name: name.trim(), dob: dob.trim(), phone: phone.trim(), claim: claim.trim() } });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }, [name, dob, phone, claim, onConfirm]);

  return (
    <div style={s.bg} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 0 }}>
          Required so the form is filed to the right chart. If no chart exists, one is created.
        </p>
        <label style={s.lbl}>Patient name</label>
        <input style={s.inp} value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><label style={s.lbl}>DOB</label>
            <input style={s.inp} type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
          <div style={{ flex: 1 }}><label style={s.lbl}>Phone</label>
            <input style={s.inp} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <label style={s.lbl}>L&amp;I Claim #</label>
        <input style={s.inp} value={claim} onChange={(e) => setClaim(e.target.value)} />
        {err && <div style={s.err}>{err}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button style={s.secondary} onClick={onClose}>Cancel</button>
          <button style={s.primary} disabled={busy} onClick={submit}>{busy ? "Saving…" : "Continue"}</button>
        </div>
      </div>
    </div>
  );
}
const s = {
  bg: { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 },
  modal: { background: "#fff", borderRadius: 10, padding: 20, width: 440, boxShadow: "0 10px 40px rgba(0,0,0,.25)" },
  lbl: { display: "block", fontSize: 12, color: "#475569", margin: "10px 0 4px" },
  inp: { width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, boxSizing: "border-box", fontSize: 14 },
  err: { background: "#fef2f2", color: "#991b1b", padding: "8px 10px", borderRadius: 6, fontSize: 13, marginTop: 10 },
  primary: { padding: "8px 16px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },
  secondary: { padding: "8px 12px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer" },
};
