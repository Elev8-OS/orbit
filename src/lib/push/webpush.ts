import { createECDH, createCipheriv, generateKeyPairSync, hkdfSync, randomBytes } from "node:crypto";
import { SignJWT, importJWK, type JWK } from "jose";
import { sql } from "@/lib/db";

/**
 * Web Push nach RFC 8030/8291/8292, ohne Fremdpaket: VAPID-Anmeldung (ES256) und Verschlüsselung (aes128gcm).
 * Versand über die Push-Dienste der Browser (Apple, Google, Mozilla, Microsoft). Das Schlüsselpaar erzeugt
 * Orbit beim ersten Gebrauch selbst und speichert es in der Datenbank (Tabelle push_keys).
 */
const b64u = (buf: Buffer | Uint8Array) => Buffer.from(buf).toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

type Keys = { publicKey: string; privateJwk: JWK };
let keys: Promise<Keys> | null = null;

export function vapidKeys(): Promise<Keys> {
  keys ??= (async () => {
    const [row] = await sql<{ public_key: string; private_jwk: JWK }[]>`SELECT public_key, private_jwk FROM push_keys WHERE id = 1`;
    if (row) return { publicKey: row.public_key, privateJwk: row.private_jwk };
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const jwk = privateKey.export({ format: "jwk" }) as JWK;
    const publicKey = b64u(Buffer.concat([Buffer.from([4]), fromB64u(jwk.x!), fromB64u(jwk.y!)]));
    // Bei zwei gleichzeitigen Starts gewinnt der erste Eintrag, beide lesen danach denselben
    await sql`INSERT INTO push_keys (id, public_key, private_jwk) VALUES (1, ${publicKey}, ${sql.json(jwk as never)}) ON CONFLICT (id) DO NOTHING`;
    const [saved] = await sql<{ public_key: string; private_jwk: JWK }[]>`SELECT public_key, private_jwk FROM push_keys WHERE id = 1`;
    return { publicKey: saved.public_key, privateJwk: saved.private_jwk };
  })().catch((err) => {
    keys = null;
    throw err;
  });
  return keys;
}

export type Subscription = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Verschlüsselt die Nachricht für ein Gerät (RFC 8291, ein einzelner Datensatz). */
export function encrypt(sub: Pick<Subscription, "p256dh" | "auth">, plaintext: Buffer) {
  const uaPublic = fromB64u(sub.p256dh);
  const authSecret = fromB64u(sub.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error("invalid_subscription_keys");
  const ecdh = createECDH("prime256v1");
  const asPublic = ecdh.generateKeys();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = randomBytes(16);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body]);
}

const jwtCache = new Map<string, { token: string; exp: number }>();

async function vapidHeader(endpoint: string): Promise<string> {
  const { publicKey, privateJwk } = await vapidKeys();
  const aud = new URL(endpoint).origin;
  const cached = jwtCache.get(aud);
  if (cached && cached.exp > Date.now() / 1000 + 600) return `vapid t=${cached.token}, k=${publicKey}`;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const subject = process.env.ORBIT_VAPID_SUBJECT || `mailto:${process.env.ORBIT_SUPPORT_EMAIL || "support@elev8-suite.com"}`;
  const key = await importJWK({ ...privateJwk, alg: "ES256" }, "ES256");
  const token = await new SignJWT({}).setProtectedHeader({ alg: "ES256", typ: "JWT" }).setAudience(aud).setExpirationTime(exp).setSubject(subject).sign(key);
  jwtCache.set(aud, { token, exp });
  return `vapid t=${token}, k=${publicKey}`;
}

export type SendResult = { ok: boolean; gone: boolean; status: number | null };

/** Sendet an ein Gerät. gone = das Gerät hat die Erlaubnis entzogen oder existiert nicht mehr (Eintrag löschen). */
export async function sendPush(sub: Subscription, payload: PushPayload, opts: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high" } = {}): Promise<SendResult> {
  try {
    const url = new URL(sub.endpoint);
    if (url.protocol !== "https:") return { ok: false, gone: true, status: null };
    const body = encrypt(sub, Buffer.from(JSON.stringify(payload)));
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: await vapidHeader(sub.endpoint),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(opts.ttl ?? 24 * 3600),
        Urgency: opts.urgency ?? "normal",
        ...(payload.tag ? { Topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) } : {})
      },
      body,
      signal: AbortSignal.timeout(10_000)
    });
    await res.body?.cancel().catch(() => {});
    return { ok: res.status >= 200 && res.status < 300, gone: res.status === 404 || res.status === 410, status: res.status };
  } catch (err) {
    if (err instanceof Error && err.message === "invalid_subscription_keys") return { ok: false, gone: true, status: null };
    return { ok: false, gone: false, status: null };
  }
}
