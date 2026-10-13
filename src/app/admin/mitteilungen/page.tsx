import { getLocale, getTranslations } from "next-intl/server";
import { sql } from "@/lib/db";
import { loadAppsConfig } from "@/lib/apps";
import { listUsers } from "@/lib/platform/directory";
import { BroadcastForm } from "@/components/push/BroadcastForm";
import { CancelBroadcast } from "@/components/push/CancelBroadcast";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  created_by: string;
  title: string;
  body: string;
  audience: { type: string; roles?: string[]; ids?: string[] };
  scheduled_at: Date;
  sent_at: Date | null;
  cancelled_at: Date | null;
  recipients: number | null;
  devices: number | null;
  delivered: number | null;
};

export default async function AdminPushPage() {
  const t = await getTranslations("push.admin");
  const locale = (await getLocale()) === "en" ? "en" : "de";
  const [config, users, rows, [totals]] = await Promise.all([
    loadAppsConfig(),
    listUsers(),
    sql<Row[]>`SELECT id, created_by, title, body, audience, scheduled_at, sent_at, cancelled_at, recipients, devices, delivered
               FROM push_broadcasts ORDER BY created_at DESC LIMIT 50`,
    sql<{ devices: number; users: number }[]>`SELECT count(*)::int AS devices, count(DISTINCT user_id)::int AS users FROM push_subscriptions`
  ]);
  const roles = [...new Set(users.flatMap((u) => u.roles))].sort();
  const names = new Map(users.map((u) => [u.id, u.name || u.email || u.id]));
  const fmt = (d: Date) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-CH", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Zurich" }).format(d);
  const audienceLabel = (a: Row["audience"]) =>
    a.type === "all" ? t("all") : a.type === "roles" ? (a.roles ?? []).join(", ") : (a.ids ?? []).map((id) => names.get(id) ?? id).join(", ");

  return (
    <div className="p-page p-narrow">
      <h1 className="p-page-title">{t("title")}</h1>
      <p className="p-page-lead">{t("lead")}</p>
      <p className="p-muted">{t("devicesTotal", { devices: totals?.devices ?? 0, users: totals?.users ?? 0 })}</p>
      <BroadcastForm
        roles={roles}
        people={users.map((u) => ({ id: u.id, name: u.name || u.email || u.id }))}
        apps={config.apps.filter((a) => a.enabled !== false && a.embed).map((a) => ({ id: a.id, name: a.name[locale] }))}
      />
      <section className="p-card">
        <h2 className="p-card-title">{t("history")}</h2>
        {rows.length === 0 ? (
          <p className="p-muted">{t("empty")}</p>
        ) : (
          <ul className="p-rows">
            {rows.map((r) => (
              <li key={r.id}>
                <span className="p-row-main">
                  <span className="p-row-title">{r.title}</span>
                  <span className="p-muted">{r.body}</span>
                  <span className="p-muted">
                    {audienceLabel(r.audience)} · {r.created_by}
                  </span>
                </span>
                <span className="p-row-side">
                  <span className="p-num">{fmt(r.sent_at ?? r.scheduled_at)}</span>
                  {r.cancelled_at ? (
                    <span className="p-status">{t("cancelled")}</span>
                  ) : r.sent_at ? (
                    <span className="p-num">
                      {r.delivered ?? 0}/{r.devices ?? 0}
                    </span>
                  ) : (
                    <>
                      <span className="p-status">{t("pending")}</span>
                      <CancelBroadcast id={Number(r.id)} label={t("cancel")} />
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
