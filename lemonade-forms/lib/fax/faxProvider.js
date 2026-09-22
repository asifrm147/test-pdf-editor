// lib/fax/faxProvider.js — vendor-agnostic fax interface + selector.
// Swap vendors by changing FAX_PROVIDER; the rest of the app only calls sendFax().
import { FAX } from "../../config/formsConfig.js";
import { medsenderSendFax } from "./medsender.js";

/**
 * sendFax({ toFaxNumber, pdfBase64, filename, clientReference })
 *   toFaxNumber:     E.164 string, e.g. "+13609024567"
 *   pdfBase64:       base64 (no data: prefix) of the completed PDF
 *   filename:        e.g. "F242-397-completed.pdf"
 *   clientReference: internal ref (claim number) — used where the vendor supports it
 * returns { faxId, provider }
 */
export async function sendFax(args) {
  switch (FAX.provider) {
    case "medsender":
      return medsenderSendFax(args);
    // case "notifyre": return notifyreSendFax(args);  // same-company alt surface
    default:
      throw new Error(`Unknown FAX_PROVIDER: ${FAX.provider}`);
  }
}
