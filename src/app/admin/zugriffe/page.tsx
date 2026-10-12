import { getLocale, getTranslations } from "next-intl/server";
import { sql } from "@/lib/db";
import { loadAppsConfig } from "@/lib/apps";
import { roleManagementEnabled } from "@/lib/platform/entra";
import { RequestActions } from "@/components/admin/RequestActions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  user_name: string | null;
  user_email: string | null;
  app_id: string;
  message: string | null;
  status: string;
  created_at: Date;
  decided_by: string | null;
  decided_at: Date | null;
  granted_role: string | null;
};

export default async function RequestsPage() {
  const t = await getTranslations("platform.admin.requests");
  const locale = (await getLocale()) === "en" ? "en" : "de";
  const config = await loadAppsConfig();
  const apps = new Map(config.apps.map((a) => [a.id, a]));
  const rows = await sql<Row[]>`
    SELECT id, user_name, user_email, app_id, message, status, created_at, decided_by, decided_at, granted_role
    FROM access_requests ORDER BY (status = 'open') DESC, created_at DESC LIMIT 200`;
  const fmt = (d: Date | null) => (d ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" }).format(d) : "");
  const open = rows.filter((r) => r.status === "open");
  const done = rows.filter((r) => r.status !== "open");
  const graph = roleManagementEnabled();
  return (
    <div className="p-page">
      <h1 className="p-page-title">{t("title")}</h1>
      <p className="p-page-lead">{graph ? t("leadGraph") : t("leadManual")}</p>
      <section className="p-card">
        <h2 className="p-card-title">
          {t("open")} <span className="p-count">{open.length}</span>
        </h2>
        {open.length === 0 ? (
          <p className="p-muted">{t("noneOpen")}</p>
        ) : (
          <ul className="p-rows">
            {open.map((r) => {
              const app = apps.get(r.app_id);
              return (
                <li key={r.id} className="p-request">
                  <span className="p-row-main">
                    <span className="p-row-title">
                      {r.user_name || r.user_email} → {app?.name[locale] ?? r.app_id}
                    </span>
                    <span className="p-muted">
                      {r.user_email} · {fmt(r.created_at)}
                    </span>
                    {r.message && <span className="p-quote">„{r.message}“</span>}
                  </span>
                  <RequestActions id={Number(r.id)} roles={app?.roles ?? []} graph={graph} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="p-card">
        <h2 className="p-card-title">{t("history")}</h2>
        {done.length === 0 ? (
          <p className="p-muted">{t("noneHistory")}</p>
        ) : (
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr>
                  <th>{t("cols.person")}</th>
                  <th>{t("cols.app")}</th>
                  <th>{t("cols.decision")}</th>
                  <th>{t("cols.by")}</th>
                  <th>{t("cols.when")}</th>
                </tr>
              </thead>
              <tbody>
                {done.map((r) => (
                  <tr key={r.id}>
                    <td>{r.user_name || r.user_email}</td>
                    <td>{apps.get(r.app_id)?.name[locale] ?? r.app_id}</td>
                    <td>
                      <span className={`p-status is-${r.status}`}>{t(`status.${r.status === "approved" ? "approved" : "rejected"}`)}</span>
                      {r.granted_role && <span className="p-muted"> · {r.granted_role}</span>}
                    </td>
                    <td>{r.decided_by ?? "–"}</td>
                    <td className="p-num">{fmt(r.decided_at ?? r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
