import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { SalesNav } from "@/components/sales/SalesNav";
import { PrefsListener } from "@/components/sales/PrefsListener";
import { ViewAsSwitch } from "@/components/sales/ViewAsSwitch";
import { TimeZoneProvider } from "@/components/sales/shared";
import { pageContext } from "@/lib/sales/page";
import "./sales.css";
import "./sales-shell.css";

export const dynamic = "force-dynamic";

/**
 * Rahmen von Sales nach dem Elev8 Design System: Seitenleiste links wie in ERT und Revenue Desk,
 * kein eigenes Logo und kein App-Name – Orbit zeigt beides im Tab.
 */
export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const t = await getTranslations("sales");
  const ctx = await pageContext();

  let body: React.ReactNode = children;
  if (!ctx.user) {
    body = <Notice title={t("noAccess.title")} text={t("noAccess.body")} back={t("back")} />;
  } else if (!ctx.result.ok) {
    const key = ctx.result.reason;
    body = <Notice title={t(`setup.${key}.title`, { email: ctx.result.email })} text={t(`setup.${key}.body`, { email: ctx.result.email })} back={t("back")} />;
  }

  const viewer = ctx.user && ctx.result.ok ? ctx.result.viewer : null;
  const canViewAs = Boolean(viewer && ctx.user?.isManager && ctx.team.length > 1);

  return (
    <div className={`sl-shell sl-v2${ctx.embedded ? " is-embedded" : ""}`}>
      {ctx.embedded && <PrefsListener />}
      {viewer && (
        <aside className="sl-side">
          <SalesNav
            group={t("appName")}
            items={[
              { href: "/sales", label: t("nav.today"), icon: "today" },
              { href: "/sales/pipeline", label: t("nav.pipeline"), icon: "pipeline" }
            ]}
          />
          <div className="sl-side-foot">
            {canViewAs && (
              <div className="sl-side-viewas">
                <span className="sl-side-label">{t("viewAs")}</span>
                <ViewAsSwitch
                  users={ctx.team.map((u) => ({ id: u.id, name: u.name }))}
                  current={viewer!.ghlUser.id}
                  own={viewer!.user.email}
                  ownEmails={Object.fromEntries(ctx.team.map((u) => [u.id, u.email]))}
                />
              </div>
            )}
            {/* Nur ausserhalb von Orbit: zurück zur Übersicht (im Tab übernimmt das die Tab-Leiste) */}
            <a href="/" className="sl-side-back">
              <ArrowLeft size={14} aria-hidden="true" />
              Orbit
            </a>
          </div>
        </aside>
      )}
      <div className="sl-content">
        {viewer?.other && (
          <div className="sl-viewing" role="status">
            {t("viewing", { name: viewer.ghlUser.name })}
          </div>
        )}
        <main className="sl-main" id="main">
          <TimeZoneProvider timeZone={ctx.user ? ctx.timeZone : "Europe/Zurich"}>{body}</TimeZoneProvider>
        </main>
      </div>
    </div>
  );
}

function Notice({ title, text, back }: { title: string; text: string; back: string }) {
  return (
    <div className="sl-notice">
      <h1>{title}</h1>
      <p>{text}</p>
      <a className="button-secondary" href="/">
        {back}
      </a>
    </div>
  );
}
