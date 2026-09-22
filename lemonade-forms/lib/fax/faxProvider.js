// lib/fax/faxProvider.js — vendor-agnostic fax interface + selector.
// Change FAX_PROVIDER to switch; callers only use sendFax().
import { FAX } from "../../config/formsConfig.js";
import { sinchSendFax } from "./sinch.js";
import { medsenderSendFax } from "./medsender.js";

/**
 * sendFax({ toFaxNumber, pdfBase64, filename, clientReference }) -> { faxId, provider }
 */
export async function sendFax(args) {
  switch (FAX.provider) {
    case "sinch": return sinchSendFax(args);
    case "medsender": return medsenderSendFax(args);
    default: throw new Error(`Unknown FAX_PROVIDER: ${FAX.provider}`);
  }
}
