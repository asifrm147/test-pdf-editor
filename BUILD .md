# Lemonade Forms — build handoff

A HIPAA-oriented PDF form tool inside Lemonade: providers open (or upload) a form,
fill it, sign it, and then **download / fax to L&I / fax to a number / email** it — with a
copy filed to the patient's chart (matched or created by claim #).

This package is a **drop-in scaffold**. The logic is complete; you wire five external
accounts via env + confirm a handful of Knack field keys. Nothing was integration-tested
inside the live app yet, so treat the first run as wiring + a smoke test.

---

## Run it standalone (test env, no credentials)

This package includes a small harness so you can boot it on its own:

```
npm install
npm run dev          # API on :8787 (mock) + Vite UI on :5173
# open http://localhost:5173
```

**Mock mode** is automatic when the cloud env vars are unset: Medsender, Azure, Knack,
and Gmail are stubbed (fax returns a fake id, PDFs save to `./.mock/blobs`, charts persist
to `./.mock/charts.json`, email is logged). So the full flow — open form → fill → save →
match/create chart → fax/email/download — works locally with nothing to sign up for.
Smoke-tested: save→chart-create→download, then a second save that reuses the same chart
and mock-faxes L&I, both logged to the chart.

Flip any subsystem to **live** by setting its env vars (e.g. `MEDSENDER_API_KEY=sk_test_…`
+ `MEDSENDER_FAX_NUMBER=…` makes faxes hit the real Medsender sandbox). Mix and match.

---

## What's done in here

- **Two flat forms converted to fillable** — `PHQ-4-fillable.pdf` (17 fields) and
  `GCPS-fillable.pdf` (28 fields). They now behave like the four native L&I forms.
- **Editor** (`components/FormEditor.jsx`) — renders any PDF; native fill layer on the
  fillable forms, click-to-place text/checkmark/signature on flat or uploaded PDFs;
  draw-once-reuse signature; auto **"Submitted by …"** stamp; flattens on save.
- **Send/save pipeline** (`api/forms/save.js`) — store PDF → chart match/create → attach
  reference → dispatch fax/email/download, in one call.
- **Fax** — Sinch Fax API v3 (`POST /v3/projects/{projectId}/faxes`, multipart, Basic auth);
  free self-serve BAA in the Sinch Build dashboard. Vendor-pluggable via `lib/fax/faxProvider.js`
  (Medsender kept as a drop-in alternate: `FAX_PROVIDER=medsender`).
- **Storage** — Azure Blob for the PDF bytes + time-limited **secure links** (keeps heavy
  files off the Knack API budget).
- **Chart** — Knack match-on-claim / create / attach.
- **Email** — Gmail (Workspace, as `noreply@`): attachment for internal recipients,
  **secure link** for external ones (PHI never sits in an outside inbox).
- **UI** — `FormsHome.jsx` (category buckets + upload), `SendDialog.jsx` (three actions only:
  Fax to L&I / Fax to a number / Email), and `PatientDialog.jsx`. Editor has a Back button.
- **Uploads are gated** — uploading a PDF first requires name, DOB, phone, and claim #, then
  finds-or-creates the chart (`/api/chart/ensure`) before the form opens, so nothing files unfiled.

## Data flow

```
FormEditor  →  onSave(bytes)  →  SendDialog (claim/name/DOB + action)
                                     │  POST /api/forms/save
                                     ▼
        Azure Blob (bytes + secure link) ─┐
        Knack ensureChart(claim→match/create) ─┤→ attach reference to chart
        action: fax(Notifyre) | email(Gmail) | download(secure link)
```

## Wire this (checklist)

1. **Install deps** (see `package.json`):
   `npm i @azure/storage-blob googleapis pdf-lib pdfjs-dist react-signature-canvas`  (Medsender needs no SDK — native fetch/FormData)
2. **Env** — copy `.env.example` into Vercel project env. Set the **Sinch** project id, API
   key/secret, and fax number (all from the Sinch Build dashboard, where you also sign the free BAA).
3. **Knack keys** — in `config/formsConfig.js`, replace the `field_TODO_*` values and
   confirm the Patients object key. If your patient name is split first/last, adjust
   `createPatient()` in `lib/chart/knackChart.js`.
4. **Gmail** — create a Workspace service account with domain-wide delegation for the
   `gmail.send` scope, authorized to impersonate `noreply@psychiatrygroup.com`.
5. **Auth** — fill in `useCurrentUser()` in `FormsHome.jsx` to return the logged-in
   provider's `{ legalName, email }` (drives the stamp + attribution). Also wire
   `savedSignatureUrl` / `onSaveSignature` on `FormEditor` to the provider's account record.
6. **Templates** — the six blanks are in `public/templates/`. Serve them there, or point
   the catalog at your CDN/Knack.
7. **Webhook** (optional) — set `api/fax/webhook` as the Notifyre delivery webhook.

## Bundler note (Vite vs Next)

- `FormEditor.jsx` loads the pdf.js worker with `?url` (**Vite**). For **Next.js**, copy
  `pdf.worker.min.mjs` into `/public` and set `GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"`.
- `api/*.js` are written as Vercel Node handlers (`export default (req,res)`). On Next App
  Router, wrap each as a route handler (`export async function POST(req)`), same logic.

## Test with Sinch

1. Set `SINCH_PROJECT_ID`, `SINCH_API_KEY`, `SINCH_API_SECRET`, `SINCH_FAX_NUMBER` from the
   Build dashboard. In the dashboard's HIPAA section, uncheck both storage boxes and sign the BAA.
2. Sinch has a built-in test target: sending **to `+19898989898`** simulates a full fax with no
   charge. Point "Fax to a number" at it to validate end to end before faxing L&I for real.
3. `/api/forms/save` returns `{ fax: { faxId, status } }`; confirm in the Sinch dashboard.

**Webhook note:** Sinch delivery webhooks are `multipart/form-data` POSTs (not JSON) — `api/fax/webhook.js`
needs a multipart parser (e.g. `multer`) when you wire live status; the handler notes this.

## Known nit to nudge later

The three **GCPS visit-type checkboxes** (Initial/Middle/Final) sit right next to the form's
pre-printed squares — the scales, claim, date, and acupuncture-total fields are clean. To
seat them exactly, tweak the three `gcps_visit_*` x-values in the build script; ~±10pt does it.

## Still open (my questions, unblocked)

- Vite or Next? (fixes the worker line above)
- Knack Patients object + field keys (step 3)
- Whether external email should be secure-link (default) or a Paubox/Virtru encrypted send
- Confirm the Medsender BAA scope (it was sent when you signed up) covers the fax API usage
