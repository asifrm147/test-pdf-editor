// config/formsConfig.js — server config. Re-exports the browser-safe catalog and
// adds env-based settings (Knack/Azure/Medsender/Gmail). Edit the KNACK field keys.
export { PRACTICE, LNI_FAX_NUMBER, FORM_CATEGORIES } from "./catalog.js";

export const KNACK = {
  appId: process.env.KNACK_APP_ID,
  restApiKey: process.env.KNACK_REST_API_KEY,
  apiBase: "https://api.knack.com/v1",
  patientsObject: "object_3",               // TODO confirm
  fields: {
    claimNumber: "field_TODO_claim",        // TODO
    name: "field_TODO_name",                // TODO
    dob: "field_TODO_dob",                  // TODO
    phone: "field_TODO_phone",              // TODO
    isTestPatient: "field_TODO_testflag",   // optional
    documentsConnection: "field_TODO_docs", // TODO
  },
};
export const AZURE = {
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
  container: process.env.AZURE_BLOB_CONTAINER || "completed-forms",
  sasTtlMinutes: 60 * 24 * 7,
};
export const FAX = {
  provider: process.env.FAX_PROVIDER || "sinch",
  sinch: {
    baseUrl: process.env.SINCH_FAX_BASE || "https://fax.api.sinch.com",
    projectId: process.env.SINCH_PROJECT_ID,
    apiKey: process.env.SINCH_API_KEY,
    apiSecret: process.env.SINCH_API_SECRET,
    sendFrom: process.env.SINCH_FAX_NUMBER,   // your Sinch fax number (E.164)
  },
  medsender: {                                 // kept as same-company alternate
    apiBase: process.env.MEDSENDER_API_BASE || "https://api.medsender.com/api/v2",
    apiKey: process.env.MEDSENDER_API_KEY,
    sendFrom: process.env.MEDSENDER_FAX_NUMBER,
  },
};
export const GMAIL = {
  clientEmail: process.env.GMAIL_SA_CLIENT_EMAIL,
  privateKey: (process.env.GMAIL_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  sendAs: process.env.GMAIL_SEND_AS || "noreply@psychiatrygroup.com",
  externalMode: process.env.EMAIL_EXTERNAL_MODE || "secure_link",
};
