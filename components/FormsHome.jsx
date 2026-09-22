// components/FormsHome.jsx — Forms area (APF / Prior Auth / Assessments / BHI) + upload.
// Templates open straight into the editor. Uploads first require patient identity
// (name, DOB, phone, claim) so the form is filed to a chart (created if needed).
import React, { useState } from "react";
import { FORM_CATEGORIES, PRACTICE } from "../config/catalog.js";
import FormEditor from "./FormEditor.jsx";
import SendDialog from "./SendDialog.jsx";
import PatientDialog from "./PatientDialog.jsx";

// TODO: wire to Lemonade's auth — return the logged-in provider's legal name + email.
function useCurrentUser() { return { legalName: "", email: "" }; }

export default function FormsHome() {
  const currentUser = useCurrentUser();
  const [editing, setEditing] = useState(null); // { source, formType, patient|null }
  const [pending, setPending] = useState(null);  // { bytes, filename, formType, patient|null }
  const [uploadFile, setUploadFile] = useState(null); // File awaiting patient identity

  const openTemplate = (form) =>
    setEditing({ source: { url: `/templates/${form.template}`, filename: form.template }, formType: form.name, patient: null });

  // Upload: hold the file until identity is captured, then open the editor with it.
  const onPatientConfirmed = ({ patient }) => {
    const file = uploadFile; setUploadFile(null);
    const reader = new FileReader();
    reader.onload = () => setEditing({ source: { bytes: reader.result, filename: file.name }, formType: file.name.replace(/\.pdf$/i, ""), patient });
    reader.readAsArrayBuffer(file);
  };

  if (editing) {
    return (
      <>
        <FormEditor
          source={editing.source}
          currentUser={currentUser}
          onSave={({ bytes, filename }) => setPending({ bytes, filename, formType: editing.formType, patient: editing.patient })}
          onCancel={() => setEditing(null)}
        />
        {pending && (
          <SendDialog
            pdfBytes={pending.bytes} filename={pending.filename} formType={pending.formType}
            provider={currentUser} patient={pending.patient}
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
          <input type="file" accept="application/pdf" hidden onChange={(e) => e.target.files[0] && setUploadFile(e.target.files[0])} />
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
              </button>
            ))}
          </div>
        </section>
      ))}
      <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 28 }}>{PRACTICE.name} · {PRACTICE.address}</p>

      {uploadFile && (
        <PatientDialog
          title="Who is this uploaded form for?"
          onClose={() => setUploadFile(null)}
          onConfirm={onPatientConfirmed}
        />
      )}
    </div>
  );
}
const btn = { padding: "8px 14px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 6 };
const card = { textAlign: "left", padding: 14, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer" };
