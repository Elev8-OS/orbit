import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db";
import { activeUsers } from "@/lib/platform/usage";
import { statusOverview, railwayConfigured } from "@/lib/platform/status";
import { roleManagementEnabled } from "@/lib/platform/entra";
import { mailConfigured } from "@/lib/mail/send";
import { oauthConfigured } from "@/lib/assistant/oauth";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const t = await getTranslations("platform.admin.overview");
  const [week, month, requests, services, assistants] = await Promise.all([
    activeUsers(7).catch(() => 0),
    activeUsers(30).catch(() => 0),
    sql<{ n: number }[]>`SELECT count(*)::int AS n FROM access_requests WHERE status = 'open'`.then((r) => r[0]?.n ?? 0).catch(() => 0),
    statusOverview().catch(() => []),
    sql<{ n: number }[]>`SELECT count(*)::int AS n FROM assistant_accounts WHERE enabled`.then((r) => r[0]?.n ?? 0).catch(() => 0)
  ]);
  const down = services.filter((s) => s.state === "down").length;
  const checks: [string, boolean][] = [
    [t("checks.mail"), mailConfigured()],
    [t("checks.railway"), railwayConfigured()],
    [t("checks.alerts"), Boolean(process.env.ORBIT_ALERT_TO || process.env.ORBIT_ACCESS_REQUEST_TO || process.env.ORBIT_ALERT_WEBHOOK)],
    [t("checks.roles"), roleManagementEnabled()],
    [t("checks.noah"), Boolean(process.env.ANTHROPIC_API_KEY)],
    [t("checks.assistant"), oauthConfigured()],
    [t("checks.ghl"), Boolean(process.env.GHL_API_TOKEN && process.env.GHL_LOCATION_ID)]
  ];
  const tiles: [string, string | number, string?][] = [
    [t("activeWeek"), week],
    [t("activeMonth"), month],
    [t("openRequests"), requests, "/admin/zugriffe"],
    [t("servicesDown"), `${down} / ${services.length}`, "/admin/status"],
    [t("assistants"), assistants]
  ];
  return (
    <div className="p-page">
      <h1 className="p-page-title">{t("title")}</h1>
      <div className="p-tiles">
        {tiles.map(([label, value, href]) => {
          const body = (
            <>
              <span className="p-tile-label">{label}</span>
              <span className="p-tile-value">{value}</span>
            </>
          );
          return href ? (
            <a key={label} className="p-card p-tile" href={href}>
              {body}
            </a>
          ) : (
            <div key={label} className="p-card p-tile">
              {body}
            </div>
          );
        })}
      </div>
      <section className="p-card">
        <h2 className="p-card-title">{t("setup")}</h2>
        <ul className="p-checks">
          {checks.map(([label, ok]) => (
            <li key={label} className={ok ? "is-ok" : "is-missing"}>
              <span aria-hidden="true">{ok ? "✓" : "–"}</span>
              {label}
              <span className="p-muted">{ok ? t("ready") : t("missing")}</span>
            </li>
          ))}
        </ul>
        <p className="p-muted">{t("setupHint")}</p>
      </section>
    </div>
  );
}
