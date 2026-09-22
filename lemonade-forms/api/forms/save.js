// api/forms/save.js — the orchestrator. One call does: store PDF (Azure) ->
// match/create chart (Knack) -> attach reference -> dispatch the chosen action.
// Vercel serverless handler. Body is JSON.
//
// Body: {
//   pdfBase64, filename, formType,
//   provider: { legalName, email },
//   patient: { claim, name, dob },
//   action: "download" | "fax_lni" | "fax_number" | "email",
//   destination: { faxNumber?, email? }
// }
import { saveCompletedPdf, secureLink } from "../../lib/storage/azureBlob.js";
import { ensureChart, attachCompletedForm } from "../../lib/chart/knackChart.js";
import { sendFax } from "../../lib/fax/faxProvider.js";
import { sendFormEmail } from "../../lib/email/gmailSend.js";
import { LNI_FAX_NUMBER } from "../../config/formsConfig.js";

const yyyymm = () => { const d = new Date(); return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}`; };
const uuid = () => (globalThis.crypto?.randomUUID?.() || Date.now() + "-" + Math.random().toString(36).slice(2));

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { pdfBase64, filename, formType, provider, patient, action, destination = {} } = req.body || {};
    if (!pdfBase64 || !patient?.claim) return res.status(400).json({ error: "pdfBase64 and patient.claim required" });

    const buffer = Buffer.from(pdfBase64, "base64");
    const key = `${yyyymm()}/${patient.claim}/${uuid()}-${(filename || "form.pdf").replace(/[^\w.-]/g, "_")}`;

    // 1) store the completed PDF (bytes live in Azure, not Knack)
    await saveCompletedPdf(buffer, key);
    const link = secureLink(key);

    // 2) chart match-or-create, then attach a lightweight reference
    const { record, created } = await ensureChart(patient);
    let faxResult = null, emailResult = null;

    // 3) dispatch the chosen action
    if (action === "fax_lni" || action === "fax_number") {
      const toFaxNumber = action === "fax_lni" ? LNI_FAX_NUMBER : destination.faxNumber;
      if (!toFaxNumber) return res.status(400).json({ error: "destination.faxNumber required" });
      faxResult = await sendFax({ toFaxNumber, pdfBase64, filename, clientReference: patient.claim });
    } else if (action === "email") {
      if (!destination.email) return res.status(400).json({ error: "destination.email required" });
      emailResult = await sendFormEmail({ to: destination.email, filename, pdfBase64, secureLink: link, formType });
    }

    await attachCompletedForm(record.id, {
      secureLink: link, filename, formType,
      faxId: faxResult?.faxId,
    });

    return res.status(200).json({
      ok: true,
      chart: { recordId: record.id, created },
      download: action === "download" ? link : undefined,
      fax: faxResult, email: emailResult,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
