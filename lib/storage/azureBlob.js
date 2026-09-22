// lib/storage/azureBlob.js — Azure Blob for completed PDFs + secure links.
// MOCK MODE: if AZURE_STORAGE_CONNECTION_STRING is unset, reads/writes ./.mock/blobs
// and returns local URLs, so the app runs with no Azure account.
import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from "@azure/storage-blob";
import { AZURE } from "../../config/formsConfig.js";
import { promises as fs } from "fs";
import path from "path";

const MOCK = !AZURE.connectionString;
const MOCK_DIR = path.resolve(".mock/blobs");
const MOCK_BASE = process.env.MOCK_BASE || "http://localhost:8787";
const safe = (k) => k.replace(/[^\w.-]/g, "_");

function service() { return BlobServiceClient.fromConnectionString(AZURE.connectionString); }

export async function saveCompletedPdf(buffer, key) {
  if (MOCK) { await fs.mkdir(MOCK_DIR, { recursive: true }); await fs.writeFile(path.join(MOCK_DIR, safe(key)), buffer); return { key }; }
  const c = service().getContainerClient(AZURE.container); await c.createIfNotExists();
  await c.getBlockBlobClient(key).uploadData(buffer, { blobHTTPHeaders: { blobContentType: "application/pdf" } });
  return { key };
}
export async function getCompletedPdf(key) {
  if (MOCK) return fs.readFile(path.join(MOCK_DIR, safe(key)));
  return service().getContainerClient(AZURE.container).getBlockBlobClient(key).downloadToBuffer();
}
export function secureLink(key) {
  if (MOCK) return `${MOCK_BASE}/mock-blob/${safe(key)}`;
  const cs = AZURE.connectionString;
  const account = /AccountName=([^;]+)/.exec(cs)?.[1], accountKey = /AccountKey=([^;]+)/.exec(cs)?.[1];
  const cred = new StorageSharedKeyCredential(account, accountKey);
  const expiresOn = new Date(Date.now() + AZURE.sasTtlMinutes * 60 * 1000);
  const sas = generateBlobSASQueryParameters({ containerName: AZURE.container, blobName: key, permissions: BlobSASPermissions.parse("r"), expiresOn }, cred).toString();
  return `https://${account}.blob.core.windows.net/${AZURE.container}/${encodeURIComponent(key)}?${sas}`;
}
