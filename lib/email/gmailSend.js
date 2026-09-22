// lib/email/gmailSend.js — send as noreply@ via Google Workspace (BAA-covered).
// Internal recipients (same domain): PDF attached. External recipients: secure link,
// so PHI never sits in the external inbox.  npm i googleapis
import { google } from "googleapis";
import { PRACTICE, GMAIL } from "../../config/formsConfig.js";

function gmailClient() {
  const jwt = new google.auth.JWT({
    email: GMAIL.clientEmail,
    key: GMAIL.privateKey,
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
    subject: GMAIL.sendAs, // impersonate noreply@ via domain-wide delegation
  });
  return google.gmail({ version: "v1", auth: jwt });
}

const isInternal = (addr) => addr.trim().toLowerCase().endsWith(`@${PRACTICE.emailDomain}`);

function buildMime({ to, subject, text, attachment }) {
  const boundary = "b_" + Math.random().toString(36).slice(2);
  const head =
    `From: ${GMAIL.sendAs}\r\nTo: ${to}\r\nSubject: ${subject}\r\n` +
    `MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
  let body = `--${boundary}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${text}\r\n`;
  if (attachment) {
    body +=
      `--${boundary}\r\nContent-Type: application/pdf; name="${attachment.filename}"\r\n` +
      `Content-Transfer-Encoding: base64\r\n` +
      `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n` +
      `${attachment.base64}\r\n`;
  }
  body += `--${boundary}--`;
  return Buffer.from(head + body).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * sendFormEmail({ to, filename, pdfBase64, secureLink, formType })
 * Chooses attachment vs secure-link per recipient domain (and EMAIL_EXTERNAL_MODE).
 */
export async function sendFormEmail({ to, filename, pdfBase64, secureLink, formType }) {
  if (!GMAIL.clientEmail) { const internalM = isInternal(to); console.log("[mock] email to", to); return { id: "mock_email_" + Date.now(), mode: internalM ? "attachment" : "secure_link" }; }
  const gmail = gmailClient();
  const internal = isInternal(to);
  const useAttachment = internal || GMAIL.externalMode === "attachment";
  const subject = `${formType} — ${PRACTICE.name}`;
  const text = useAttachment
    ? `Attached: ${filename}.\n\n${PRACTICE.name}\n${PRACTICE.address}\n${PRACTICE.phone}`
    : `A document (${filename}) is ready for you. Open it here (link expires):\n${secureLink}\n\n` +
      `${PRACTICE.name}\n${PRACTICE.address}\n${PRACTICE.phone}`;

  const raw = buildMime({
    to, subject, text,
    attachment: useAttachment ? { filename, base64: pdfBase64 } : null,
  });
  const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return { id: res.data.id, mode: useAttachment ? "attachment" : "secure_link" };
}
