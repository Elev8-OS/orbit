import { getLocale, getTranslations } from "next-intl/server";
import { listIncidents, railwayConfigured, statusOverview, type ServiceView } from "@/lib/platform/status";
import { RunChecksButton } from "@/components/admin/RunChecksButton";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const t = await getTranslations("platform.admin.status");
  const locale = (await getLocale()) === "en" ? "en" : "de";
  const [services, incidents] = await Promise.all([statusOverview(), listIncidents(40)]);
  const fmt = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Zurich" }).format(new Date(iso)) : "–";
  const down = services.filter((s) => s.state === "down");
  const groups: ServiceView["group"][] = ["apps", "background", "integrations"];
  const pct = (v: number | null) => (v == null ? "–" : `${(v * 100).toFixed(v >= 0.9995 ? 0 : 2)} %`);
  return (
    <div className="p-page">
      <div className="p-page-head">
        <div>
          <h1 className="p-page-title">{t("title")}</h1>
          <p className="p-page-lead">{railwayConfigured() ? t("lead") : t("leadNoRailway")}</p>
        </div>
        <RunChecksButton />
      </div>
      <div className={`p-banner ${down.length ? "is-danger" : "is-success"}`} role="status">
        {down.length ? t("summaryDown", { count: down.length, names: down.map((s) => s.name).join(", ") }) : t("summaryUp")}
      </div>
      {groups.map((g) => {
        const list = services.filter((s) => s.group === g);
        if (!list.length) return null;
        return (
          <section key={g} className="p-card">
            <h2 className="p-card-title">{t(`groups.${g}`)}</h2>
            <ul className="p-rows">
              {list.map((s) => (
                <li key={s.id}>
                  <span className="p-row-main">
                    <span className={`p-dot is-${s.state}`}>
                      <span className="p-row-title">{s.name}</span>
                    </span>
                    <span className="p-muted">{s.message ?? (s.checkedAt ? t("checked", { time: fmt(s.checkedAt) }) : t("notChecked"))}</span>
                  </span>
                  <span className="p-row-side">
                    <span className="p-muted">{t(`state.${s.state}`)}</span>
                    {s.latency != null && <span className="p-num">{s.latency} ms</span>}
                    <span className="p-num" title={t("uptime")}>
                      {pct(s.uptime)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <section className="p-card">
        <h2 className="p-card-title">{t("incidents")}</h2>
        {incidents.length === 0 ? (
          <p className="p-muted">{t("noIncidents")}</p>
        ) : (
          <ul className="p-rows">
            {incidents.map((i) => (
              <li key={i.id}>
                <span className="p-row-main">
                  <span className="p-row-title">{i.serviceName}</span>
                  <span className="p-muted">{i.message}</span>
                </span>
                <span className="p-row-side p-num">
                  {fmt(i.startedAt)} – {i.endedAt ? fmt(i.endedAt) : <strong>{t("ongoing")}</strong>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
