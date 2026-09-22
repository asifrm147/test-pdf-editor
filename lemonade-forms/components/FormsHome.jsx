// components/FormsHome.jsx — the Forms area: category buckets (APF / Prior Auth /
// Assessments / BHI), plus "upload your own". Opens FormEditor, and on save shows
// SendDialog. Drop this where "Assessments" currently lives in Lemonade's nav.
import React, { useState } from "react";
import { FORM_CATEGORIES, PRACTICE } from "../config/catalog.js";
import FormEditor from "./FormEditor.jsx";
import SendDialog from "./SendDialog.jsx";

// TODO: wire to Lemonade's auth. Provide the logged-in provider's legal name + email.
function useCurrentUser() {
  // return { legalName, email } from your auth context
  return { legalName: "", email: "" };
}

export default function FormsHome() {
  const currentUser = useCurrentUser();
  const [editing, setEditing] = useState(null); // { source:{url|bytes, filename}, formType }
  const [pending, setPending] = useState(null);  // { bytes, filename, formType }

  const openTemplate = (form) =>
    setEditing({ source: { url: `/templates/${form.template}`, filename: form.template }, formType: form.name });

  const openUpload = (file) => {
    const reader = new FileReader();
    reader.onload = () =>
      setEditing({ source: { bytes: reader.result, filename: file.name }, formType: file.name.replace(/\.pdf$/i, "") });
    reader.readAsArrayBuffer(file);
  };

  if (editing) {
    return (
      <>
        <FormEditor
          source={editing.source}
          currentUser={currentUser}
          /* savedSignatureUrl / onSaveSignature -> wire to the provider's account record */
          onSave={({ bytes, filename }) => { setPending({ bytes, filename, formType: editing.formType }); }}
          onCancel={() => setEditing(null)}
        />
        {pending && (
          <SendDialog
            pdfBytes={pending.bytes} filename={pending.filename} formType={pending.formType}
            provider={currentUser}
            onClose={() => setPending(null)}
            onDone={() => { setPending(null); setEditing(null); }}
          />
        )}
      </>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Forms</h2>
        <label style={{ ...btn, cursor: "pointer" }}>
          Upload a form
          <input type="file" accept="application/pdf" hidden onChange={(e) => e.target.files[0] && openUpload(e.target.files[0])} />
        </label>
      </div>
      {FORM_CATEGORIES.map((cat) => (
        <section key={cat.id} style={{ marginTop: 22 }}>
          <h3 style={{ margin: "0 0 8px", color: "#334155" }}>{cat.label}</h3>
          {cat.forms.length === 0 && <div style={{ color: "#94a3b8", fontSize: 14 }}>No templates yet.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 }}>
            {cat.forms.map((f) => (
              <button key={f.id} style={card} onClick={() => openTemplate(f)}>
                <div style={{ fontWeight: 600 }}>{f.name}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{f.fillable ? "Fillable" : "Overlay"}</div>
              </button>
            ))}
          </div>
        </section>
      ))}
      <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 28 }}>{PRACTICE.name} · {PRACTICE.address}</p>
    </div>
  );
}

const btn = { padding: "8px 14px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 6 };
const card = { textAlign: "left", padding: 14, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer" };
