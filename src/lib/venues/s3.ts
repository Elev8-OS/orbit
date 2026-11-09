import { createHash, createHmac } from "node:crypto";

// Minimaler S3-Zugriff (AWS Signature V4) für den Railway-Bucket. Bewusst ohne SDK:
// keine neue Abhängigkeit, kein Eingriff in die Lock-Datei. Der Bucket nutzt Virtual-Host-Adressen.

type Cfg = { endpoint: string; bucket: string; region: string; key: string; secret: string };

function cfg(): Cfg | null {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const key = process.env.S3_ACCESS_KEY_ID;
  const secret = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !key || !secret) return null;
  return { endpoint, bucket, key, secret, region: process.env.S3_REGION || "auto" };
}

export function storageConfigured(): boolean {
  return cfg() !== null;
}

const sha256 = (d: string | Uint8Array) => createHash("sha256").update(d).digest("hex");
const hmac = (k: string | Buffer, d: string) => createHmac("sha256", k).update(d).digest();
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const encPath = (p: string) => p.split("/").map(enc).join("/");

function sign(method: "GET" | "PUT" | "DELETE", objectKey: string, body?: Uint8Array, contentType?: string) {
  const c = cfg();
  if (!c) throw new Error("storage not configured");
  const base = new URL(c.endpoint);
  const host = `${c.bucket}.${base.host}`;
  const path = "/" + encPath(objectKey);
  const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amz.slice(0, 8);
  const payloadHash = sha256(body ?? "");

  const signedHeaders: Record<string, string> = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amz };
  if (contentType) signedHeaders["content-type"] = contentType;
  const names = Object.keys(signedHeaders).sort();
  const canonicalHeaders = names.map((n) => `${n}:${signedHeaders[n]}\n`).join("");
  const canonical = [method, path, "", canonicalHeaders, names.join(";"), payloadHash].join("\n");
  const scope = `${day}/${c.region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amz, scope, sha256(canonical)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac("AWS4" + c.secret, day), c.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");

  // Der Host-Header wird von fetch selbst gesetzt und darum nicht mitgeschickt.
  const headers: Record<string, string> = {
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
    authorization: `AWS4-HMAC-SHA256 Credential=${c.key}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`
  };
  if (contentType) headers["content-type"] = contentType;
  return { url: `${base.protocol}//${host}${path}`, headers };
}

export async function putObject(objectKey: string, body: Buffer, contentType: string): Promise<void> {
  const bytes = new Uint8Array(body);
  const { url, headers } = sign("PUT", objectKey, bytes, contentType);
  const res = await fetch(url, { method: "PUT", headers, body: bytes });
  if (!res.ok) throw new Error(`storage put failed: ${res.status}`);
}

/** extra: unsignierte Zusatz-Header, z. B. Range für Teilabrufe (Videos in Safari) */
export async function getObject(objectKey: string, extra?: Record<string, string>): Promise<Response> {
  const { url, headers } = sign("GET", objectKey);
  return fetch(url, { headers: { ...headers, ...extra } });
}

export async function deleteObject(objectKey: string): Promise<void> {
  const { url, headers } = sign("DELETE", objectKey);
  const res = await fetch(url, { method: "DELETE", headers });
  if (!res.ok && res.status !== 404) throw new Error(`storage delete failed: ${res.status}`);
}
