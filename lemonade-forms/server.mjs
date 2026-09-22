// server.mjs — local API server for the test harness. Mounts the Vercel-style
// handlers and serves mock blobs. Runs in mock mode unless you set real env vars.
import express from "express";
import path from "path";
import { promises as fs } from "fs";
import saveHandler from "./api/forms/save.js";
import lookupHandler from "./api/chart/lookup.js";
import webhookHandler from "./api/fax/webhook.js";

const app = express();
app.use(express.json({ limit: "30mb" })); // completed PDFs (base64) can be large

app.post("/api/forms/save", (req, res) => saveHandler(req, res));
app.get("/api/chart/lookup", (req, res) => lookupHandler(req, res));
app.post("/api/fax/webhook", (req, res) => webhookHandler(req, res));

app.get("/mock-blob/:key", async (req, res) => {
  try { const b = await fs.readFile(path.resolve(".mock/blobs", req.params.key)); res.type("application/pdf").send(b); }
  catch { res.status(404).send("not found"); }
});

const PORT = process.env.API_PORT || 8787;
app.listen(PORT, () => console.log(`API (mock-capable) on http://localhost:${PORT}`));
