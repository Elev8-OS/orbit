import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AppFrame } from "@/components/platform/AppFrame";
import { PushSettings, type Category } from "@/components/push/PushSettings";
import { currentUser, hasAssistentAccess } from "@/lib/platform/access";
import { loadAppsConfig, visibleApps } from "@/lib/apps";
import { devicesOf, getPrefs } from "@/lib/push/service";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const locale = (await getLocale()) === "en" ? "en" : "de";
  const t = await getTranslations("push.what");
  const tc = await getTranslations("platform.common");
  const tp = await getTranslations("push");
  const [prefs, devices, config] = await Promise.all([getPrefs(user.id), devicesOf(user.id), loadAppsConfig()]);

  const categories: Category[] = [{ id: "myday", label: t("myday"), hint: t("mydayHint") }];
  if (hasAssistentAccess(user.roles) && process.env.ASSISTENT_ENABLED === "true") categories.push({ id: "assistant", label: t("assistant"), hint: t("assistantHint") });
  for (const app of visibleApps(config, user.roles).filter((a) => a.integrations?.today)) {
    categories.push({ id: `app:${app.id}`, label: t("app", { app: app.name[locale] }), hint: t("appHint") });
  }
  categories.push({ id: "access", label: t("access"), hint: t("accessHint") });
  if (user.admin) {
    categories.push({ id: "requests", label: t("requests"), hint: t("requestsHint") });
    categories.push({ id: "status", label: t("status"), hint: t("statusHint") });
  }

  return (
    <AppFrame title={tp("title")} href="/mitteilungen" embedded={false} backLabel={tc("back")} searchLabel={tc("searchAll")}>
      <PushSettings initialPrefs={prefs} devices={devices} categories={categories} />
    </AppFrame>
  );
}
