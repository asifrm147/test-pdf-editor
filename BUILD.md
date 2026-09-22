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
- **Fax** — Medsender REST API (`POST /sent_faxes`, multipart, Bearer key); vendor-pluggable
  via `lib/fax/faxProvider.js`. (Medsender & Notifyre are the same company — Notifyre is a
  drop-in alternate surface if you ever want it.)
- **Storage** — Azure Blob for the PDF bytes + time-limited **secure links** (keeps heavy
  files off the Knack API budget).
- **Chart** — Knack match-on-claim / create / attach.
- **Email** — Gmail (Workspace, as `noreply@`): attachment for internal recipients,
  **secure link** for external ones (PHI never sits in an outside inbox).
- **UI** — `FormsHome.jsx` (APF / Prior Auth / Assessments / BHI buckets + upload) and
  `SendDialog.jsx` (claim/name/DOB with chart pre-fill, action picker).

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
2. **Env** — copy `.env.example` into Vercel project env. Start with the **Medsender
   sandbox key** (`sk_test_…`) so you can test faxing with no PHI and no BAA-wait.
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

## Test with the Medsender sandbox

1. Provision a test fax number: `POST /fax_numbers` with `{"fax_number":{"area_code":"509"}}`;
   set `MEDSENDER_FAX_NUMBER` to the number it returns and `MEDSENDER_API_KEY` to your `sk_test_…`.
2. Open a form → fill → **Save** → in SendDialog choose **Fax to L&I** → Confirm.
3. `/api/forms/save` returns `{ fax: { faxId } }`; confirm it in the Medsender dashboard.
   Swap `sk_test_…` for the live key once the BAA scope is confirmed.

## Known nit to nudge later

The three **GCPS visit-type checkboxes** (Initial/Middle/Final) sit right next to the form's
pre-printed squares — the scales, claim, date, and acupuncture-total fields are clean. To
seat them exactly, tweak the three `gcps_visit_*` x-values in the build script; ~±10pt does it.

## Still open (my questions, unblocked)

- Vite or Next? (fixes the worker line above)
- Knack Patients object + field keys (step 3)
- Whether external email should be secure-link (default) or a Paubox/Virtru encrypted send
- Confirm the Medsender BAA scope (it was sent when you signed up) covers the fax API usage
