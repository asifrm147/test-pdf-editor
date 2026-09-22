// api/chart/ensure.js — find-or-create a chart from {name,dob,phone,claim}.
// The upload flow calls this BEFORE opening the editor, so an uploaded form is
// always filed to a known patient. Vercel handler.
import { ensureChart } from "../../lib/chart/knackChart.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { name, dob, phone, claim } = req.body || {};
    if (!claim || !name) return res.status(400).json({ error: "name and claim are required" });
    const { record, created } = await ensureChart({ claim, name, dob, phone });
    return res.status(200).json({ ok: true, recordId: record.id, created });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
