/**
 * Rollen in Entra direkt aus Orbit vergeben und entziehen (Microsoft Graph, App-Berechtigung).
 *
 * Eingeschaltet mit ORBIT_ROLE_MANAGEMENT=graph. Voraussetzung in der Orbit-App-Registrierung:
 * API-Berechtigungen (Anwendung) "Application.Read.All" und "AppRoleAssignment.ReadWrite.All"
 * mit Administratorzustimmung. Ohne das zeigt Orbit die nötige Rolle an, zugewiesen wird im Entra Admin Center.
 *
 * Client-ID und Secret: ORBIT_GRAPH_CLIENT_ID/ORBIT_GRAPH_CLIENT_SECRET, sonst die der Orbit-Anmeldung.
 */
const GRAPH = "https://graph.microsoft.com/v1.0";

export function roleManagementEnabled(): boolean {
  return process.env.ORBIT_ROLE_MANAGEMENT === "graph" && Boolean(clientId() && clientSecret() && tenantId());
}

const clientId = () => process.env.ORBIT_GRAPH_CLIENT_ID || process.env.AUTH_MICROSOFT_ENTRA_ID_ID || "";
const clientSecret = () => process.env.ORBIT_GRAPH_CLIENT_SECRET || process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET || "";

/** Tenant aus ORBIT_GRAPH_TENANT_ID oder aus dem Issuer der Anmeldung (https://login.microsoftonline.com/<tid>/v2.0). */
export function tenantId(): string {
  if (process.env.ORBIT_GRAPH_TENANT_ID) return process.env.ORBIT_GRAPH_TENANT_ID;
  const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER || "";
  return issuer.match(/microsoftonline\.com\/([0-9a-f-]{36})/i)?.[1] ?? "";
}

let token: { value: string; expires: number } | null = null;

async function appToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const res = await fetch(`https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials"
    }),
    signal: AbortSignal.timeout(10_000)
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(`Entra-Token: ${json.error_description ?? res.status}`);
  token = { value: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return token.value;
}

async function graph<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await appToken()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000)
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Graph ${res.status}: ${json.error?.message ?? "Fehler"}`);
  return json;
}

type AppRole = { id: string; value: string | null; displayName: string; isEnabled: boolean };
type ServicePrincipal = { id: string; appRoles: AppRole[] };

let sp: { value: ServicePrincipal; at: number } | null = null;

async function servicePrincipal(): Promise<ServicePrincipal> {
  if (sp && Date.now() - sp.at < 10 * 60_000) return sp.value;
  const value = await graph<ServicePrincipal>(`/servicePrincipals(appId='${clientId()}')?$select=id,appRoles`);
  sp = { value, at: Date.now() };
  return value;
}

export type EntraRole = { id: string; value: string; name: string };

/** Alle App Roles der Orbit-App-Registrierung. */
export async function listRoles(): Promise<EntraRole[]> {
  const s = await servicePrincipal();
  return s.appRoles
    .filter((r) => r.isEnabled && r.value)
    .map((r) => ({ id: r.id, value: r.value!, name: r.displayName }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

export type Assignment = { id: string; principalId: string; principalName: string; principalType: string; role: string };

/** Alle Rollenzuweisungen der Orbit-App (Personen und Gruppen). */
export async function listAssignments(): Promise<Assignment[]> {
  const s = await servicePrincipal();
  const roleById = new Map(s.appRoles.map((r) => [r.id, r.value ?? "(Standardzugriff)"]));
  const out: Assignment[] = [];
  let next: string | null = `/servicePrincipals/${s.id}/appRoleAssignedTo?$top=999`;
  while (next) {
    const page: { value: { id: string; principalId: string; principalDisplayName: string; principalType: string; appRoleId: string }[]; "@odata.nextLink"?: string } =
      await graph(next);
    for (const a of page.value) {
      out.push({ id: a.id, principalId: a.principalId, principalName: a.principalDisplayName, principalType: a.principalType, role: roleById.get(a.appRoleId) ?? a.appRoleId });
    }
    next = page["@odata.nextLink"] ? page["@odata.nextLink"].replace(GRAPH, "") : null;
  }
  return out;
}

/** Weist einer Person (Entra Object ID) eine App Role zu. Bereits vorhanden zählt als Erfolg. */
export async function assignRole(userId: string, roleValue: string): Promise<void> {
  const s = await servicePrincipal();
  const role = s.appRoles.find((r) => r.value === roleValue && r.isEnabled);
  if (!role) throw new Error(`Rolle ${roleValue} gibt es in der Orbit-App-Registrierung nicht`);
  const existing = (await listAssignments()).find((a) => a.principalId === userId && a.role === roleValue);
  if (existing) return;
  await graph(`/servicePrincipals/${s.id}/appRoleAssignedTo`, {
    method: "POST",
    body: JSON.stringify({ principalId: userId, resourceId: s.id, appRoleId: role.id })
  });
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  const s = await servicePrincipal();
  await graph(`/servicePrincipals/${s.id}/appRoleAssignedTo/${encodeURIComponent(assignmentId)}`, { method: "DELETE" });
}
