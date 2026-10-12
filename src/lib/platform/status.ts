import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { sql } from "@/lib/db";
import { recipientsFromEnv, sendMail } from "@/lib/mail/send";
import { renderEmail } from "@/lib/mail/layout";

/**
 * Statusseite und Alarme. Prüft die Dienste aus config/services.yaml (http und/oder Railway),
 * merkt sich den Zustand, eröffnet nach zwei Fehlschlägen in Folge eine Störung und meldet sie per E-Mail
 * (und optional Webhook). Ist der Dienst wieder da, wird die Störung geschlossen und die Entwarnung gesendet.
 */
const railwayRef = z.object({ project: z.string().uuid(), service: z.string().uuid(), environment: z.string().uuid() });
const serviceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    group: z.enum(["apps", "background", "integrations"]).default("background"),
    app: z.string().optional(),
    http: z.string().url().optional(),
    railway: railwayRef.optional(),
    alert: z.boolean().default(true)
  })
  .refine((s) => s.http || s.railway, { message: "http oder railway angeben" });
const configSchema = z.object({ services: z.array(serviceSchema) });

export type Service = z.infer<typeof serviceSchema>;
export type ServiceState = "up" | "degraded" | "down" | "unknown";

let cached: Promise<Service[]> | null = null;

export function loadServices(): Promise<Service[]> {
  const read = async () => {
    const file = path.join(process.cwd(), process.env.SERVICES_CONFIG_PATH || "config/services.yaml");
    const parsed = configSchema.safeParse(YAML.parse(await fs.readFile(file, "utf8")));
    if (!parsed.success) throw new Error(`services.yaml ist ungültig: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    return parsed.data.services;
  };
  if (process.env.NODE_ENV !== "production") return read();
  cached ??= read().catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}

const SLOW_MS = Number(process.env.ORBIT_STATUS_SLOW_MS) || 4000;
const FAILS_BEFORE_ALERT = Math.max(1, Number(process.env.ORBIT_STATUS_FAILS) || 2);
const BAD_DEPLOY = new Set(["CRASHED", "FAILED"]);

type HttpResult = { ok: boolean; status: number | null; latency: number; message: string | null };

async function checkHttp(url: string): Promise<HttpResult> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "Orbit-Status/1.0", Accept: "*/*" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store"
    });
    await res.body?.cancel().catch(() => {});
    const latency = Date.now() - started;
    return { ok: res.status < 500, status: res.status, latency, message: res.status < 500 ? null : `HTTP ${res.status}` };
  } catch (err) {
    const latency = Date.now() - started;
    const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return { ok: false, status: null, latency, message: timeout ? "Zeitüberschreitung (10 s)" : "nicht erreichbar" };
  }
}

/** Letzte Bereitstellung je Dienst bei Railway, in einer einzigen Anfrage. */
async function railwayStatuses(services: Service[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const token = process.env.RAILWAY_API_TOKEN;
  const withRef = services.filter((s) => s.railway);
  if (!token || withRef.length === 0) return out;
  const fields = withRef
    .map(
      (s, i) =>
        `s${i}: deployments(first: 1, input: { projectId: "${s.railway!.project}", serviceId: "${s.railway!.service}", environmentId: "${s.railway!.environment}" }) { edges { node { status } } }`
    )
    .join("\n");
  try {
    const res = await fetch("https://backboard.railway.com/graphql/v2", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: `query { ${fields} }` }),
      signal: AbortSignal.timeout(15_000)
    });
    const json = (await res.json().catch(() => null)) as { data?: Record<string, { edges: { node: { status: string } }[] } | null>; errors?: { message: string }[] } | null;
    if (!json?.data) {
      console.warn("Railway-Status nicht abrufbar:", json?.errors?.[0]?.message ?? res.status);
      return out;
    }
    withRef.forEach((s, i) => {
      const status = json.data?.[`s${i}`]?.edges?.[0]?.node?.status;
      if (status) out.set(s.id, status);
    });
  } catch (err) {
    console.warn("Railway-Status nicht abrufbar:", err instanceof Error ? err.message : err);
  }
  return out;
}

export type CheckResult = { id: string; state: ServiceState; httpStatus: number | null; latency: number | null; message: string | null; deploy: string | null };

export async function checkAll(services: Service[]): Promise<CheckResult[]> {
  const [deploys, http] = await Promise.all([
    railwayStatuses(services),
    Promise.all(services.map((s) => (s.http ? checkHttp(s.http) : Promise.resolve(null))))
  ]);
  return services.map((s, i) => {
    const h = http[i];
    const deploy = deploys.get(s.id) ?? null;
    const problems: string[] = [];
    if (h && !h.ok) problems.push(h.message ?? "nicht erreichbar");
    if (deploy && BAD_DEPLOY.has(deploy)) problems.push(`Railway: ${deploy === "CRASHED" ? "abgestürzt" : "Bereitstellung fehlgeschlagen"}`);
    let state: ServiceState;
    if (problems.length) state = "down";
    else if (!h && !deploy) state = "unknown";
    else if (h && h.latency > SLOW_MS) state = "degraded";
    else state = "up";
    return {
      id: s.id,
      state,
      httpStatus: h?.status ?? null,
      latency: h?.latency ?? null,
      message: problems.join(" · ") || (state === "degraded" ? `langsam (${h?.latency} ms)` : null),
      deploy
    };
  });
}

// ── Speichern, Störungen und Alarme ─────────────────────────

type Row = { service_id: string; state: ServiceState; fail_count: number };

async function alert(kind: "down" | "up", service: Service, message: string | null, since?: Date) {
  const de = (process.env.ORBIT_DEFAULT_LOCALE || "de") !== "en";
  const base = (process.env.AUTH_URL || "").replace(/\/+$/, "");
  const title = kind === "down" ? `${de ? "Störung" : "Outage"}: ${service.name}` : `${de ? "Wieder in Ordnung" : "Resolved"}: ${service.name}`;
  const minutes = since ? Math.max(1, Math.round((Date.now() - since.getTime()) / 60_000)) : null;
  const text =
    kind === "down"
      ? `${service.name} ${de ? "ist gestört" : "is down"}${message ? `: ${message}` : ""}.`
      : `${service.name} ${de ? "läuft wieder" : "is back up"}${minutes ? (de ? ` (Dauer etwa ${minutes} Min.)` : ` (about ${minutes} min)`) : ""}.`;

  const hook = process.env.ORBIT_ALERT_WEBHOOK;
  if (hook) {
    await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `${kind === "down" ? "🔴" : "🟢"} ${text} ${base}/admin/status`, msg_type: "text", content: { text } }),
      signal: AbortSignal.timeout(10_000)
    }).catch((err) => console.error("Alarm-Webhook fehlgeschlagen:", err));
  }

  const to = recipientsFromEnv("ORBIT_ALERT_TO").length ? recipientsFromEnv("ORBIT_ALERT_TO") : recipientsFromEnv("ORBIT_ACCESS_REQUEST_TO");
  if (!to.length) return;
  await sendMail({
    to,
    subject: title,
    tags: [{ name: "type", value: kind === "down" ? "status_down" : "status_up" }],
    ...renderEmail({
      lang: de ? "de" : "en",
      preheader: text,
      heading: title,
      blocks: [
        { type: "paragraph", text },
        ...(service.http || service.railway
          ? [
              {
                type: "details" as const,
                rows: [
                  ...(service.http ? ([[de ? "Adresse" : "Address", service.http]] as [string, string][]) : []),
                  ...(service.railway ? ([["Railway", `${service.railway.project}`]] as [string, string][]) : [])
                ]
              }
            ]
          : [])
      ],
      cta: base ? { label: de ? "Statusseite öffnen" : "Open status page", url: `${base}/admin/status` } : undefined,
      footer: de ? "Automatische Meldung der Orbit-Statusseite." : "Automatic message from the Orbit status page."
    })
  });
}

/** Ein kompletter Prüflauf: prüfen, speichern, Störungen eröffnen oder schliessen, alarmieren. */
export async function runStatusChecks(): Promise<CheckResult[]> {
  const services = await loadServices();
  const results = await checkAll(services);
  const previous = new Map((await sql<Row[]>`SELECT service_id, state, fail_count FROM service_status`).map((r) => [r.service_id, r]));
  const byId = new Map(services.map((s) => [s.id, s]));

  for (const r of results) {
    const prev = previous.get(r.id);
    const fails = r.state === "down" ? (prev?.fail_count ?? 0) + 1 : 0;
    await sql`
      INSERT INTO service_status (service_id, state, fail_count, http_status, latency_ms, message, checked_at, changed_at)
      VALUES (${r.id}, ${r.state}, ${fails}, ${r.httpStatus}, ${r.latency}, ${r.message}, now(), now())
      ON CONFLICT (service_id) DO UPDATE SET
        state = EXCLUDED.state, fail_count = EXCLUDED.fail_count, http_status = EXCLUDED.http_status,
        latency_ms = EXCLUDED.latency_ms, message = EXCLUDED.message, checked_at = now(),
        changed_at = CASE WHEN service_status.state = EXCLUDED.state THEN service_status.changed_at ELSE now() END`;
    if (r.state !== "unknown") {
      await sql`INSERT INTO service_samples (service_id, ok, latency_ms) VALUES (${r.id}, ${r.state !== "down"}, ${r.latency})`;
    }

    const service = byId.get(r.id)!;
    const [open] = await sql<{ id: string; started_at: Date }[]>`
      SELECT id, started_at FROM service_incidents WHERE service_id = ${r.id} AND ended_at IS NULL LIMIT 1`;
    if (r.state === "down" && fails >= FAILS_BEFORE_ALERT && !open) {
      await sql`INSERT INTO service_incidents (service_id, message) VALUES (${r.id}, ${r.message})`;
      if (service.alert) await alert("down", service, r.message).catch((err) => console.error("Alarm fehlgeschlagen:", err));
    } else if (r.state !== "down" && r.state !== "unknown" && open) {
      await sql`UPDATE service_incidents SET ended_at = now() WHERE id = ${open.id}`;
      if (service.alert) await alert("up", service, null, open.started_at).catch((err) => console.error("Entwarnung fehlgeschlagen:", err));
    }
  }
  // Messpunkte älter als 30 Tage entfernen
  await sql`DELETE FROM service_samples WHERE at < now() - interval '30 days'`;
  return results;
}

// ── Lesen für Statusseite und Mein Tag ────────────────────────

export type ServiceView = Service & {
  state: ServiceState;
  message: string | null;
  httpStatus: number | null;
  latency: number | null;
  checkedAt: string | null;
  since: string | null;
  uptime: number | null;
};

export async function statusOverview(): Promise<ServiceView[]> {
  const services = await loadServices();
  const [rows, uptime] = await Promise.all([
    sql<{ service_id: string; state: ServiceState; message: string | null; http_status: number | null; latency_ms: number | null; checked_at: Date | null; changed_at: Date }[]>`
      SELECT service_id, state, message, http_status, latency_ms, checked_at, changed_at FROM service_status`,
    sql<{ service_id: string; ratio: number }[]>`
      SELECT service_id, avg(CASE WHEN ok THEN 1 ELSE 0 END)::float AS ratio
      FROM service_samples WHERE at > now() - interval '30 days' GROUP BY service_id`
  ]);
  const byId = new Map(rows.map((r) => [r.service_id, r]));
  const up = new Map(uptime.map((u) => [u.service_id, u.ratio]));
  return services.map((s) => {
    const r = byId.get(s.id);
    return {
      ...s,
      state: r?.state ?? "unknown",
      message: r?.message ?? null,
      httpStatus: r?.http_status ?? null,
      latency: r?.latency_ms ?? null,
      checkedAt: r?.checked_at?.toISOString() ?? null,
      since: r?.changed_at?.toISOString() ?? null,
      uptime: up.has(s.id) ? up.get(s.id)! : null
    };
  });
}

export type Incident = { id: number; serviceId: string; serviceName: string; startedAt: string; endedAt: string | null; message: string | null };

export async function listIncidents(limit = 50): Promise<Incident[]> {
  const names = new Map((await loadServices()).map((s) => [s.id, s.name]));
  const rows = await sql<{ id: string; service_id: string; started_at: Date; ended_at: Date | null; message: string | null }[]>`
    SELECT id, service_id, started_at, ended_at, message FROM service_incidents ORDER BY started_at DESC LIMIT ${limit}`;
  return rows.map((r) => ({
    id: Number(r.id),
    serviceId: r.service_id,
    serviceName: names.get(r.service_id) ?? r.service_id,
    startedAt: r.started_at.toISOString(),
    endedAt: r.ended_at?.toISOString() ?? null,
    message: r.message
  }));
}

export async function openIncidents(): Promise<Incident[]> {
  return (await listIncidents(100)).filter((i) => !i.endedAt);
}

export const railwayConfigured = () => Boolean(process.env.RAILWAY_API_TOKEN);
