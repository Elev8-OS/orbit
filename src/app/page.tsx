import { redirect } from "next/navigation";
import { after } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { arrangeApps, isAdmin, loadAppsConfig, requestableApps, visibleApps } from "@/lib/apps";
import { claimWelcomeEmail, getPreferences, registerFirstVisit } from "@/lib/preferences";
import { openRequestIds } from "@/lib/access-requests";
import { mailConfigured, sendMail } from "@/lib/mail/send";
import { welcomeEmail } from "@/lib/mail/templates";
import { isLocale, defaultLocale } from "@/i18n/config";
import { AppIcon } from "@/components/AppIcon";
import { Header } from "@/components/Header";
import { Dashboard, type CategoryData, type TileData } from "@/components/Dashboard";
import { WelcomeIntro } from "@/components/WelcomeIntro";
import { OrbitShell, type ShellApp } from "@/components/OrbitShell";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ welcome?: string; app?: string; path?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const user = session.user;

  const rawLocale = await getLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const roles = user.roles ?? [];

  const config = await loadAppsConfig();
  const apps = visibleApps(config, roles);

  // Einstellungen laden; beim allerersten Besuch User mit Start-Reihenfolge anlegen
  let firstVisit = false;
  const prefs = await getPreferences(user.id).catch((err) => {
    console.error("Einstellungen nicht geladen:", err);
    return undefined;
  });
  if (prefs === null) {
    firstVisit = await registerFirstVisit(user.id, apps.map((a) => a.id)).catch(() => false);
  }

  // Willkommensmail genau einmal pro Person – auch nachgeholt, wenn Resend erst später eingerichtet wird
  if (prefs !== undefined && user.email && mailConfigured() && process.env.ORBIT_WELCOME_EMAIL !== "false") {
    const email = user.email;
    const name = user.name || email;
    const appNames = apps.map((a) => a.name[locale]);
    after(async () => {
      if (!(await claimWelcomeEmail(user.id).catch(() => false))) return;
      await sendMail({ to: email, tags: [{ name: "type", value: "welcome" }], ...welcomeEmail(locale, name, appNames) });
    });
  }
  const { ordered, newIds } = arrangeApps(apps, prefs?.tileOrder ?? null);

  const categoryById = new Map(config.categories.map((c) => [c.id, c]));
  const colorOf = (app: (typeof apps)[number]) => app.color ?? categoryById.get(app.category)!.color;

  const tiles: TileData[] = ordered.map((app) => {
    const category = categoryById.get(app.category)!;
    return {
      id: app.id,
      name: app.name[locale],
      description: app.description[locale],
      url: app.url,
      openIn: app.openIn,
      categoryId: category.id,
      categoryName: category.name[locale],
      color: colorOf(app),
      icon: <AppIcon icon={app.icon} />,
      isNew: newIds.includes(app.id),
      embed: app.embed
    };
  });
  const categories: CategoryData[] = config.categories
    .filter((c) => apps.some((a) => a.category === c.id))
    .map((c) => ({ id: c.id, name: c.name[locale], color: c.color }));

  const requestable = requestableApps(config, roles).map((app) => ({
    id: app.id,
    name: app.name[locale],
    description: app.description[locale],
    color: colorOf(app)
  }));
  const pendingRequests = requestable.length ? await openRequestIds(user.id).catch(() => []) : [];

  const params = await searchParams;
  const welcome = params.welcome === "1";
  const shellApps: ShellApp[] = ordered
    .filter((app) => app.embed)
    .map((app) => ({
      id: app.id,
      name: app.name[locale],
      url: app.url,
      color: colorOf(app),
      icon: <AppIcon icon={app.icon} />
    }));
  const t = await getTranslations("welcome");
  const firstName = user.name?.split(/[\s,]+/).find(Boolean);
  const dots = tiles.map((tile) => tile.color);

  return (
    <OrbitShell apps={shellApps} initialApp={params.app ?? null} initialPath={params.path ?? null}>
      <div className="shell">
        {welcome && (
          <WelcomeIntro
            heading={firstName ? t(firstVisit ? "first" : "returning", { name: firstName }) : t("fallback")}
            subline={t("ready", { count: tiles.length })}
            skipLabel={t("skip")}
            dots={dots}
          />
        )}
        <Header name={user.name ?? null} email={user.email ?? null} admin={isAdmin(roles)} locale={locale} dots={dots} />
        <main className="main" id="main">
          <Dashboard
            tiles={tiles}
            categories={categories}
            defaultOrder={apps.map((a) => a.id)}
            supportEmail={process.env.ORBIT_SUPPORT_EMAIL || null}
            requestable={requestable}
            pendingRequests={pendingRequests}
            welcome={welcome}
          />
        </main>
      </div>
    </OrbitShell>
  );
}
