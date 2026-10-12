import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Verschlüsselung für gespeicherte Geheimnisse (z.B. Refresh-Tokens der Postfächer), AES-256-GCM.
 * Schlüssel aus ORBIT_ENCRYPTION_KEY, sonst abgeleitet aus AUTH_SECRET.
 * Achtung: Wird der Schlüssel geändert, müssen alle Postfächer neu verbunden werden.
 */
function key(): Buffer {
  const secret = process.env.ORBIT_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) throw new Error("ORBIT_ENCRYPTION_KEY oder AUTH_SECRET fehlt");
  return createHash("sha256").update(`orbit-secrets:${secret}`).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unbekanntes Format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
