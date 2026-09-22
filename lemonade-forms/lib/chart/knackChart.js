// lib/chart/knackChart.js — Knack match-or-create chart.
// MOCK MODE: if KNACK_APP_ID is unset, uses ./.mock/charts.json as the store.
import { KNACK } from "../../config/formsConfig.js";
import { promises as fs } from "fs";
import path from "path";

const MOCK = !KNACK.appId;
const MOCK_FILE = path.resolve(".mock/charts.json");
const headers = () => ({ "X-Knack-Application-Id": KNACK.appId, "X-Knack-REST-API-Key": KNACK.restApiKey, "Content-Type": "application/json" });
const objUrl = () => `${KNACK.apiBase}/objects/${KNACK.patientsObject}/records`;

async function mockRead() { try { return JSON.parse(await fs.readFile(MOCK_FILE, "utf8")); } catch { return []; } }
async function mockWrite(a) { await fs.mkdir(path.dirname(MOCK_FILE), { recursive: true }); await fs.writeFile(MOCK_FILE, JSON.stringify(a, null, 2)); }

export async function findPatientByClaim(claim) {
  if (MOCK) return (await mockRead()).find((r) => r[KNACK.fields.claimNumber] === claim) || null;
  const filters = encodeURIComponent(JSON.stringify({ match: "and", rules: [{ field: KNACK.fields.claimNumber, operator: "is", value: claim }] }));
  const res = await fetch(`${objUrl()}?filters=${filters}&rows_per_page=1`, { headers: headers() });
  if (!res.ok) throw new Error(`Knack find failed: ${res.status}`);
  return (await res.json()).records?.[0] || null;
}
export async function createPatient({ claim, name, dob }) {
  if (MOCK) { const a = await mockRead(); const rec = { id: "mock_" + Date.now(), [KNACK.fields.claimNumber]: claim, [KNACK.fields.name]: name, [KNACK.fields.dob]: dob, notes: [] }; a.push(rec); await mockWrite(a); return rec; }
  const body = { [KNACK.fields.claimNumber]: claim, [KNACK.fields.name]: name, [KNACK.fields.dob]: dob };
  const res = await fetch(objUrl(), { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Knack create failed: ${res.status} ${await res.text()}`);
  return res.json();
}
export async function ensureChart({ claim, name, dob }) {
  const existing = await findPatientByClaim(claim);
  if (existing) return { record: existing, created: false };
  return { record: await createPatient({ claim, name, dob }), created: true };
}
export async function attachCompletedForm(recordId, meta) {
  const note = `${new Date().toISOString()} · ${meta.formType} · ${meta.filename}` + (meta.faxId ? ` · fax ${meta.faxId}` : "") + ` · ${meta.secureLink}`;
  if (MOCK) { const a = await mockRead(); const r = a.find((x) => x.id === recordId); if (r) { (r.notes ||= []).push(note); await mockWrite(a); } return { ok: true }; }
  const body = { [KNACK.fields.documentsConnection]: note };
  const res = await fetch(`${objUrl()}/${recordId}`, { method: "PUT", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Knack attach failed: ${res.status} ${await res.text()}`);
  return res.json();
}
