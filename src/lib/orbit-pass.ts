import { SignJWT, exportJWK, exportPKCS8, generateKeyPair, importPKCS8, type JWK } from "jose";
import { sql } from "./db";

/**
 * Orbit-Pass: kurzlebiger, signierter Nachweis "diese Person ist in Orbit angemeldet und hat diese Rollen".
 * Liegt als Cookie auf der Hauptdomain (z.B. .elev8-suite.com), damit alle Tools auf Subdomains ihn lesen –
 * auch eingebettet als Tab. Die Tools prüfen ihn mit dem öffentlichen Schlüssel unter /api/pass/jwks
 * und können selbst keinen ausstellen.
 */
export const PASS_COOKIE = "orbit_pass";
export const PASS_AUDIENCE = "elev8-apps";
export const PASS_TTL_SECONDS = 60 * 60;

type KeyRow = { kid: string; private_pkcs8: string; public_jwk: JWK };
type SigningKey = { kid: string; privateKey: CryptoKey };

let cachedKey: Promise<SigningKey> | null = null;

async function loadOrCreateKey(): Promise<SigningKey> {
  let rows = await sql<KeyRow[]>`
    SELECT kid, private_pkcs8, public_jwk FROM signing_keys
    WHERE active ORDER BY created_at DESC LIMIT 1
  `;
  if (rows.length === 0) {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    const kid = crypto.randomUUID();
    const jwk = { ...(await exportJWK(publicKey)), kid, alg: "ES256", use: "sig" };
    await sql`
      INSERT INTO signing_keys (kid, private_pkcs8, public_jwk)
      VALUES (${kid}, ${await exportPKCS8(privateKey)}, ${sql.json(jwk)})
      ON CONFLICT (kid) DO NOTHING
    `;
    // Bei gleichzeitigem Erststart gewinnt der neueste Schlüssel; alle aktiven bleiben im JWKS gültig.
    rows = await sql<KeyRow[]>`
      SELECT kid, private_pkcs8, public_jwk FROM signing_keys
      WHERE active ORDER BY created_at DESC LIMIT 1
    `;
  }
  const row = rows[0];
  return { kid: row.kid, privateKey: await importPKCS8(row.private_pkcs8, "ES256") };
}

function signingKey(): Promise<SigningKey> {
  cachedKey ??= loadOrCreateKey().catch((err) => {
    cachedKey = null;
    throw err;
  });
  return cachedKey;
}

/** Öffentliche Schlüssel aller aktiven Signierschlüssel (für /api/pass/jwks). */
export async function publicJwks(): Promise<{ keys: JWK[] }> {
  await signingKey(); // stellt sicher, dass mindestens ein Schlüssel existiert
  const rows = await sql<{ public_jwk: JWK }[]>`SELECT public_jwk FROM signing_keys WHERE active`;
  return { keys: rows.map((r) => r.public_jwk) };
}

export function passIssuer(): string {
  return (process.env.AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export type PassUser = { id: string; email?: string | null; name?: string | null; roles: string[] };

export async function issuePass(user: PassUser): Promise<{ token: string; expiresAt: number }> {
  const { kid, privateKey } = await signingKey();
  const expiresAt = Math.floor(Date.now() / 1000) + PASS_TTL_SECONDS;
  const token = await new SignJWT({ email: user.email ?? "", name: user.name ?? "", roles: user.roles })
    .setProtectedHeader({ alg: "ES256", kid, typ: "JWT" })
    .setIssuer(passIssuer())
    .setAudience(PASS_AUDIENCE)
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(privateKey);
  return { token, expiresAt };
}

/**
 * Cookie-Domain für den Pass. ORBIT_PASS_DOMAIN hat Vorrang (z.B. ".elev8-suite.com"),
 * sonst die Hauptdomain aus AUTH_URL. Auf localhost gibt es keine Domain (nur Host-Cookie).
 */
export function passCookieDomain(): string | undefined {
  const configured = process.env.ORBIT_PASS_DOMAIN?.trim();
  if (configured) return configured;
  const host = new URL(passIssuer()).hostname;
  if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return undefined;
  const labels = host.split(".");
  return labels.length >= 2 ? `.${labels.slice(-2).join(".")}` : undefined;
}

export function passCookieOptions(maxAge: number) {
  return {
    domain: passCookieDomain(),
    path: "/",
    httpOnly: true,
    secure: passIssuer().startsWith("https://"),
    sameSite: "lax" as const,
    maxAge
  };
}
