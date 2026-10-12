import { createHash, randomBytes } from "node:crypto";
import { tenantId } from "@/lib/platform/entra";

/**
 * Postfach verbinden: Microsoft-Anmeldung mit delegierten Rechten (nur das eigene Postfach).
 * Nutzt die Orbit-App-Registrierung (oder ASSISTENT_CLIENT_ID/ASSISTENT_CLIENT_SECRET).
 * Einmalig in Entra: Redirect-URI <AUTH_URL>/api/assistent/callback (Web) und die delegierten
 * Graph-Berechtigungen Mail.ReadWrite, User.Read und offline_access ergänzen.
 */
export const SCOPES = ["openid", "profile", "email", "offline_access", "User.Read", "Mail.ReadWrite"];

const clientId = () => process.env.ASSISTENT_CLIENT_ID || process.env.AUTH_MICROSOFT_ENTRA_ID_ID || "";
const clientSecret = () => process.env.ASSISTENT_CLIENT_SECRET || process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET || "";
const tenant = () => tenantId() || "organizations";

export const redirectUri = () => `${(process.env.AUTH_URL || "http://localhost:3000").replace(/\/+$/, "")}/api/assistent/callback`;

/** Eingeschaltet mit ASSISTENT_ENABLED=true, sobald die Einrichtung in Entra erledigt ist (siehe docs/PLATTFORM.md). */
export function oauthConfigured(): boolean {
  return process.env.ASSISTENT_ENABLED === "true" && Boolean(clientId() && clientSecret() && process.env.ANTHROPIC_API_KEY);
}

export function newLoginRequest(loginHint?: string) {
  const state = randomBytes(18).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize`);
  url.search = new URLSearchParams({
    client_id: clientId(),
    response_type: "code",
    redirect_uri: redirectUri(),
    response_mode: "query",
    scope: SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...(loginHint ? { login_hint: loginHint } : {})
  }).toString();
  return { url: url.toString(), state, verifier };
}

export type Tokens = { accessToken: string; refreshToken: string | null; expiresIn: number };

async function tokenRequest(params: Record<string, string>): Promise<Tokens> {
  const res = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), scope: SCOPES.join(" "), ...params }),
    signal: AbortSignal.timeout(15_000)
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    const err = new Error(json.error_description?.split("\r\n")[0] || json.error || `HTTP ${res.status}`);
    (err as Error & { code?: string }).code = json.error;
    throw err;
  }
  return { accessToken: json.access_token, refreshToken: json.refresh_token ?? null, expiresIn: json.expires_in ?? 3600 };
}

export const exchangeCode = (code: string, verifier: string) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: verifier });

export const refresh = (refreshToken: string) => tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });

/** invalid_grant und ähnliche Fehler: Die Person muss ihr Postfach neu verbinden. */
export function needsReconnect(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === "invalid_grant" || code === "interaction_required" || code === "consent_required";
}

/** Cookie mit state und PKCE-Verifier während der Anmeldung */
export const OAUTH_COOKIE = "orbit_assistant_oauth";
