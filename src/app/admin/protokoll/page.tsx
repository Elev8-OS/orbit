import { getLocale, getTranslations } from "next-intl/server";
import { listAudit } from "@/lib/platform/audit";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const t = await getTranslations("platform.admin.audit");
  const locale = (await getLocale()) === "en" ? "en" : "de";
  const entries = await listAudit(300);
  const fmt = (iso: string) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Zurich" }).format(new Date(iso));
  const known = ["access.approve", "access.reject", "role.assign", "role.remove", "assistant.connect", "assistant.disconnect", "status.check"];
  return (
    <div className="p-page">
      <h1 className="p-page-title">{t("title")}</h1>
      <p className="p-page-lead">{t("lead")}</p>
      <div className="p-card p-table-wrap">
        {entries.length === 0 ? (
          <p className="p-muted">{t("empty")}</p>
        ) : (
          <table className="p-table">
            <thead>
              <tr>
                <th>{t("cols.when")}</th>
                <th>{t("cols.who")}</th>
                <th>{t("cols.action")}</th>
                <th>{t("cols.target")}</th>
                <th>{t("cols.detail")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="p-num">{fmt(e.at)}</td>
                  <td>{e.actorEmail ?? t("system")}</td>
                  <td>{known.includes(e.action) ? t(`actions.${e.action.replace(".", "_")}`) : e.action}</td>
                  <td>{e.target ?? "–"}</td>
                  <td className="p-muted p-mono">{e.detail ? JSON.stringify(e.detail) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
