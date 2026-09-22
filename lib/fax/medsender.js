// lib/fax/medsender.js — Medsender REST implementation (api.medsender.com/api/v2).
// No SDK needed: multipart POST /sent_faxes with Bearer auth. Node 18+ has global
// fetch/FormData/Blob, which Vercel provides.
import { FAX } from "../../config/formsConfig.js";

export async function medsenderSendFax({ toFaxNumber, pdfBase64, filename }) {
  if (!FAX.medsender.apiKey) { console.log("[mock] medsender fax to", toFaxNumber); return { faxId: "mock_fax_" + Date.now(), provider: "medsender(mock)" }; }
  if (!FAX.medsender.sendFrom) throw new Error("MEDSENDER_FAX_NUMBER not set");

  const form = new FormData();
  const buf = Buffer.from(pdfBase64, "base64");
  form.append("file", new Blob([buf], { type: "application/pdf" }), filename || "form.pdf");
  form.append("from_number", FAX.medsender.sendFrom);
  form.append("to_number", toFaxNumber);
  // Optional: client reference / metadata fields per the Sent Faxes doc can be
  // appended here (e.g. the claim number) once you confirm the field name.

  const res = await fetch(`${FAX.medsender.apiBase}/sent_faxes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${FAX.medsender.apiKey}` }, // no Content-Type: FormData sets the boundary
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Medsender sendFax failed: ${res.status} ${data?.message || JSON.stringify(data)}`);
  // Response shape: { message, faxId }
  return { faxId: data.faxId, provider: "medsender" };
}
