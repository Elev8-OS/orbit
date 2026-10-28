import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { AppFrame, Notice } from "@/components/platform/AppFrame";
import { currentUser } from "@/lib/platform/access";
import { isEmbedded } from "@/lib/platform/embedded";
import { hasRadarAccess } from "@/lib/radar/access";
import { radarStrings } from "@/lib/radar/i18n";

export const dynamic = "force-dynamic";

export default async function RadarLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const locale = (await getLocale()) === "en" ? "en" : "de";
  const s = radarStrings(locale);
  return (
    <AppFrame
      title={s.appName}
      href="/radar"
      embedded={await isEmbedded()}
      backLabel={locale === "en" ? "Back" : "Zurück"}
      searchLabel={locale === "en" ? "Search everything" : "Alles durchsuchen"}
    >
      {hasRadarAccess(user.roles) ? children : <Notice title={s.noAccessTitle} text={s.noAccessBody} />}
    </AppFrame>
  );
}
