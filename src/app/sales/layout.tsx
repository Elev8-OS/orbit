import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { Elev8Logo } from "@/components/Elev8Logo";
import { SalesNav } from "@/components/sales/SalesNav";
import { PrefsListener } from "@/components/sales/PrefsListener";
import { ViewAsSwitch } from "@/components/sales/ViewAsSwitch";
import { TimeZoneProvider } from "@/components/sales/shared";
import { pageContext } from "@/lib/sales/page";
import "./sales.css";

export const dynamic = "force-dynamic";

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

  return (
    <div className={ctx.embedded ? "sl-shell is-embedded" : "sl-shell"}>
      {ctx.embedded && <PrefsListener />}
      <header className="sl-bar">
        <div className="sl-bar-inner">
          {!ctx.embedded && (
            <>
              <a href="/" className="sl-back" aria-label={t("back")}>
                <ArrowLeft size={18} aria-hidden="true" />
                <Elev8Logo height={22} />
              </a>
              <span className="sl-bar-divider" aria-hidden="true" />
            </>
          )}
          <a href="/sales" className="sl-bar-title">
            {t("appName")}
          </a>
          {viewer && (
            <SalesNav
              items={[
                { href: "/sales", label: t("nav.today") },
                { href: "/sales/pipeline", label: t("nav.pipeline") }
              ]}
            />
          )}
          {viewer && ctx.user?.isManager && ctx.team.length > 1 && (
            <ViewAsSwitch users={ctx.team.map((u) => ({ id: u.id, name: u.name }))} current={viewer.ghlUser.id} own={viewer.user.email} ownEmails={Object.fromEntries(ctx.team.map((u) => [u.id, u.email]))} />
          )}
        </div>
      </header>
      {viewer?.other && (
        <div className="sl-viewing" role="status">
          {t("viewing", { name: viewer.ghlUser.name })}
        </div>
      )}
      <main className="sl-main" id="main">
        <TimeZoneProvider timeZone={ctx.user ? ctx.timeZone : "Europe/Zurich"}>{body}</TimeZoneProvider>
      </main>
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
