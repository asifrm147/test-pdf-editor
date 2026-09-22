// lib/fax/sinch.js — Sinch Fax API v3 (fax.api.sinch.com). Multipart POST, Basic auth.
// No SDK: native fetch/FormData/Blob (Node 18+). Free self-serve BAA via the Build dashboard.
import { FAX } from "../../config/formsConfig.js";

export async function sinchSendFax({ toFaxNumber, pdfBase64, filename }) {
  const { projectId, apiKey, apiSecret, sendFrom, baseUrl } = FAX.sinch;
  if (!apiKey) { console.log("[mock] sinch fax to", toFaxNumber); return { faxId: "mock_fax_" + Date.now(), provider: "sinch(mock)" }; }
  if (!projectId || !sendFrom) throw new Error("SINCH_PROJECT_ID and SINCH_FAX_NUMBER required");

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const form = new FormData();
  form.append("to", toFaxNumber);
  form.append("from", sendFrom);
  form.append("file", new Blob([Buffer.from(pdfBase64, "base64")], { type: "application/pdf" }), filename || "form.pdf");
  // Test: send to +19898989898 to simulate a fax without charging the account.

  const res = await fetch(`${baseUrl}/v3/projects/${projectId}/faxes`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` }, // FormData sets the multipart boundary
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Sinch sendFax failed: ${res.status} ${data?.message || JSON.stringify(data)}`);
  return { faxId: data.id || data.faxId, status: data.status, provider: "sinch" };
}
