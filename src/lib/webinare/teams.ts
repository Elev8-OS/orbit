/**
 * Microsoft Graph (App-Berechtigung) für Teams-Webinare: Sitzungen, Teilnahmelink und Teilnahmeberichte.
 * Nutzt die Orbit-App-Registrierung (AUTH_MICROSOFT_ENTRA_ID_ID/_SECRET/_ISSUER).
 * Nötige Anwendungsberechtigungen mit Admin-Zustimmung:
 *   VirtualEvent.Read.All                       – Webinare, Sitzungen, Teilnahmeberichte lesen
 *   VirtualEventRegistration-Anon.ReadWrite.All – Anmeldungen anlegen (nutzt das Portal)
 */

function tenantId(): string {
  const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ?? "";
  return process.env.MS_TENANT_ID || issuer.match(/microsoftonline\.com\/([^/]+)/)?.[1] || "";
}

export function teamsConfigured(): boolean {
  return Boolean(tenantId() && process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET);
}

let cached: { token: string; exp: number } | null = null;

async function token(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const res = await fetch(`https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? "",
      client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? "",
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials"
    }),
    cache: "no-store"
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!json.access_token) throw new Error(`Microsoft-Anmeldung fehlgeschlagen: ${json.error_description ?? res.status}`);
  cached = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

async function graph<T>(path: string): Promise<T> {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${await token()}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000)
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok || !json) throw new Error(`Microsoft Graph ${res.status}: ${json?.error?.message ?? "keine Antwort"}`);
  return json;
}

type GraphDate = { dateTime: string; timeZone: string };
const toDate = (d?: GraphDate) => (d ? new Date(d.dateTime.endsWith("Z") ? d.dateTime : `${d.dateTime}Z`) : null);

export type TeamsSession = { id: string; start: Date | null; end: Date | null; joinWebUrl: string | null };
export type TeamsAttendance = { email: string; name: string; seconds: number };

export async function teamsWebinar(webinarId: string): Promise<{ displayName: string; sessions: TeamsSession[] }> {
  const w = await graph<{ displayName?: string }>(`/solutions/virtualEvents/webinars/${encodeURIComponent(webinarId)}`);
  const s = await graph<{ value: { id: string; startDateTime?: GraphDate; endDateTime?: GraphDate; joinWebUrl?: string }[] }>(
    `/solutions/virtualEvents/webinars/${encodeURIComponent(webinarId)}/sessions`
  );
  return {
    displayName: w.displayName ?? "",
    sessions: s.value.map((x) => ({ id: x.id, start: toDate(x.startDateTime), end: toDate(x.endDateTime), joinWebUrl: x.joinWebUrl ?? null }))
  };
}

/** Teilnahme über alle Sitzungen, pro E-Mail summiert. */
export async function teamsAttendance(webinarId: string): Promise<{ records: TeamsAttendance[]; sessions: TeamsSession[] }> {
  const { sessions } = await teamsWebinar(webinarId);
  const byEmail = new Map<string, TeamsAttendance>();
  for (const s of sessions) {
    let next: string | null = `/solutions/virtualEvents/webinars/${encodeURIComponent(webinarId)}/sessions/${encodeURIComponent(s.id)}/attendanceRecords`;
    while (next) {
      const page: {
        value: { emailAddress?: string; totalAttendanceInSeconds?: number; identity?: { displayName?: string } }[];
        "@odata.nextLink"?: string;
      } = await graph(next);
      for (const r of page.value) {
        const email = (r.emailAddress ?? "").toLowerCase();
        if (!email) continue;
        const prev = byEmail.get(email);
        byEmail.set(email, { email, name: r.identity?.displayName ?? prev?.name ?? "", seconds: (prev?.seconds ?? 0) + (r.totalAttendanceInSeconds ?? 0) });
      }
      next = page["@odata.nextLink"]?.replace("https://graph.microsoft.com/v1.0", "") ?? null;
    }
  }
  return { records: [...byEmail.values()], sessions };
}
