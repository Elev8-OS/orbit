import { getLocale, getTranslations } from "next-intl/server";
import { loadAppsConfig } from "@/lib/apps";
import { usageByApp } from "@/lib/platform/usage";
import { statusOverview } from "@/lib/platform/status";
import { AppIcon } from "@/components/AppIcon";

export const dynamic = "force-dynamic";

const REPO = process.env.ORBIT_REPO_URL || "https://github.com/Elev8-OS/orbit";

export default async function AppsPage() {
  const t = await getTranslations("platform.admin.apps");
  const locale = (await getLocale()) === "en" ? "en" : "de";
  const config = await loadAppsConfig();
  const [usage, services] = await Promise.all([usageByApp(30).catch(() => new Map()), statusOverview().catch(() => [])]);
  const stateOf = new Map(services.filter((s) => s.app).map((s) => [s.app!, s.state]));
  return (
    <div className="p-page">
      <h1 className="p-page-title">{t("title")}</h1>
      <p className="p-page-lead">
        {t("lead")}{" "}
        <a className="p-link p-link-strong" href={`${REPO}/blob/main/config/apps.yaml`} target="_blank" rel="noreferrer">
          config/apps.yaml
        </a>
      </p>
      <div className="p-table-wrap p-card">
        <table className="p-table">
          <thead>
            <tr>
              <th>{t("cols.app")}</th>
              <th>{t("cols.roles")}</th>
              <th>{t("cols.mode")}</th>
              <th>{t("cols.status")}</th>
              <th className="p-num">{t("cols.users")}</th>
              <th className="p-num">{t("cols.sessions")}</th>
            </tr>
          </thead>
          <tbody>
            {config.apps.map((app) => {
              const u = usage.get(app.id);
              const state = stateOf.get(app.id);
              return (
                <tr key={app.id} className={app.enabled ? "" : "is-disabled"}>
                  <td>
                    <span className="p-app-cell">
                      <span className="p-app-icon" aria-hidden="true">
                        <AppIcon icon={app.icon} />
                      </span>
                      <span>
                        <span className="p-row-title">{app.name[locale]}</span>
                        <br />
                        <span className="p-muted">{app.enabled ? app.url : t("disabled")}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <div className="p-tags">
                      {app.roles.map((r) => (
                        <span key={r} className="p-tag">
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    {app.embed ? t("embedded") : t("newTab")}
                    {Object.keys(app.integrations ?? {}).length > 0 && <span className="p-muted"> · {Object.keys(app.integrations).join(", ")}</span>}
                  </td>
                  <td>{state ? <span className={`p-dot is-${state}`}>{t(`state.${state}`)}</span> : <span className="p-muted">–</span>}</td>
                  <td className="p-num">{u?.users ?? 0}</td>
                  <td className="p-num">{u?.sessions ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="p-muted">{t("usageHint")}</p>
    </div>
  );
}
