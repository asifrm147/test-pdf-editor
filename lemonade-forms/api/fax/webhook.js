// api/fax/webhook.js — Medsender delivery callback for sent faxes.
// Set this URL in the Medsender dashboard (Callbacks), or per-number via callbackUrl.
// Payload includes the faxId + final status.
export default async function handler(req, res) {
  try {
    const event = req.body || {}; // Vercel parses JSON by default
    // TODO: if Medsender signs callbacks, verify the signature header per their
    // Callbacks docs before trusting the payload.
    // TODO: update the chart note / a Fax Log with event.faxId + status.
    console.log("medsender callback", event?.faxId, event?.status || event?.message);
    return res.status(200).json({ received: true });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
