import { createHash, randomBytes } from "node:crypto";
import { sql } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/platform/crypto";
import { mcpCallTool } from "@/lib/portfolio/mcp";

/**
 * Orbit meldet sich selbst beim offiziellen myDataValue-MCP-Server an – wie Claude oder Codex:
 * OAuth 2.1 mit PKCE und automatischer Client-Registrierung, kein API-Key und kein Proxy.
 * Ablauf: „myDataValue verbinden“ → Anmeldung bei myDataValue (Team wählen, Zugriff bestätigen) → Callback.
 *
 * Der Refresh-Token rotiert. Orbit ist der einzige Halter: jede Erneuerung läuft in einer Transaktion mit
 * Zeilensperre (SELECT … FOR UPDATE), der neue Token wird sofort verschlüsselt gespeichert. So wird nie ein
 * alter Token erneut verwendet (myDataValue sperrt sonst die Verbindung).
 */

export const MDV_MCP_URL = () => (process.env.MDV_OFFICIAL_MCP_URL || "https://api.mydatavalue.com/mcp").replace(/\/+$/, "");
const base = () => (process.env.AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
export const redirectUri = () => `${base()}/api/portfolio/mdv/callback`;

type AsMeta = {
  issuer?: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  revocation_endpoint?: string;
  scopes_supported?: string[];
};
type Client = { client_id: string; client_secret?: string; auth_method: string; redirect_uri: string; as: AsMeta; resource: string; scopes: string[] };
type Tokens = {
  access_token: string;
  refresh_token: string | null;
  expires_at: number;
  scope?: string;
  connected_by: string;
  connected_at: string;
  team?: string | null;
  error?: string | null;
};

/* ---------- Speicher (verschlüsselt) ---------- */

async function load<T>(id: string): Promise<T | null> {
  const r = await sql<{ data: string }[]>`SELECT data FROM portfolio_oauth WHERE id = ${id}`;
  return r[0] ? (JSON.parse(decrypt(r[0].data)) as T) : null;
}
async function save(id: string, value: unknown) {
  const data = encrypt(JSON.stringify(value));
  await sql`INSERT INTO portfolio_oauth (id, data, updated_at) VALUES (${id}, ${data}, now())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
}
const remove = (id: string) => sql`DELETE FROM portfolio_oauth WHERE id = ${id}`;

/* ---------- Discovery nach MCP-Authorization-Spezifikation ---------- */

async function getJson(url: string) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

/** Liefert die Metadaten des Autorisierungsservers und die angebotenen Scopes. */
async function discover(): Promise<{ resource: string; as: AsMeta; scopes: string[] }> {
  const mcp = new URL(MDV_MCP_URL());
  // 1. Ohne Anmeldung anfragen: 401 mit WWW-Authenticate nennt die Resource-Metadaten
  let prmUrl: string | null = null;
  try {
    const probe = await fetch(mcp, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "orbit-portfolio", version: "1.0.0" } } }),
      signal: AbortSignal.timeout(15_000)
    });
    const h = probe.headers.get("www-authenticate") || "";
    prmUrl = /resource_metadata="([^"]+)"/i.exec(h)?.[1] ?? null;
  } catch {
    /* weiter mit den Standardadressen */
  }
  const path = mcp.pathname.replace(/\/+$/, "");
  const prmCandidates = [prmUrl, `${mcp.origin}/.well-known/oauth-protected-resource${path}`, `${mcp.origin}/.well-known/oauth-protected-resource`].filter(Boolean) as string[];
  let prm: Record<string, unknown> | null = null;
  for (const u of prmCandidates) if ((prm = await getJson(u))) break;
  const asUrl = new URL(String((prm?.authorization_servers as string[] | undefined)?.[0] ?? mcp.origin));
  const asPath = asUrl.pathname.replace(/\/+$/, "");
  const asCandidates = [
    `${asUrl.origin}/.well-known/oauth-authorization-server${asPath}`,
    `${asUrl.origin}/.well-known/openid-configuration${asPath}`,
    `${asUrl.origin}${asPath}/.well-known/openid-configuration`,
    `${asUrl.origin}/.well-known/oauth-authorization-server`
  ];
  let as: AsMeta | null = null;
  for (const u of [...new Set(asCandidates)]) {
    const j = await getJson(u);
    if (j?.authorization_endpoint && j?.token_endpoint) {
      as = j as unknown as AsMeta;
      break;
    }
  }
  if (!as) throw new Error("myDataValue: Anmelde-Metadaten nicht gefunden");
  // Nur lesende Scopes anfragen; Orbit ändert bei myDataValue nichts
  const offered = ((prm?.scopes_supported as string[] | undefined) ?? as.scopes_supported ?? []).filter((s) => !/^write|:write|admin/i.test(s));
  return { resource: String(prm?.resource ?? MDV_MCP_URL()), as, scopes: offered };
}

/** Registriert Orbit einmalig als Client (Dynamic Client Registration) und merkt sich das Ergebnis. */
async function ensureClient(): Promise<Client> {
  const existing = await load<Client>("mdv_client");
  if (existing && existing.redirect_uri === redirectUri()) return existing;
  const d = await discover();
  if (!d.as.registration_endpoint) throw new Error("myDataValue bietet keine automatische Registrierung an");
  const res = await fetch(d.as.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: "Elev8 Orbit – Portfolio Schweiz",
      redirect_uris: [redirectUri()],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      ...(d.scopes.length ? { scope: d.scopes.join(" ") } : {})
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const j = (await res.json().catch(() => ({}))) as { client_id?: string; client_secret?: string; token_endpoint_auth_method?: string; error_description?: string; error?: string };
  if (!res.ok || !j.client_id) throw new Error(`myDataValue-Registrierung: ${j.error_description || j.error || `HTTP ${res.status}`}`);
  const client: Client = {
    client_id: j.client_id,
    client_secret: j.client_secret,
    auth_method: j.token_endpoint_auth_method || (j.client_secret ? "client_secret_basic" : "none"),
    redirect_uri: redirectUri(),
    as: d.as,
    resource: d.resource,
    scopes: d.scopes
  };
  await save("mdv_client", client);
  return client;
}

/* ---------- Anmeldung ---------- */

export async function startConnect(userEmail: string): Promise<string> {
  const client = await ensureClient();
  const state = randomBytes(18).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  await sql`DELETE FROM portfolio_oauth WHERE id LIKE 'mdv_pending:%' AND updated_at < now() - interval '1 hour'`;
  await save(`mdv_pending:${state}`, { verifier, user: userEmail, at: Date.now() });
  const url = new URL(client.as.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: client.client_id,
    redirect_uri: client.redirect_uri,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: client.resource,
    ...(client.scopes.length ? { scope: client.scopes.join(" ") } : {})
  }).toString();
  return url.toString();
}

async function tokenRequest(client: Client, params: Record<string, string>) {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  const body: Record<string, string> = { ...params, resource: client.resource };
  if (client.client_secret && client.auth_method === "client_secret_basic") {
    headers.Authorization = "Basic " + Buffer.from(`${encodeURIComponent(client.client_id)}:${encodeURIComponent(client.client_secret)}`).toString("base64");
  } else {
    body.client_id = client.client_id;
    if (client.client_secret) body.client_secret = client.client_secret;
  }
  const res = await fetch(client.as.token_endpoint, { method: "POST", headers, body: new URLSearchParams(body), signal: AbortSignal.timeout(20_000) });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };
  if (!res.ok || !j.access_token) {
    const err = new Error(j.error_description || j.error || `HTTP ${res.status}`) as Error & { code?: string };
    err.code = j.error;
    throw err;
  }
  return j;
}

export async function finishConnect(code: string, state: string): Promise<{ team: string | null }> {
  const pending = await load<{ verifier: string; user: string; at: number }>(`mdv_pending:${state}`);
  await remove(`mdv_pending:${state}`);
  if (!pending || Date.now() - pending.at > 15 * 60_000) throw new Error("Anmeldung abgelaufen – bitte neu verbinden");
  const client = await ensureClient();
  const j = await tokenRequest(client, { grant_type: "authorization_code", code, redirect_uri: client.redirect_uri, code_verifier: pending.verifier });
  const tokens: Tokens = {
    access_token: j.access_token!,
    refresh_token: j.refresh_token ?? null,
    expires_at: Date.now() + (j.expires_in ?? 3600) * 1000,
    scope: j.scope,
    connected_by: pending.user,
    connected_at: new Date().toISOString(),
    team: null,
    error: null
  };
  await save("mdv_tokens", tokens);
  let team: string | null = null;
  try {
    const r = await mdvRunSql("SELECT name FROM team", "Orbit Portfolio-Modul: Verbindung zu myDataValue nach der Anmeldung prüfen und den Teamnamen anzeigen.");
    team = r.rows[0]?.name != null ? String(r.rows[0].name) : null;
  } catch {
    /* Teamname ist optional */
  }
  const cur = await load<Tokens>("mdv_tokens");
  if (cur) await save("mdv_tokens", { ...cur, team });
  return { team };
}

/* ---------- Zugriffstoken mit sicherer Erneuerung ---------- */

let inflight: Promise<string> | null = null;

async function refreshLocked(force: boolean): Promise<string> {
  const client = await load<Client>("mdv_client");
  if (!client) throw new Error("myDataValue nicht verbunden");
  return sql.begin(async (tx) => {
    const r = await tx<{ data: string }[]>`SELECT data FROM portfolio_oauth WHERE id = 'mdv_tokens' FOR UPDATE`;
    if (!r[0]) throw new Error("myDataValue nicht verbunden");
    const t = JSON.parse(decrypt(r[0].data)) as Tokens;
    if (t.error) throw new Error(t.error);
    // Eine andere Instanz hat inzwischen erneuert
    if (!force && t.expires_at - Date.now() > 120_000) return t.access_token;
    if (!t.refresh_token) throw new Error("myDataValue: Anmeldung abgelaufen – bitte neu verbinden");
    try {
      const j = await tokenRequest(client, { grant_type: "refresh_token", refresh_token: t.refresh_token });
      const next: Tokens = { ...t, access_token: j.access_token!, refresh_token: j.refresh_token ?? t.refresh_token, expires_at: Date.now() + (j.expires_in ?? 3600) * 1000, scope: j.scope ?? t.scope };
      await tx`UPDATE portfolio_oauth SET data = ${encrypt(JSON.stringify(next))}, updated_at = now() WHERE id = 'mdv_tokens'`;
      return next.access_token;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "invalid_grant" || code === "invalid_client" || code === "unauthorized_client") {
        const marked: Tokens = { ...t, error: `Anmeldung ungültig (${code}) – bitte „myDataValue verbinden“ erneut ausführen` };
        await tx`UPDATE portfolio_oauth SET data = ${encrypt(JSON.stringify(marked))}, updated_at = now() WHERE id = 'mdv_tokens'`;
      }
      throw err;
    }
  });
}

export async function accessToken(force = false): Promise<string> {
  if (!force) {
    const t = await load<Tokens>("mdv_tokens");
    if (!t) throw new Error("myDataValue nicht verbunden");
    if (t.error) throw new Error(t.error);
    if (t.expires_at - Date.now() > 120_000) return t.access_token;
  }
  if (!inflight) inflight = refreshLocked(force).finally(() => (inflight = null));
  return inflight;
}

export async function mdvConnected(): Promise<boolean> {
  try {
    const t = await load<Tokens>("mdv_tokens");
    return Boolean(t && !t.error);
  } catch {
    return false;
  }
}

export async function mdvStatus() {
  const t = await load<Tokens>("mdv_tokens").catch(() => null);
  if (!t) return { connected: false as const };
  return { connected: !t.error, team: t.team ?? null, connected_by: t.connected_by, connected_at: t.connected_at, error: t.error ?? null };
}

export async function disconnect() {
  const t = await load<Tokens>("mdv_tokens").catch(() => null);
  const client = await load<Client>("mdv_client").catch(() => null);
  if (t?.refresh_token && client?.as.revocation_endpoint) {
    const body: Record<string, string> = { token: t.refresh_token, token_type_hint: "refresh_token", client_id: client.client_id };
    if (client.client_secret) body.client_secret = client.client_secret;
    await fetch(client.as.revocation_endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body), signal: AbortSignal.timeout(10_000) }).catch(() => {});
  }
  await remove("mdv_tokens");
}

/* ---------- Abfragen ---------- */

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/<\/?untrusted-ota-text>/g, "") : v);

/** run_sql auf dem offiziellen Server; bei abgelaufenem Token einmal erneuern und wiederholen. */
export async function mdvRunSql(query: string, context: string, maxRows = 5000) {
  const args = { sql: query, context, llm_model: "unknown", max_rows: maxRows, max_bytes: 50_000 };
  let res: unknown;
  try {
    res = await mcpCallTool(MDV_MCP_URL(), await accessToken(), "run_sql", args, 120_000);
  } catch (err) {
    if (!/HTTP 401|unauthori[sz]ed|invalid_token/i.test(String((err as Error)?.message ?? err))) throw err;
    res = await mcpCallTool(MDV_MCP_URL(), await accessToken(true), "run_sql", args, 120_000);
  }
  const a = (typeof res === "string" ? JSON.parse(res) : res) as { columns?: string[]; rows?: unknown[][]; truncated?: boolean; error?: unknown };
  if (a?.error) throw new Error(`myDataValue: ${typeof a.error === "string" ? a.error : JSON.stringify(a.error)}`);
  if (!Array.isArray(a?.columns) || !Array.isArray(a?.rows)) throw new Error("myDataValue: unerwartete Antwort");
  const cols = a.columns.map((c) => String(clean(c)));
  return { rows: a.rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, clean(r[i])]))), truncated: Boolean(a.truncated) };
}
