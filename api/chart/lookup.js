// api/chart/lookup.js — prefill: given a claim number, return {name,dob} if a chart exists,
// so the provider doesn't re-enter info that's already saved.
// Vercel: export default handler. (Next App Router variant noted in BUILD.md.)
import { findPatientByClaim } from "../../lib/chart/knackChart.js";
import { KNACK } from "../../config/formsConfig.js";

export default async function handler(req, res) {
  try {
    const claim = (req.query?.claim || req.body?.claim || "").toString().trim();
    if (!claim) return res.status(400).json({ error: "claim required" });
    const rec = await findPatientByClaim(claim);
    if (!rec) return res.status(200).json({ found: false });
    return res.status(200).json({
      found: true,
      recordId: rec.id,
      name: rec[`${KNACK.fields.name}_raw`] ?? rec[KNACK.fields.name] ?? "",
      dob: rec[KNACK.fields.dob] ?? "",
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
